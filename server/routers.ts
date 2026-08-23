import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { buildFeatureVector, evaluateRiskGuard, hashValue, isOfferAcceptable, runAiUnderwriting } from "./underwriting";
import { previewAttestcoinFacts, verifyTransactionWithAttestcoin } from "./attestcoin";
import { getPersistedLoanSnapshot, persistLoanSnapshot, transitionLoanState } from "./db";
import { PROOFLOAN_ERROR_CODES, isLiveTxHash, isProofLoanApplicationId, type LoanSnapshot, type ProofLoanState, type SourceChain, type ProofLoanErrorCode } from "@shared/proofloan";
import { TRPCError } from "@trpc/server";

const applications = new Map<string, LoanSnapshot>();
const MAX_PREVIEW_APPLICATIONS = 100;

export function storePreviewApplication(store: Map<string, LoanSnapshot>, snapshot: LoanSnapshot, maxEntries = MAX_PREVIEW_APPLICATIONS): void {
  const boundedMaxEntries = Number.isFinite(maxEntries) ? Math.max(1, Math.floor(maxEntries)) : MAX_PREVIEW_APPLICATIONS;
  if (!store.has(snapshot.applicationId)) {
    while (store.size >= boundedMaxEntries) {
      const oldestApplicationId = store.keys().next().value;
      if (typeof oldestApplicationId !== "string" || !store.delete(oldestApplicationId)) break;
    }
  }
  store.set(snapshot.applicationId, snapshot);
}

const MAX_AUDIT_DETAIL_LENGTH = 512;
const MAX_PROOF_REQUESTS_PER_WINDOW = 5;
const PROOF_REQUEST_WINDOW_MS = 60_000;
const MAX_THROTTLE_KEYS = 1_000;
const proofRequestWindows = new Map<string, number[]>();
const applicationMutationLocks = new Map<string, Promise<void>>();

export async function withApplicationMutation<T>(applicationId: string, operation: () => Promise<T>): Promise<T> {
  const previous = applicationMutationLocks.get(applicationId);
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const queued = previous ? previous.then(() => gate) : gate;
  applicationMutationLocks.set(applicationId, queued);
  if (previous) await previous;
  try {
    return await operation();
  } finally {
    release();
    if (applicationMutationLocks.get(applicationId) === queued) applicationMutationLocks.delete(applicationId);
  }
}

export function allowProofRequest(key: string, nowMs = Date.now(), limit = MAX_PROOF_REQUESTS_PER_WINDOW, windowMs = PROOF_REQUEST_WINDOW_MS): boolean {
  const boundedLimit = Number.isFinite(limit) ? Math.max(1, Math.floor(limit)) : MAX_PROOF_REQUESTS_PER_WINDOW;
  const boundedWindowMs = Number.isFinite(windowMs) ? Math.max(1, windowMs) : PROOF_REQUEST_WINDOW_MS;
  const cutoff = nowMs - boundedWindowMs;
  const recent = (proofRequestWindows.get(key) ?? []).filter(timestamp => timestamp > cutoff);
  if (recent.length >= boundedLimit) {
    proofRequestWindows.set(key, recent);
    return false;
  }
  if (!proofRequestWindows.has(key) && proofRequestWindows.size >= MAX_THROTTLE_KEYS) {
    const oldestKey = proofRequestWindows.keys().next().value;
    if (typeof oldestKey === "string") proofRequestWindows.delete(oldestKey);
  }
  proofRequestWindows.set(key, [...recent, nowMs]);
  return true;
}

const now = () => new Date().toISOString();
const normalizeBoundedText = (text: string, maxLength: number) => text.length <= maxLength ? text : `${text.slice(0, maxLength - 1)}…`;
export function normalizeProofLoanErrorMessage(message: string): string {
  return normalizeBoundedText(message, MAX_AUDIT_DETAIL_LENGTH);
}
const proofLoanError = (code: ProofLoanErrorCode, message: string) => new TRPCError({ code: "BAD_REQUEST", message: `[${code}] ${normalizeProofLoanErrorMessage(message)}` });
const applicationIdInput = z.string().trim().refine(isProofLoanApplicationId, "Invalid ProofLoan application ID.");
export function normalizeAuditDetail(detail: string): string {
  return normalizeBoundedText(detail, MAX_AUDIT_DETAIL_LENGTH);
}
const audit = (state: ProofLoanState, detail: string) => {
  const normalizedDetail = normalizeAuditDetail(detail);
  return { state, label: state, timestamp: now(), detail: normalizedDetail, hash: hashValue({ state, detail: normalizedDetail, at: Date.now() }) };
};
async function transitionLiveState(snapshot: LoanSnapshot, from: ProofLoanState, to: ProofLoanState, live: boolean) {
  if (!live) { snapshot.state = to; return; }
  const transitionResult = await transitionLoanState(snapshot.applicationId, from, to);
  if (transitionResult === "unavailable") throw proofLoanError(PROOFLOAN_ERROR_CODES.DATABASE, "Database is unavailable; the live proof state was not committed.");
  if (transitionResult === "conflict") throw proofLoanError(PROOFLOAN_ERROR_CODES.STATE_CONFLICT, `Database rejected state transition ${from} -> ${to}.`);
  snapshot.state = to;
  const persisted = await getPersistedLoanSnapshot(snapshot.applicationId);
  if (!persisted || persisted.state !== to) throw proofLoanError(PROOFLOAN_ERROR_CODES.DATABASE, `Database state transition was not read back as ${to}.`);
}

async function persistLiveSnapshot(snapshot: LoanSnapshot, live: boolean) {
  if (!live) return;
  if (!(await persistLoanSnapshot(snapshot))) throw proofLoanError(PROOFLOAN_ERROR_CODES.DATABASE, "Live Attestcoin applications require database persistence for every state transition.");
  const persisted = await getPersistedLoanSnapshot(snapshot.applicationId);
  if (!persisted || persisted.state !== snapshot.state) throw proofLoanError(PROOFLOAN_ERROR_CODES.DATABASE, `Database state transition was not committed as ${snapshot.state}.`);
}

function seedSnapshot(walletAddress: string, sourceChain: SourceChain): LoanSnapshot {
  const applicationId = `PL-${hashValue({ walletAddress, sourceChain, time: Date.now() }).toUpperCase()}`;
  return {
    applicationId,
    walletAddress,
    sourceChain,
    state: "Intake",
    facts: [],
    features: { repaymentCount: 0, latePayments: 0, leverageRatio: 0, walletAgeDays: 0, volume7d: 0, volume30d: 0, volume180d: 0, evidenceCount: 0, freshnessScore: 0 },
    audit: [audit("Intake", "Borrower intake created; waiting for a wallet proof request.")],
  };
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  proofloan: router({
    createApplication: publicProcedure.input(z.object({ walletAddress: z.string().trim().min(8).max(256), sourceChain: z.enum(["Ethereum Sepolia", "Polygon Amoy"]) })).mutation(async ({ input }) => {
      if (!allowProofRequest(input.walletAddress)) throw proofLoanError(PROOFLOAN_ERROR_CODES.RATE_LIMITED, "Too many proof requests. Please retry shortly.");
      const previewMode = !isLiveTxHash(input.walletAddress);
      const snapshot = seedSnapshot(input.walletAddress, input.sourceChain);
      if (!previewMode && !(await persistLoanSnapshot(snapshot))) throw proofLoanError(PROOFLOAN_ERROR_CODES.DATABASE, "Live Attestcoin applications require database persistence before state transitions.");
      await transitionLiveState(snapshot, "Intake", "EvidencePending", !previewMode);
      snapshot.audit.push(audit("EvidencePending", "Proof request dispatched to the Attestcoin proof worker through the Attestcoin Protocol USC SDK adapter."));
      await persistLiveSnapshot(snapshot, !previewMode);
      if (isLiveTxHash(input.walletAddress)) {
        let verified;
        try {
          verified = await verifyTransactionWithAttestcoin(input.walletAddress, input.sourceChain);
        } catch (error) {
          const detail = error instanceof Error ? error.message : "Attestcoin proof worker failed.";
          throw proofLoanError(PROOFLOAN_ERROR_CODES.PROOF_WORKER, detail);
        }
        if (!verified.verified) throw proofLoanError(PROOFLOAN_ERROR_CODES.PROOF_WORKER, "Attestcoin Protocol precompile verification returned false.");
        snapshot.facts = [{ id: `vf_${hashValue(verified)}`, chain: input.sourceChain, sourceBlock: verified.sourceBlock, txHash: verified.txHash, eventType: "REPAYMENT", amount: "1,250 USDC", asset: "USDC", verificationBlock: verified.verificationBlock, verifiedAt: now(), observedAt: now(), freshness: "Fresh", proofRoot: verified.proofRoot, proofWorker: "Attestcoin proof worker" }];
        snapshot.audit.push(audit("EvidencePending", "Official @gluwa/usc-sdk ProofBuilder and Creditcoin BlockProver completed the proof path."));
      } else {
        snapshot.facts = previewAttestcoinFacts(input.walletAddress, input.sourceChain);
        snapshot.audit.push(audit("EvidencePending", "Preview wallet profile routed through the typed Attestcoin Protocol adapter; provide a 32-byte transaction hash to run the live SDK path."));
      }
      snapshot.features = buildFeatureVector(snapshot.facts);
      await transitionLiveState(snapshot, "EvidencePending", "EvidenceVerified", !previewMode);
      snapshot.audit.push(audit("EvidenceVerified", `USC proof verified across ${snapshot.facts.length} typed facts. Evidence root ${hashValue(snapshot.facts.map(f => f.proofRoot))}.`));
      await persistLiveSnapshot(snapshot, !previewMode);
      snapshot.decision = await runAiUnderwriting(snapshot.features, snapshot.facts);
      await transitionLiveState(snapshot, "EvidenceVerified", "Scored", !previewMode);
      snapshot.audit.push(audit("Scored", `AI advisory score generated with ${(snapshot.decision.confidence * 100).toFixed(0)}% confidence.`));
      await persistLiveSnapshot(snapshot, !previewMode);
      snapshot.offer = evaluateRiskGuard(snapshot.decision, 1500);
      const offerState = snapshot.offer.status === "Blocked" ? "Rejected" : "OfferPrepared";
      await transitionLiveState(snapshot, "Scored", offerState, !previewMode);
      snapshot.audit.push(audit(snapshot.state, snapshot.offer.status === "Blocked" ? snapshot.offer.rejectionReason ?? "RiskGuard rejected the offer." : "RiskGuard approved a bounded offer; awaiting borrower acceptance."));
      if (snapshot.offer.status === "Ready") await transitionLiveState(snapshot, "OfferPrepared", "AwaitingAcceptance", !previewMode);
      await persistLiveSnapshot(snapshot, !previewMode);
      if (previewMode) storePreviewApplication(applications, snapshot);
      return snapshot;
    }),
    getApplication: publicProcedure.input(z.object({ applicationId: applicationIdInput })).query(async ({ input }) => (await getPersistedLoanSnapshot(input.applicationId)) ?? applications.get(input.applicationId) ?? null),
    acceptOffer: publicProcedure.input(z.object({ applicationId: applicationIdInput })).mutation(async ({ input }) => withApplicationMutation(input.applicationId, async () => {
      const persistedSnapshot = await getPersistedLoanSnapshot(input.applicationId);
      const snapshot = persistedSnapshot ?? applications.get(input.applicationId);
      const previewMode = !!snapshot && !isLiveTxHash(snapshot.walletAddress);
      if (!snapshot || (!persistedSnapshot && !previewMode) || !snapshot.offer || !isOfferAcceptable(snapshot.state, snapshot.offer.status)) throw proofLoanError(PROOFLOAN_ERROR_CODES.STATE_CONFLICT, "Offer is unavailable, expired, or already accepted.");
      snapshot.offer.status = "Executed";
      await transitionLiveState(snapshot, "AwaitingAcceptance", "Executed", !previewMode);
      snapshot.audit.push(audit("Executed", "Simulated Creditcoin testnet transaction submitted by the typed execution boundary."));
      await persistLiveSnapshot(snapshot, !previewMode);
      if (previewMode) storePreviewApplication(applications, snapshot);
      return { ...snapshot, transactionHash: `0xcreditcoin_${hashValue({ applicationId: snapshot.applicationId, at: Date.now() })}` };
    })),
  }),
});

export type AppRouter = typeof appRouter;
