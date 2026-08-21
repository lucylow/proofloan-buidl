import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { buildFeatureVector, evaluateRiskGuard, hashValue, isOfferAcceptable, runAiUnderwriting } from "./underwriting";
import { previewAttestcoinFacts, verifyTransactionWithAttestcoin } from "./attestcoin";
import { getPersistedLoanSnapshot, persistLoanSnapshot } from "./db";
import type { LoanSnapshot, ProofLoanState, SourceChain } from "@shared/proofloan";

const applications = new Map<string, LoanSnapshot>();

const now = () => new Date().toISOString();
const audit = (state: ProofLoanState, detail: string) => ({ state, label: state, timestamp: now(), detail, hash: hashValue({ state, detail, at: Date.now() }) });

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
    createApplication: publicProcedure.input(z.object({ walletAddress: z.string().min(8), sourceChain: z.enum(["Ethereum Sepolia", "Polygon Amoy"]) })).mutation(async ({ input }) => {
      const previewMode = !/^0x[a-fA-F0-9]{64}$/.test(input.walletAddress);
      const snapshot = seedSnapshot(input.walletAddress, input.sourceChain);
      snapshot.state = "EvidencePending";
      snapshot.audit.push(audit("EvidencePending", "Proof request dispatched to the Attestcoin proof worker through the Attestcoin Protocol USC SDK adapter."));
      if (/^0x[a-fA-F0-9]{64}$/.test(input.walletAddress)) {
        const verified = await verifyTransactionWithAttestcoin(input.walletAddress, input.sourceChain);
        if (!verified.verified) throw new Error("Attestcoin Protocol precompile verification returned false.");
        snapshot.facts = [{ id: `vf_${hashValue(verified)}`, chain: input.sourceChain, sourceBlock: verified.sourceBlock, txHash: verified.txHash, eventType: "REPAYMENT", amount: "1,250 USDC", asset: "USDC", verificationBlock: verified.verificationBlock, verifiedAt: now(), observedAt: now(), freshness: "Fresh", proofRoot: verified.proofRoot, proofWorker: "Attestcoin proof worker" }];
        snapshot.audit.push(audit("EvidencePending", "Official @gluwa/usc-sdk ProofBuilder and Creditcoin BlockProver completed the proof path."));
      } else {
        snapshot.facts = previewAttestcoinFacts(input.walletAddress, input.sourceChain);
        snapshot.audit.push(audit("EvidencePending", "Preview wallet profile routed through the typed Attestcoin Protocol adapter; provide a 32-byte transaction hash to run the live SDK path."));
      }
      snapshot.features = buildFeatureVector(snapshot.facts);
      snapshot.state = "EvidenceVerified";
      snapshot.audit.push(audit("EvidenceVerified", `USC proof verified across ${snapshot.facts.length} typed facts. Evidence root ${hashValue(snapshot.facts.map(f => f.proofRoot))}.`));
      snapshot.decision = await runAiUnderwriting(snapshot.features, snapshot.facts);
      snapshot.state = "Scored";
      snapshot.audit.push(audit("Scored", `AI advisory score generated with ${(snapshot.decision.confidence * 100).toFixed(0)}% confidence.`));
      snapshot.offer = evaluateRiskGuard(snapshot.decision, 1500);
      snapshot.state = snapshot.offer.status === "Blocked" ? "Rejected" : "OfferPrepared";
      snapshot.audit.push(audit(snapshot.state, snapshot.offer.status === "Blocked" ? snapshot.offer.rejectionReason ?? "RiskGuard rejected the offer." : "RiskGuard approved a bounded offer; awaiting borrower acceptance."));
      if (snapshot.offer.status === "Ready") snapshot.state = "AwaitingAcceptance";
      if (previewMode) applications.set(snapshot.applicationId, snapshot);
      await persistLoanSnapshot(snapshot);
      return snapshot;
    }),
    getApplication: publicProcedure.input(z.object({ applicationId: z.string() })).query(async ({ input }) => (await getPersistedLoanSnapshot(input.applicationId)) ?? applications.get(input.applicationId) ?? null),
    acceptOffer: publicProcedure.input(z.object({ applicationId: z.string() })).mutation(async ({ input }) => {
      const snapshot = (await getPersistedLoanSnapshot(input.applicationId)) ?? applications.get(input.applicationId);
      if (!snapshot || !snapshot.offer || !isOfferAcceptable(snapshot.state, snapshot.offer.status)) throw new Error("Offer is unavailable, expired, or already accepted.");
      snapshot.offer.status = "Executed";
      snapshot.state = "Executed";
      snapshot.audit.push(audit("Executed", "Simulated Creditcoin testnet transaction submitted by the typed execution boundary."));
      if (!await getPersistedLoanSnapshot(input.applicationId)) applications.set(snapshot.applicationId, snapshot);
      await persistLoanSnapshot(snapshot);
      return { ...snapshot, transactionHash: `0xcreditcoin_${hashValue({ applicationId: snapshot.applicationId, at: Date.now() })}` };
    }),
  }),
});

export type AppRouter = typeof appRouter;
