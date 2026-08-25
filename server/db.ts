import { createHash } from "node:crypto";
import { eq, and, asc, desc, lt, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, acceptanceIdempotency as acceptanceIdempotencyRecords, proofRequestIdempotency } from "../drizzle/schema";
import { ENV } from './_core/env';
import { isProofLoanApplicationId } from "@shared/proofloan";

let _db: ReturnType<typeof drizzle> | null = null;
const MAX_PERSISTED_FACTS = 64;
const MAX_PERSISTED_AUDIT_EVENTS = 128;
const MAX_PERSISTED_AUDIT_DETAIL_LENGTH = 512;
const MAX_PERSISTED_AUDIT_LABEL_LENGTH = 64;
const MAX_PERSISTED_AUDIT_HASH_LENGTH = 128;
const MAX_PERSISTED_FACT_ID_LENGTH = 64;
const MAX_PERSISTED_TX_HASH_LENGTH = 128;
const MAX_PERSISTED_AMOUNT_LENGTH = 64;
const MAX_PERSISTED_PROOF_ROOT_LENGTH = 128;
const MAX_PERSISTED_APPLICATION_ID_LENGTH = 64;
const MAX_PERSISTED_WALLET_LENGTH = 128;
const MAX_PERSISTED_DECISION_METADATA_LENGTH = 128;
const MAX_ACCEPTANCE_RESULT_LENGTH = 65_536;
const MAX_PROOF_REQUEST_RESULT_LENGTH = 65_536;
const MIN_REPLAY_REQUEST_KEY_LENGTH = 16;
const MAX_REPLAY_REQUEST_KEY_LENGTH = 128;

export function isCanonicalReplayRequestKey(value: unknown): value is string {
  return typeof value === "string" && value.length >= MIN_REPLAY_REQUEST_KEY_LENGTH && value.length <= MAX_REPLAY_REQUEST_KEY_LENGTH && value === value.trim() && !/[\u0000-\u001f\u007f]/.test(value);
}

export function isCanonicalUtcIsoTimestamp(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const parsed = new Date(value);
  return isValidDate(parsed) && parsed.toISOString() === value;
}
const REPLAY_PENDING_LEASE_MS = 10 * 60_000;
const REPLAY_COMMITTED_RETENTION_MS = 30 * 24 * 60 * 60_000;
const REPLAY_CLEANUP_INTERVAL_MS = 60_000;
let lastReplayCleanupAt = 0;

export type ReplayProtectionEvent = {
  operation: "proof_request" | "acceptance" | "cleanup";
  outcome: "claimed" | "pending" | "committed" | "conflict" | "reclaimed" | "cleaned" | "unavailable";
  requestKey?: string;
  applicationId?: string;
  removed?: number;
  reason?: "storage_unavailable" | "missing_record" | "invalid_result" | "cleanup_failed" | "write_failed";
};

function replayFingerprint(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 16);
}

export function recordReplayProtectionEvent(event: ReplayProtectionEvent): void {
  console.info(JSON.stringify({
    event: "proofloan.replay_protection",
    operation: event.operation,
    outcome: event.outcome,
    requestFingerprint: event.requestKey ? replayFingerprint(event.requestKey) : undefined,
    applicationFingerprint: event.applicationId ? replayFingerprint(event.applicationId) : undefined,
    removed: event.removed,
    reason: event.reason,
    timestamp: new Date().toISOString(),
  }));
}

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// TODO: add feature queries here as your schema grows.


import { loanApplications, verifiedFacts, decisions, offers, auditEvents } from "../drizzle/schema";
import type { LoanSnapshot } from "@shared/proofloan";

export function buildAuditUpsertValues(event: LoanSnapshot["audit"][number]) {
  if (typeof event.detail !== "string" || event.detail.length > MAX_PERSISTED_AUDIT_DETAIL_LENGTH) {
    throw new Error("Invalid persisted audit detail.");
  }
  if (!isProofLoanState(event.state) || event.label !== event.state || typeof event.hash !== "string" || event.hash !== event.hash.trim() || event.hash.length === 0 || event.hash.length > MAX_PERSISTED_AUDIT_HASH_LENGTH || typeof event.timestamp !== "string") {
    throw new Error("Invalid persisted audit event.");
  }
  const createdAt = new Date(event.timestamp);
  if (!isCanonicalUtcIsoTimestamp(event.timestamp)) throw new Error("Invalid persisted audit event.");
  return { values: { state: event.state, label: event.label, detail: event.detail, eventHash: event.hash, createdAt }, updateSet: { detail: event.detail, state: event.state, label: event.label, createdAt } };
}

export function buildApplicationUpsertValues(snapshot: LoanSnapshot) {
  if (snapshot.decision) buildDecisionUpsertValues(snapshot.decision);
  const requestedAmount = snapshot.offer?.amount ?? 1500;
  if (!isCanonicalNonEmptyText(snapshot.applicationId, MAX_PERSISTED_APPLICATION_ID_LENGTH) || !isProofLoanApplicationId(snapshot.applicationId) || !isCanonicalWalletAddress(snapshot.walletAddress) || !isSourceChain(snapshot.sourceChain) || !isProofLoanState(snapshot.state) || !isFiniteInRange(requestedAmount, 0.01, 2500)) {
    throw new Error("Invalid persisted application.");
  }
  return { applicationId: snapshot.applicationId, walletAddress: snapshot.walletAddress, sourceChain: snapshot.sourceChain, state: snapshot.state, requestedAmount: String(requestedAmount), evidenceRoot: snapshot.decision?.evidenceRoot, policyHash: snapshot.decision?.policyHash, modelVersion: snapshot.decision?.modelVersion, decisionHash: snapshot.decision?.decisionHash };
}

export function buildDecisionUpsertValues(decision: NonNullable<LoanSnapshot["decision"]>) {
  if ((decision.featureFingerprint !== undefined && (!/^[a-f0-9]{18}$/.test(decision.featureFingerprint) || decision.policyHash !== POLICY_HASH)) || !isCanonicalNonEmptyText(decision.featureVersion, MAX_PERSISTED_DECISION_METADATA_LENGTH) || !isCanonicalNonEmptyText(decision.modelVersion, MAX_PERSISTED_DECISION_METADATA_LENGTH) || !isCanonicalNonEmptyText(decision.policyHash, MAX_PERSISTED_DECISION_METADATA_LENGTH) || !isCanonicalNonEmptyText(decision.evidenceRoot, MAX_PERSISTED_DECISION_METADATA_LENGTH) || !isCanonicalNonEmptyText(decision.decisionHash, MAX_PERSISTED_DECISION_METADATA_LENGTH) || !parsePersistedReasonCodes(JSON.stringify(decision.reasonCodes)) || !isRiskTier(decision.riskTier) || !isFiniteInRange(decision.pd30, 0, 1) || !isFiniteInRange(decision.pd90, 0, 1) || !isProbabilityOrderConsistent(Number(decision.pd30), Number(decision.pd90)) || riskTierForPd30(Number(decision.pd30)) !== decision.riskTier || !isFiniteInRange(decision.confidence, 0, 1)) {
    throw new Error("Invalid persisted decision.");
  }
  return { pd30: String(decision.pd30), pd90: String(decision.pd90), confidence: String(decision.confidence), riskTier: decision.riskTier, reasonCodes: JSON.stringify(decision.reasonCodes), featureVersion: decision.featureVersion, modelVersion: decision.modelVersion, policyHash: decision.policyHash, evidenceRoot: decision.evidenceRoot, decisionHash: decision.decisionHash, featureFingerprint: decision.featureFingerprint };
}

export function buildOfferUpsertValues(offer: NonNullable<LoanSnapshot["offer"]>, applicationState: ProofLoanState, requestedAmount: number, now = Date.now()) {
  const expiresAt = new Date(offer.expiresAt);
  const collateralValue = offer.collateralValue ?? 2800;
  const poolLiquidity = offer.poolLiquidity ?? 250_000;
  if (!isCanonicalUtcIsoTimestamp(offer.expiresAt) || !isOfferStatus(offer.status) || !isOfferStateConsistent(applicationState, offer.status) || !isFiniteInRange(offer.amount, 0.01, 2500) || offer.amount !== requestedAmount || !isFiniteInRange(offer.apr, 0, 24) || !isFiniteInRange(offer.ltv, 0, 1) || !isFiniteInRange(collateralValue, 0.01, 1_000_000) || offer.ltv !== ltvForOfferAmount(offer.amount, collateralValue) || !isFiniteInRange(poolLiquidity, 0.01, 1_000_000_000) || poolLiquidity < offer.amount || !isFiniteInRange(offer.termDays, 1, 3650) || !isValidDate(expiresAt) || (offer.status === "Ready" && expiresAt.getTime() <= now)) {
    throw new Error("Invalid persisted offer.");
  }
  return { amount: String(offer.amount), apr: String(offer.apr), ltv: String(offer.ltv), collateralValue: String(collateralValue), poolLiquidity: String(poolLiquidity), termDays: offer.termDays, status: offer.status, expiresAt };
}

function hasUniqueFactIdentity(facts: Array<{ id?: unknown; chain?: unknown; txHash?: unknown; factId?: unknown }>): boolean {
  const ids = facts.map(fact => String(fact.id ?? fact.factId));
  const references = facts.map(fact => `${String(fact.chain)}:${String(fact.txHash)}`);
  return new Set(ids).size === ids.length && new Set(references).size === references.length;
}

export function isLoanSnapshotWriteConsistent(snapshot: LoanSnapshot): boolean {
  if (!Array.isArray(snapshot.audit) || snapshot.audit.length === 0) return false;
  return isFactStateConsistent(snapshot.state, snapshot.facts.length) && hasUniqueFactIdentity(snapshot.facts) && isDecisionStateConsistent(snapshot.state, Boolean(snapshot.decision)) && (!snapshot.decision || snapshot.decision.confidence <= snapshot.features.freshnessScore) && (!snapshot.decision?.featureFingerprint || !snapshot.offer || snapshot.offer.collateralValue !== undefined) && hasUniqueAuditHashes(snapshot.audit) && snapshot.audit[snapshot.audit.length - 1]?.state === snapshot.state && isAuditStateProgressionConsistent(snapshot.audit);
}

export function isLoanSnapshotPersistable(snapshot: LoanSnapshot, now = Date.now()): boolean {
  try {
    const applicationValues = buildApplicationUpsertValues(snapshot);
    for (const fact of snapshot.facts) buildFactUpsertValues(fact);
    if (snapshot.decision) buildDecisionUpsertValues(snapshot.decision);
    if (snapshot.offer) buildOfferUpsertValues(snapshot.offer, snapshot.state, Number(applicationValues.requestedAmount), now);
    for (const event of snapshot.audit) buildAuditUpsertValues(event);
    return true;
  } catch {
    return false;
  }
}

export function buildFactUpsertValues(fact: LoanSnapshot["facts"][number]) {
  const verifiedAt = new Date(fact.verifiedAt);
  const observedAt = new Date(fact.observedAt);
  if (!isCanonicalUtcIsoTimestamp(fact.verifiedAt) || !isCanonicalUtcIsoTimestamp(fact.observedAt) || observedAt.getTime() > verifiedAt.getTime() || !isCanonicalNonEmptyText(fact.id, MAX_PERSISTED_FACT_ID_LENGTH) || !isSourceChain(fact.chain) || !isVerifiedEventType(fact.eventType) || !isCanonicalNonEmptyText(fact.txHash, MAX_PERSISTED_TX_HASH_LENGTH) || !isCanonicalNonEmptyText(fact.amount, MAX_PERSISTED_AMOUNT_LENGTH) || !isCanonicalNonEmptyText(fact.proofRoot, MAX_PERSISTED_PROOF_ROOT_LENGTH) || !isFreshness(fact.freshness) || !isFactBlockChronologyConsistent(fact.sourceBlock, fact.verificationBlock) || !isValidDate(verifiedAt)) {
    throw new Error("Invalid persisted verified fact.");
  }
  return { values: { factId: fact.id, chain: fact.chain, sourceBlock: fact.sourceBlock, txHash: fact.txHash, eventType: fact.eventType, amount: fact.amount, verificationBlock: fact.verificationBlock, freshness: fact.freshness, proofRoot: fact.proofRoot, verifiedAt }, updateSet: { freshness: fact.freshness, verificationBlock: fact.verificationBlock } };
}

export function isDurableAcceptanceReplayResult(applicationId: string, result: unknown): result is LoanSnapshot & { transactionHash: string; receiptHash?: string } {
  if (!result || typeof result !== "object") return false;
  const candidate = result as { applicationId?: unknown; state?: unknown; transactionHash?: unknown; receiptHash?: unknown; offer?: Offer; decision?: Decision; audit?: Array<{ hash?: unknown; state?: unknown; label?: unknown; detail?: unknown; timestamp?: unknown }> };
  if (!isProofLoanApplicationId(applicationId) || typeof candidate.applicationId !== "string" || !isProofLoanApplicationId(candidate.applicationId) || candidate.applicationId !== applicationId || candidate.state !== "Executed" || typeof candidate.transactionHash !== "string" || candidate.transactionHash !== candidate.transactionHash.trim() || candidate.transactionHash.length === 0 || candidate.transactionHash.length > MAX_PERSISTED_TX_HASH_LENGTH || !Array.isArray(candidate.audit) || candidate.audit.length === 0) return false;
  if (candidate.offer !== undefined && candidate.decision !== undefined && candidate.receiptHash === undefined) return false;
  if (candidate.receiptHash === undefined) return true;
  if (typeof candidate.receiptHash !== "string" || !/^[a-f0-9]{18}$/.test(candidate.receiptHash) || !/^0xcreditcoin_[a-f0-9]{18}$/.test(candidate.transactionHash)) return false;
  if (!candidate.offer || typeof candidate.offer !== "object" || candidate.offer.status !== "Executed" || !candidate.decision || typeof candidate.decision !== "object" || typeof candidate.decision.decisionHash !== "string") return false;
  if (!isCanonicalNonEmptyText(candidate.decision.featureVersion, MAX_PERSISTED_DECISION_METADATA_LENGTH) || !isCanonicalNonEmptyText(candidate.decision.modelVersion, MAX_PERSISTED_DECISION_METADATA_LENGTH) || !isCanonicalNonEmptyText(candidate.decision.policyHash, MAX_PERSISTED_DECISION_METADATA_LENGTH) || !isCanonicalNonEmptyText(candidate.decision.evidenceRoot, MAX_PERSISTED_DECISION_METADATA_LENGTH) || !isCanonicalNonEmptyText(candidate.decision.decisionHash, MAX_PERSISTED_DECISION_METADATA_LENGTH) || !Array.isArray(candidate.decision.reasonCodes) || !parsePersistedReasonCodes(JSON.stringify(candidate.decision.reasonCodes)) || candidate.decision.decisionHash !== fingerprintDecision(candidate.decision)) return false;
  if ((candidate.decision.featureFingerprint !== undefined && (!/^[a-f0-9]{18}$/.test(candidate.decision.featureFingerprint) || candidate.decision.policyHash !== POLICY_HASH)) || !isRiskTier(candidate.decision.riskTier) || typeof candidate.decision.pd30 !== "number" || typeof candidate.decision.pd90 !== "number" || !isFiniteInRange(candidate.decision.pd30, 0, 1) || !isFiniteInRange(candidate.decision.pd90, 0, 1) || !isProbabilityOrderConsistent(candidate.decision.pd30, candidate.decision.pd90) || riskTierForPd30(candidate.decision.pd30) !== candidate.decision.riskTier || typeof candidate.decision.confidence !== "number" || typeof candidate.decision.freshnessScore !== "number" || !isFiniteInRange(candidate.decision.confidence, 0, 1) || !isFiniteInRange(candidate.decision.freshnessScore, 0, 1) || candidate.decision.confidence > candidate.decision.freshnessScore || typeof candidate.offer.amount !== "number" || typeof candidate.offer.apr !== "number" || typeof candidate.offer.ltv !== "number" || typeof candidate.offer.termDays !== "number" || typeof candidate.offer.poolLiquidity !== "number" || (candidate.offer.collateralValue !== undefined && typeof candidate.offer.collateralValue !== "number") || !isFiniteInRange(candidate.offer.amount, 0.01, 2500) || !isFiniteInRange(candidate.offer.apr, 0, 24) || candidate.offer.apr !== aprForRiskTier(candidate.decision.riskTier) || !isFiniteInRange(candidate.offer.ltv, 0, 1) || (candidate.offer.collateralValue !== undefined && (!isFiniteInRange(candidate.offer.collateralValue, 0.01, 1_000_000) || candidate.offer.ltv !== ltvForOfferAmount(candidate.offer.amount, candidate.offer.collateralValue))) || (candidate.decision.featureFingerprint !== undefined && (candidate.offer.collateralValue === undefined || candidate.offer.poolLiquidity === undefined)) || !isFiniteInRange(candidate.offer.termDays, 1, 3650) || !isCanonicalUtcIsoTimestamp(candidate.offer.expiresAt) || !isFiniteInRange(candidate.offer.poolLiquidity, 0.01, 1_000_000_000) || candidate.offer.poolLiquidity < candidate.offer.amount) return false;
  const auditTimestamps = candidate.audit.map(event => event.timestamp);
  if (!auditTimestamps.every(timestamp => isCanonicalUtcIsoTimestamp(timestamp))) return false;
  for (let index = 1; index < auditTimestamps.length; index += 1) {
    if (Date.parse(auditTimestamps[index] as string) < Date.parse(auditTimestamps[index - 1] as string)) return false;
  }
  if (!candidate.audit.every(event => typeof event.state === "string" && isProofLoanState(event.state) && typeof event.label === "string" && event.label === event.state && isBoundedNonEmptyText(event.detail, MAX_PERSISTED_AUDIT_DETAIL_LENGTH))) return false;
  if (!isAuditStateProgressionConsistent(candidate.audit as Array<{ state: string }>)) return false;
  const auditHashes = candidate.audit.map(event => event.hash);
  if (!auditHashes.every(hash => isCanonicalNonEmptyText(hash, MAX_PERSISTED_AUDIT_HASH_LENGTH))) return false;
  if (new Set(auditHashes).size !== auditHashes.length) return false;
  if (candidate.audit.slice(0, -1).some(event => event.state === "Executed")) return false;
  const terminalAudit = candidate.audit.at(-1);
  if (terminalAudit?.state !== "Executed") return false;
  if (Date.parse(terminalAudit.timestamp as string) >= Date.parse(candidate.offer.expiresAt)) return false;
  const auditHash = terminalAudit.hash;
  if (!isCanonicalNonEmptyText(auditHash, MAX_PERSISTED_AUDIT_HASH_LENGTH)) return false;
  return candidate.receiptHash === hashValue({ applicationId, offer: candidate.offer, decisionHash: candidate.decision.decisionHash, auditHash }) && candidate.transactionHash === `0xcreditcoin_${candidate.receiptHash}`;
}

export function isReplayRecordExpired(createdAt: Date, now = Date.now()): boolean {
  if (!(createdAt instanceof Date) || !Number.isFinite(createdAt.getTime()) || !Number.isFinite(now) || now < createdAt.getTime()) return false;
  return now - createdAt.getTime() > REPLAY_PENDING_LEASE_MS;
}

export async function cleanupReplayProtectionRecords(now = Date.now()): Promise<boolean> {
  if (!Number.isFinite(now)) {
    recordReplayProtectionEvent({ operation: "cleanup", outcome: "unavailable", reason: "cleanup_failed" });
    return false;
  }
  if (now - lastReplayCleanupAt < REPLAY_CLEANUP_INTERVAL_MS) return true;
  const db = await getDb();
  if (!db) return false;
  try {
    const pendingCutoff = new Date(now - REPLAY_PENDING_LEASE_MS);
    const committedCutoff = new Date(now - REPLAY_COMMITTED_RETENTION_MS);
    await db.delete(acceptanceIdempotencyRecords).where(lt(acceptanceIdempotencyRecords.createdAt, committedCutoff));
    await db.delete(proofRequestIdempotency).where(lt(proofRequestIdempotency.createdAt, committedCutoff));
    await db.delete(acceptanceIdempotencyRecords).where(and(eq(acceptanceIdempotencyRecords.status, "Pending"), lt(acceptanceIdempotencyRecords.createdAt, pendingCutoff)));
    await db.delete(proofRequestIdempotency).where(and(eq(proofRequestIdempotency.status, "Pending"), lt(proofRequestIdempotency.createdAt, pendingCutoff)));
    lastReplayCleanupAt = now;
    recordReplayProtectionEvent({ operation: "cleanup", outcome: "cleaned" });
    return true;
  } catch (error) {
    recordReplayProtectionEvent({ operation: "cleanup", outcome: "unavailable" });
    console.warn("[ProofLoan] Replay protection cleanup unavailable", error instanceof Error ? error.message : error);
    return false;
  }
}

export type ReplayRecoveryTarget = "acceptance" | "proof_request";

export type ReplayProtectionDiagnostics = {
  generatedAt: string;
  acceptance: { pending: number; stale: number };
  proofRequest: { pending: number; stale: number };
};

function boundedReplayCount(value: unknown): number {
  const count = Number(value);
  return Number.isFinite(count) ? Math.min(1_000_000, Math.max(0, Math.floor(count))) : 0;
}

export async function getReplayProtectionDiagnostics(dbOverride?: DatabaseClient): Promise<ReplayProtectionDiagnostics | null> {
  const db = dbOverride ?? await getDb();
  if (!db) return null;
  const staleBefore = new Date(Date.now() - REPLAY_PENDING_LEASE_MS);
  const [acceptancePending, acceptanceStale, proofPending, proofStale] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(acceptanceIdempotencyRecords).where(eq(acceptanceIdempotencyRecords.status, "Pending")),
    db.select({ count: sql<number>`count(*)` }).from(acceptanceIdempotencyRecords).where(and(eq(acceptanceIdempotencyRecords.status, "Pending"), lt(acceptanceIdempotencyRecords.createdAt, staleBefore))),
    db.select({ count: sql<number>`count(*)` }).from(proofRequestIdempotency).where(eq(proofRequestIdempotency.status, "Pending")),
    db.select({ count: sql<number>`count(*)` }).from(proofRequestIdempotency).where(and(eq(proofRequestIdempotency.status, "Pending"), lt(proofRequestIdempotency.createdAt, staleBefore))),
  ]);
  return {
    generatedAt: new Date().toISOString(),
    acceptance: { pending: boundedReplayCount(acceptancePending[0]?.count), stale: boundedReplayCount(acceptanceStale[0]?.count) },
    proofRequest: { pending: boundedReplayCount(proofPending[0]?.count), stale: boundedReplayCount(proofStale[0]?.count) },
  };
}

export async function refreshStaleReplayClaim(target: ReplayRecoveryTarget, requestKey: string, applicationId?: string, dbOverride?: DatabaseClient): Promise<boolean> {
  if (!isCanonicalReplayRequestKey(requestKey) || (target === "acceptance" && (!applicationId || !isProofLoanApplicationId(applicationId)))) return false;
  const db = dbOverride ?? await getDb();
  if (!db) {
    recordReplayProtectionEvent({ operation: target, outcome: "unavailable", requestKey, applicationId, reason: "storage_unavailable" });
    return false;
  }
  const staleBefore = new Date(Date.now() - REPLAY_PENDING_LEASE_MS);
  try {
    const updateResult = target === "acceptance"
      ? await db.update(acceptanceIdempotencyRecords).set({ createdAt: new Date(), status: "Pending" }).where(and(eq(acceptanceIdempotencyRecords.applicationId, applicationId ?? ""), eq(acceptanceIdempotencyRecords.requestKey, requestKey), eq(acceptanceIdempotencyRecords.status, "Pending"), lt(acceptanceIdempotencyRecords.createdAt, staleBefore)))
      : await db.update(proofRequestIdempotency).set({ createdAt: new Date(), status: "Pending" }).where(and(eq(proofRequestIdempotency.requestKey, requestKey), eq(proofRequestIdempotency.status, "Pending"), lt(proofRequestIdempotency.createdAt, staleBefore)));
    const recovered = hasExactlyOneReplayCommit(updateResult[0] ?? {});
    recordReplayProtectionEvent({ operation: target, outcome: recovered ? "reclaimed" : "unavailable", requestKey, applicationId, reason: recovered ? undefined : "write_failed" });
    return recovered;
  } catch (error) {
    recordReplayProtectionEvent({ operation: target, outcome: "unavailable", requestKey, applicationId, reason: "write_failed" });
    console.warn(`[ProofLoan] ${target} stale replay recovery unavailable`, error instanceof Error ? error.message : error);
    return false;
  }
}

export type AcceptanceReplayClaim =
  | { status: "claimed" }
  | { status: "pending" }
  | { status: "committed"; result: unknown }
  | { status: "conflict" }
  | { status: "unavailable" };

export async function claimAcceptanceReplay(applicationId: string, requestKey: string, dbOverride?: DatabaseClient): Promise<AcceptanceReplayClaim> {
  if (!isProofLoanApplicationId(applicationId) || !isCanonicalReplayRequestKey(requestKey)) return { status: "unavailable" };
  const db = dbOverride ?? await getDb();
  if (!db) {
    recordReplayProtectionEvent({ operation: "acceptance", outcome: "unavailable", requestKey, applicationId, reason: "storage_unavailable" });
    return { status: "unavailable" };
  }
  try {
    if (!dbOverride) await cleanupReplayProtectionRecords();
    await db.insert(acceptanceIdempotencyRecords).values({ applicationId, requestKey, status: "Pending" }).onDuplicateKeyUpdate({ set: { applicationId } });
    const row = await db.select().from(acceptanceIdempotencyRecords).where(eq(acceptanceIdempotencyRecords.applicationId, applicationId)).limit(1);
    if (!row[0]) {
      recordReplayProtectionEvent({ operation: "acceptance", outcome: "unavailable", requestKey, applicationId, reason: "missing_record" });
      return { status: "unavailable" };
    }
    if (row[0].requestKey !== requestKey) {
      recordReplayProtectionEvent({ operation: "acceptance", outcome: "conflict", requestKey, applicationId });
      return { status: "conflict" };
    }
    if (row[0].status === "Committed" && typeof row[0].resultJson === "string") {
      try {
        const result = JSON.parse(row[0].resultJson) as unknown;
        if (isDurableAcceptanceReplayResult(applicationId, result)) {
          recordReplayProtectionEvent({ operation: "acceptance", outcome: "committed", requestKey, applicationId });
          return { status: "committed", result };
        }
      } catch {
        recordReplayProtectionEvent({ operation: "acceptance", outcome: "unavailable", requestKey, applicationId, reason: "invalid_result" });
        return { status: "unavailable" };
      }
      recordReplayProtectionEvent({ operation: "acceptance", outcome: "unavailable", requestKey, applicationId, reason: "invalid_result" });
      return { status: "unavailable" };
    }
    if (row[0].status === "Pending") {
      if (isReplayRecordExpired(row[0].createdAt)) {
        if (!(await refreshStaleReplayClaim("acceptance", requestKey, applicationId, db))) return { status: "unavailable" };
        return { status: "claimed" };
      }
      recordReplayProtectionEvent({ operation: "acceptance", outcome: "pending", requestKey, applicationId });
      return { status: "pending" };
    }
    return { status: "unavailable" };
  } catch (error) {
    recordReplayProtectionEvent({ operation: "acceptance", outcome: "unavailable", requestKey, applicationId, reason: "storage_unavailable" });
    console.warn("[ProofLoan] Acceptance idempotency claim unavailable", error instanceof Error ? error.message : error);
    return { status: "unavailable" };
  }
}

export function hasExactlyOneReplayCommit(result: { affectedRows?: unknown }): boolean {
  return typeof result.affectedRows === "number" && Number.isFinite(result.affectedRows) && Number.isInteger(result.affectedRows) && result.affectedRows === 1;
}

export async function commitAcceptanceReplay(applicationId: string, requestKey: string, result: unknown, dbOverride?: DatabaseClient): Promise<boolean> {
  if (!isProofLoanApplicationId(applicationId) || !isCanonicalReplayRequestKey(requestKey)) return false;
  const db = dbOverride ?? await getDb();
  if (!db) return false;
  try {
    if (!isDurableAcceptanceReplayResult(applicationId, result)) return false;
    const resultJson = JSON.stringify(result);
    if (resultJson.length > MAX_ACCEPTANCE_RESULT_LENGTH) return false;
    const updateResult = await db.update(acceptanceIdempotencyRecords).set({ status: "Committed", resultJson }).where(and(eq(acceptanceIdempotencyRecords.applicationId, applicationId), eq(acceptanceIdempotencyRecords.requestKey, requestKey), eq(acceptanceIdempotencyRecords.status, "Pending")));
    const committed = hasExactlyOneReplayCommit(updateResult[0] ?? {});
    recordReplayProtectionEvent({ operation: "acceptance", outcome: committed ? "committed" : "unavailable", requestKey, applicationId, reason: committed ? undefined : "write_failed" });
    return committed;
  } catch (error) {
    recordReplayProtectionEvent({ operation: "acceptance", outcome: "unavailable", requestKey, applicationId, reason: "write_failed" });
    console.warn("[ProofLoan] Acceptance idempotency commit unavailable", error instanceof Error ? error.message : error);
    return false;
  }
}

export function isDurableProofRequestReplayResult(result: unknown): result is LoanSnapshot {
  if (!result || typeof result !== "object") return false;
  const candidate = result as { applicationId?: unknown; state?: unknown; facts?: unknown; audit?: unknown };
  return typeof candidate.applicationId === "string" && isProofLoanApplicationId(candidate.applicationId) && typeof candidate.state === "string" && candidate.state.length > 0 && Array.isArray(candidate.facts) && Array.isArray(candidate.audit) && candidate.audit.length > 0;
}

export type ProofRequestReplayClaim =
  | { status: "claimed" }
  | { status: "pending" }
  | { status: "committed"; result: unknown }
  | { status: "conflict" }
  | { status: "unavailable" };

export async function claimProofRequestReplay(requestKey: string, walletAddress: string, sourceChain: string, dbOverride?: DatabaseClient): Promise<ProofRequestReplayClaim> {
  if (!isCanonicalReplayRequestKey(requestKey)) return { status: "unavailable" };
  const db = dbOverride ?? await getDb();
  if (!db) {
    recordReplayProtectionEvent({ operation: "proof_request", outcome: "unavailable", requestKey, reason: "storage_unavailable" });
    return { status: "unavailable" };
  }
  try {
    if (!dbOverride) await cleanupReplayProtectionRecords();
    await db.insert(proofRequestIdempotency).values({ requestKey, walletAddress, sourceChain, status: "Pending" }).onDuplicateKeyUpdate({ set: { requestKey } });
    const row = await db.select().from(proofRequestIdempotency).where(eq(proofRequestIdempotency.requestKey, requestKey)).limit(1);
    if (!row[0]) {
      recordReplayProtectionEvent({ operation: "proof_request", outcome: "unavailable", requestKey, reason: "missing_record" });
      return { status: "unavailable" };
    }
    if (row[0].walletAddress !== walletAddress || row[0].sourceChain !== sourceChain) {
      recordReplayProtectionEvent({ operation: "proof_request", outcome: "conflict", requestKey });
      return { status: "conflict" };
    }
    if (row[0].status === "Committed" && typeof row[0].resultJson === "string") {
      try {
        const result = JSON.parse(row[0].resultJson) as unknown;
        if (isDurableProofRequestReplayResult(result)) {
          recordReplayProtectionEvent({ operation: "proof_request", outcome: "committed", requestKey, applicationId: result.applicationId });
          return { status: "committed", result };
        }
      } catch {
        recordReplayProtectionEvent({ operation: "proof_request", outcome: "unavailable", requestKey, reason: "invalid_result" });
        return { status: "unavailable" };
      }
      recordReplayProtectionEvent({ operation: "proof_request", outcome: "unavailable", requestKey, reason: "invalid_result" });
      return { status: "unavailable" };
    }
    if (row[0].status === "Pending") {
      if (isReplayRecordExpired(row[0].createdAt)) {
        if (!(await refreshStaleReplayClaim("proof_request", requestKey, undefined, db))) return { status: "unavailable" };
        return { status: "claimed" };
      }
      recordReplayProtectionEvent({ operation: "proof_request", outcome: "pending", requestKey });
      return { status: "pending" };
    }
    return { status: "unavailable" };
  } catch (error) {
    recordReplayProtectionEvent({ operation: "proof_request", outcome: "unavailable", requestKey, reason: "storage_unavailable" });
    console.warn("[ProofLoan] Proof-request idempotency claim unavailable", error instanceof Error ? error.message : error);
    return { status: "unavailable" };
  }
}

export async function commitProofRequestReplay(requestKey: string, applicationId: string, result: unknown, dbOverride?: DatabaseClient): Promise<boolean> {
  if (!isCanonicalReplayRequestKey(requestKey) || !isProofLoanApplicationId(applicationId)) return false;
  const db = dbOverride ?? await getDb();
  if (!db || !isDurableProofRequestReplayResult(result) || result.applicationId !== applicationId) return false;
  try {
    const resultJson = JSON.stringify(result);
    if (resultJson.length > MAX_PROOF_REQUEST_RESULT_LENGTH) return false;
    const updateResult = await db.update(proofRequestIdempotency).set({ applicationId, status: "Committed", resultJson }).where(and(eq(proofRequestIdempotency.requestKey, requestKey), eq(proofRequestIdempotency.status, "Pending")));
    const committed = hasExactlyOneReplayCommit(updateResult[0] ?? {});
    recordReplayProtectionEvent({ operation: "proof_request", outcome: committed ? "committed" : "unavailable", requestKey, applicationId, reason: committed ? undefined : "write_failed" });
    return committed;
  } catch (error) {
    recordReplayProtectionEvent({ operation: "proof_request", outcome: "unavailable", requestKey, applicationId, reason: "write_failed" });
    console.warn("[ProofLoan] Proof-request idempotency commit unavailable", error instanceof Error ? error.message : error);
    return false;
  }
}

type DatabaseClient = NonNullable<Awaited<ReturnType<typeof getDb>>>;

export async function persistLoanSnapshot(snapshot: LoanSnapshot, dbOverride?: DatabaseClient): Promise<boolean> {
  if (!isLoanSnapshotWriteConsistent(snapshot) || !isLoanSnapshotPersistable(snapshot)) return false;
  const db = dbOverride ?? await getDb();
  if (!db) return false;
  try {
    await db.transaction(async tx => {
      const applicationValues = buildApplicationUpsertValues(snapshot);
      await tx.insert(loanApplications).values(applicationValues).onDuplicateKeyUpdate({ set: { state: applicationValues.state, evidenceRoot: applicationValues.evidenceRoot, policyHash: applicationValues.policyHash, modelVersion: applicationValues.modelVersion, decisionHash: applicationValues.decisionHash } });

      for (const fact of snapshot.facts) {
        const factValues = buildFactUpsertValues(fact);
        await tx.insert(verifiedFacts).values({ applicationId: snapshot.applicationId, ...factValues.values }).onDuplicateKeyUpdate({ set: factValues.updateSet });
      }
      if (snapshot.decision) {
        const decisionValues = buildDecisionUpsertValues(snapshot.decision);
        const existingDecision = await tx.select({ id: decisions.id }).from(decisions).where(eq(decisions.applicationId, snapshot.applicationId)).orderBy(desc(decisions.id)).limit(1);
        if (existingDecision[0]) await tx.update(decisions).set(decisionValues).where(eq(decisions.id, existingDecision[0].id));
        else await tx.insert(decisions).values({ applicationId: snapshot.applicationId, ...decisionValues });
      }
      if (snapshot.offer) {
        const existingOffer = await tx.select({ id: offers.id }).from(offers).where(eq(offers.applicationId, snapshot.applicationId)).orderBy(desc(offers.id)).limit(1);
        const offerValues = buildOfferUpsertValues(snapshot.offer, snapshot.state, Number(applicationValues.requestedAmount), Date.now());
        if (existingOffer[0]) await tx.update(offers).set(offerValues).where(eq(offers.id, existingOffer[0].id));
        else await tx.insert(offers).values({ applicationId: snapshot.applicationId, ...offerValues });
      }
      for (const event of snapshot.audit) {
        const auditValues = buildAuditUpsertValues(event);
        await tx.insert(auditEvents).values({ applicationId: snapshot.applicationId, ...auditValues.values }).onDuplicateKeyUpdate({ set: auditValues.updateSet });
      }
    });
    return true;
  } catch (error) {
    console.warn("[ProofLoan] Persistence unavailable; keeping the active snapshot in memory for the demo.", error instanceof Error ? error.message : error);
    return false;
  }
}


import { buildFeatureVector, fingerprintDecision, fingerprintFeatureVector, hashValue, isFeatureVectorConsistentWithFacts, aprForRiskTier, isFeatureVectorFiniteAndBounded, ltvForOfferAmount, isProbabilityOrderConsistent, POLICY_HASH, riskTierForPd30 } from "./underwriting";
import { REASON_CODES, isFreshness, isOfferStatus, isProofLoanState, isReasonCode, isRiskTier, isSourceChain, isVerifiedEventType, type SourceChain, type VerifiedFact, type Decision, type Offer, type AuditEvent, type ProofLoanState } from "@shared/proofloan";

export type LoanTransitionResult = "committed" | "unavailable" | "conflict";

export async function transitionLoanState(applicationId: string, expectedState: ProofLoanState, nextState: ProofLoanState): Promise<LoanTransitionResult> {
  const db = await getDb();
  if (!db) return "unavailable";
  try {
    const result = await db.update(loanApplications).set({ state: nextState }).where(and(eq(loanApplications.applicationId, applicationId), eq(loanApplications.state, expectedState)));
    const affectedRows = Number((result as unknown as { affectedRows?: number }).affectedRows ?? 0);
    if (affectedRows === 1) return "committed";
    const current = await db.select({ state: loanApplications.state }).from(loanApplications).where(eq(loanApplications.applicationId, applicationId)).limit(1);
    if (!current[0]) return "unavailable";
    if (current[0].state === nextState) return "committed";
    if (current[0].state !== expectedState) return "conflict";
    return "unavailable";
  } catch (error) {
    console.warn("[ProofLoan] Database transition unavailable", error instanceof Error ? error.message : error);
    return "unavailable";
  }
}

const MAX_PERSISTED_REASON_CODES_LENGTH = 512;

export function parsePersistedReasonCodes(raw: unknown): Decision["reasonCodes"] | undefined {
  if (typeof raw !== "string" || raw.length > MAX_PERSISTED_REASON_CODES_LENGTH) return undefined;
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 && parsed.length <= REASON_CODES.length && parsed.every(code => typeof code === "string" && isReasonCode(code)) && new Set(parsed).size === parsed.length ? parsed : undefined;
  } catch {
    return undefined;
  }
}

type PersistedSnapshotValidationInput = {
  application: { applicationId?: unknown; walletAddress?: unknown; state: string; sourceChain: string; requestedAmount: unknown };
  facts: Array<{ factId?: unknown; chain: string; sourceBlock: unknown; txHash?: unknown; eventType: string; amount?: unknown; verificationBlock: unknown; freshness: string; proofRoot?: unknown; verifiedAt: unknown }>;
  decision?: { reasonCodes: unknown; riskTier: string; pd30: unknown; pd90: unknown; confidence: unknown; featureVersion?: unknown; modelVersion?: unknown; policyHash?: unknown; evidenceRoot?: unknown; decisionHash?: unknown; featureFingerprint?: unknown };
  offer?: { status: string; amount: unknown; apr: unknown; ltv: unknown; collateralValue?: unknown; poolLiquidity?: unknown; termDays: unknown; expiresAt: unknown };
  audit: Array<{ state: string; label?: unknown; detail?: unknown; eventHash?: unknown; createdAt: unknown }>;
};

const isFiniteInRange = (value: unknown, min: number, max: number) => {
  if (typeof value !== "number" && typeof value !== "string") return false;
  if (typeof value === "string" && (value.trim().length === 0 || value !== value.trim())) return false;
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= min && numeric <= max;
};

const isFactBlockChronologyConsistent = (sourceBlock: unknown, verificationBlock: unknown) => isFiniteInRange(sourceBlock, 1, Number.MAX_SAFE_INTEGER) && isFiniteInRange(verificationBlock, 1, Number.MAX_SAFE_INTEGER) && Number(verificationBlock) >= Number(sourceBlock);
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const isValidDate = (value: unknown): value is Date => value instanceof Date && !Number.isNaN(value.getTime());
const isBoundedText = (value: unknown, maxLength: number): value is string => typeof value === "string" && value.length <= maxLength;
const isBoundedNonEmptyText = (value: unknown, maxLength: number): value is string => isBoundedText(value, maxLength) && value.trim().length > 0;
const isCanonicalNonEmptyText = (value: unknown, maxLength: number): value is string => isBoundedNonEmptyText(value, maxLength) && value === value.trim();
const isCanonicalWalletAddress = (value: unknown): value is string => isCanonicalNonEmptyText(value, MAX_PERSISTED_WALLET_LENGTH) && !/[\u0000-\u001f\u007f]/.test(value);
const isOfferStateConsistent = (state: string, status: string) => (status === "Ready" && state === "AwaitingAcceptance") || (status === "Blocked" && state === "Rejected") || (status === "Executed" && state === "Executed");
const isOfferExpiryConsistent = (status: string, expiresAt: Date, now: number) => status !== "Ready" || expiresAt.getTime() > now;
const isDecisionStateConsistent = (state: string, hasDecision: boolean) => hasDecision ? ["Scored", "OfferPrepared", "AwaitingAcceptance", "Executed", "Rejected"].includes(state) : !["Scored", "OfferPrepared", "AwaitingAcceptance", "Executed", "Rejected"].includes(state);
const isFactStateConsistent = (state: string, factCount: number) => !["EvidenceVerified", "Scored", "OfferPrepared", "AwaitingAcceptance", "Executed", "Rejected"].includes(state) || factCount > 0;
const AUDIT_STATE_ORDER: Record<ProofLoanState, number> = { Intake: 0, EvidencePending: 1, EvidenceVerified: 2, Scored: 3, OfferPrepared: 4, AwaitingAcceptance: 5, Executed: 6, Rejected: 7 };
const hasUniqueAuditHashes = (audit: Array<{ hash?: unknown; eventHash?: unknown }>) => {
  const hashes = audit.map(event => String(event.hash ?? event.eventHash));
  return new Set(hashes).size === hashes.length;
};
const isAuditStateProgressionConsistent = (audit: Array<{ state: string }>) => audit.every((event, index) => {
  if (index === 0) return true;
  const previous = audit[index - 1].state as ProofLoanState;
  const current = event.state as ProofLoanState;
  if (previous === "Executed" || previous === "Rejected") return current === previous;
  return AUDIT_STATE_ORDER[current] >= AUDIT_STATE_ORDER[previous];
});

function isPersistedSnapshotValidUnsafe(input: PersistedSnapshotValidationInput): boolean {
  if (!Array.isArray(input.facts) || !Array.isArray(input.audit)) return false;
  if (!isRecord(input.application)) return false;
  if (input.facts.length > MAX_PERSISTED_FACTS || input.audit.length === 0 || input.audit.length > MAX_PERSISTED_AUDIT_EVENTS) return false;
  if (!isFactStateConsistent(input.application.state as string, input.facts.length)) return false;
  if (!isCanonicalNonEmptyText(input.application.applicationId, MAX_PERSISTED_APPLICATION_ID_LENGTH) || !isProofLoanApplicationId(input.application.applicationId) || !isCanonicalWalletAddress(input.application.walletAddress) || !isProofLoanState(input.application.state) || !isSourceChain(input.application.sourceChain) || !isFiniteInRange(input.application.requestedAmount, 0.01, 2500)) return false;
  const applicationRecord = input.application as Record<string, unknown>;
  if (applicationRecord.createdAt !== undefined && !isValidDate(applicationRecord.createdAt)) return false;
  if (applicationRecord.updatedAt !== undefined && !isValidDate(applicationRecord.updatedAt)) return false;
  if (applicationRecord.createdAt instanceof Date && applicationRecord.updatedAt instanceof Date && applicationRecord.updatedAt.getTime() < applicationRecord.createdAt.getTime()) return false;
  if (input.facts.some(fact => !isRecord(fact) || !isCanonicalNonEmptyText(fact.factId, MAX_PERSISTED_FACT_ID_LENGTH) || fact.chain !== input.application.sourceChain || !isSourceChain(fact.chain) || !isVerifiedEventType(fact.eventType) || !isCanonicalNonEmptyText(fact.txHash, MAX_PERSISTED_TX_HASH_LENGTH) || !isCanonicalNonEmptyText(fact.amount, MAX_PERSISTED_AMOUNT_LENGTH) || !isCanonicalNonEmptyText(fact.proofRoot, MAX_PERSISTED_PROOF_ROOT_LENGTH) || !isFreshness(fact.freshness) || !isFactBlockChronologyConsistent(fact.sourceBlock, fact.verificationBlock) || !isValidDate(fact.verifiedAt))) return false;
  const factIds = input.facts.map(fact => fact.factId);
  if (new Set(factIds).size !== factIds.length || !hasUniqueFactIdentity(input.facts)) return false;
  if (!isDecisionStateConsistent(input.application.state, Boolean(input.decision))) return false;
  if (input.decision && (!isRecord(input.decision) || !isCanonicalNonEmptyText(input.decision.featureVersion, MAX_PERSISTED_DECISION_METADATA_LENGTH) || !isCanonicalNonEmptyText(input.decision.modelVersion, MAX_PERSISTED_DECISION_METADATA_LENGTH) || (input.decision.featureFingerprint !== undefined && input.decision.policyHash !== POLICY_HASH) || !isCanonicalNonEmptyText(input.decision.policyHash, MAX_PERSISTED_DECISION_METADATA_LENGTH) || !isCanonicalNonEmptyText(input.decision.evidenceRoot, MAX_PERSISTED_DECISION_METADATA_LENGTH) || !isCanonicalNonEmptyText(input.decision.decisionHash, MAX_PERSISTED_DECISION_METADATA_LENGTH) || !parsePersistedReasonCodes(input.decision.reasonCodes) || !isRiskTier(input.decision.riskTier) || !isFiniteInRange(input.decision.pd30, 0, 1) || !isFiniteInRange(input.decision.pd90, 0, 1) || !isProbabilityOrderConsistent(Number(input.decision.pd30), Number(input.decision.pd90)) || riskTierForPd30(Number(input.decision.pd30)) !== input.decision.riskTier || !isFiniteInRange(input.decision.confidence, 0, 1))) return false;
  if (input.decision) {
    const mirroredDecisionFields = ["featureVersion", "modelVersion", "policyHash", "evidenceRoot", "decisionHash"] as const;
    const applicationRecord = input.application as Record<string, unknown>;
    const decisionRecord = input.decision as Record<string, unknown>;
    if (mirroredDecisionFields.some(field => applicationRecord[field] !== undefined && applicationRecord[field] !== decisionRecord[field])) return false;
  }
  if (input.offer && (!input.decision || !isRecord(input.offer) || !isOfferStatus(input.offer.status) || !isOfferStateConsistent(input.application.state, input.offer.status) || !isFiniteInRange(input.offer.amount, 0.01, 2500) || Number(input.application.requestedAmount) !== Number(input.offer.amount) || !isFiniteInRange(input.offer.apr, 0, 24) || !input.decision || Number(input.offer.apr) !== aprForRiskTier(input.decision.riskTier as Decision["riskTier"]) || !isFiniteInRange(input.offer.ltv, 0, 1) || (input.decision.featureFingerprint !== undefined && (input.offer.collateralValue === undefined || input.offer.poolLiquidity === undefined)) || !isFiniteInRange(input.offer.collateralValue ?? 2800, 0.01, 1_000_000) || Number(input.offer.ltv) !== ltvForOfferAmount(Number(input.application.requestedAmount), Number(input.offer.collateralValue ?? 2800)) || !isFiniteInRange(input.offer.poolLiquidity ?? 250_000, 0.01, 1_000_000_000) || Number(input.offer.poolLiquidity ?? 250_000) < Number(input.offer.amount) || !isFiniteInRange(input.offer.termDays, 1, 3650) || !(input.offer.expiresAt instanceof Date) || Number.isNaN(input.offer.expiresAt.getTime()))) return false;
  if (!input.audit.every(event => isRecord(event) && isProofLoanState(event.state) && isValidDate(event.createdAt) && isBoundedNonEmptyText(event.label, MAX_PERSISTED_AUDIT_LABEL_LENGTH) && event.label === event.state && isCanonicalNonEmptyText(event.eventHash, MAX_PERSISTED_AUDIT_HASH_LENGTH) && isBoundedNonEmptyText(event.detail, MAX_PERSISTED_AUDIT_DETAIL_LENGTH))) return false;
  if (!isAuditStateProgressionConsistent(input.audit)) return false;
  const lastAuditState = input.audit.length ? (input.audit[input.audit.length - 1] as { state?: unknown }).state : undefined;
  if (lastAuditState !== input.application.state) return false;
  const terminalAudit = input.audit.at(-1);
  const terminalAuditTime = terminalAudit?.createdAt instanceof Date ? terminalAudit.createdAt.getTime() : Number.NaN;
  if (!Number.isFinite(terminalAuditTime)) return false;
  if (input.facts.some(fact => fact.verifiedAt instanceof Date && fact.verifiedAt.getTime() > terminalAuditTime)) return false;
  if (input.offer?.status === "Executed") {
    if (!(input.offer.expiresAt instanceof Date) || input.offer.expiresAt.getTime() <= terminalAuditTime) return false;
  }
  const auditHashes = input.audit.map(event => event.eventHash);
  if (new Set(auditHashes).size !== auditHashes.length) return false;
  const auditTimes = input.audit.map(event => event.createdAt instanceof Date ? event.createdAt.getTime() : Number.NaN);
  return auditTimes.every((time, index) => Number.isFinite(time) && (index === 0 || time >= auditTimes[index - 1]));
}

export function isPersistedSnapshotValid(input: PersistedSnapshotValidationInput, expectedApplicationId?: string, now = Date.now()): boolean {
  try {
    if (!Number.isFinite(now)) return false;
    if (expectedApplicationId !== undefined && input.application.applicationId !== expectedApplicationId) return false;
    if (input.offer && input.offer.expiresAt instanceof Date && isOfferStatus(input.offer.status) && !isOfferExpiryConsistent(input.offer.status, input.offer.expiresAt, now)) return false;
    if (Array.isArray(input.facts) && input.facts.some(fact => fact.verifiedAt instanceof Date && fact.verifiedAt.getTime() > now)) return false;
    if (Array.isArray(input.audit) && input.audit.some(event => event.createdAt instanceof Date && event.createdAt.getTime() > now)) return false;
    return isPersistedSnapshotValidUnsafe(input);
  } catch {
    return false;
  }
}

export async function getPersistedLoanSnapshot(applicationId: string, dbOverride?: DatabaseClient): Promise<LoanSnapshot | undefined> {
  if (!isProofLoanApplicationId(applicationId)) return undefined;
  const db = dbOverride ?? await getDb();
  if (!db) return undefined;
  try {
    const applicationRows = await db.select().from(loanApplications).where(eq(loanApplications.applicationId, applicationId)).limit(2);
    if (applicationRows.length !== 1) return undefined;
    const application = applicationRows[0];
    const factRows = await db.select().from(verifiedFacts).where(eq(verifiedFacts.applicationId, applicationId)).orderBy(asc(verifiedFacts.id));
    const decisionRows = await db.select().from(decisions).where(eq(decisions.applicationId, applicationId)).orderBy(desc(decisions.id)).limit(2);
    const offerRows = await db.select().from(offers).where(eq(offers.applicationId, applicationId)).orderBy(desc(offers.id)).limit(2);
    if (decisionRows.length > 1 || offerRows.length > 1) return undefined;
    const auditRows = await db.select().from(auditEvents).where(eq(auditEvents.applicationId, applicationId)).orderBy(asc(auditEvents.id));
    const childRows = [...factRows, ...decisionRows, ...offerRows, ...auditRows] as Array<{ applicationId?: unknown }>;
    if (childRows.some(row => row.applicationId !== applicationId)) return undefined;
    const applicationRecord = application as { createdAt?: unknown; updatedAt?: unknown };
    const firstAuditRow = auditRows[0];
    if (applicationRecord.createdAt !== undefined && !isValidDate(applicationRecord.createdAt)) return undefined;
    if (applicationRecord.updatedAt !== undefined && !isValidDate(applicationRecord.updatedAt)) return undefined;
    if (applicationRecord.createdAt instanceof Date && firstAuditRow?.createdAt instanceof Date && applicationRecord.createdAt.getTime() > firstAuditRow.createdAt.getTime()) return undefined;
    if (applicationRecord.createdAt instanceof Date && applicationRecord.updatedAt instanceof Date && applicationRecord.updatedAt.getTime() < applicationRecord.createdAt.getTime()) return undefined;
    const terminalAuditRow = auditRows.at(-1);
    if (terminalAuditRow?.createdAt instanceof Date) {
      const terminalAuditTime = terminalAuditRow.createdAt.getTime();
      if (applicationRecord.updatedAt instanceof Date && applicationRecord.updatedAt.getTime() > terminalAuditTime) return undefined;
      const timedChildRows = [...decisionRows, ...offerRows] as Array<{ createdAt?: unknown }>;
      if (timedChildRows.some(row => row.createdAt instanceof Date && (!Number.isFinite(row.createdAt.getTime()) || row.createdAt.getTime() > terminalAuditTime))) return undefined;
    }
    if (!isPersistedSnapshotValid({ application, facts: factRows, decision: decisionRows[0], offer: offerRows[0], audit: auditRows }, applicationId)) return undefined;
    if (!isProofLoanState(application.state) || !isSourceChain(application.sourceChain)) return undefined;
    const facts: VerifiedFact[] = factRows.map(fact => {
      if (!isSourceChain(fact.chain) || !isVerifiedEventType(fact.eventType) || !isFreshness(fact.freshness)) throw new Error(`Invalid persisted fact enum for ${fact.factId}.`);
      return { id: fact.factId, chain: fact.chain, sourceBlock: fact.sourceBlock, txHash: fact.txHash, eventType: fact.eventType, amount: fact.amount, asset: "USDC", verificationBlock: fact.verificationBlock, verifiedAt: fact.verifiedAt.toISOString(), observedAt: fact.verifiedAt.toISOString(), freshness: fact.freshness, proofRoot: fact.proofRoot, proofWorker: "Attestcoin proof worker" };
    });
    const decisionRow = decisionRows[0];
    let decision: Decision | undefined;
    if (decisionRow) {
      const parsedReasonCodes = parsePersistedReasonCodes(decisionRow.reasonCodes);
      if (!parsedReasonCodes || !isRiskTier(decisionRow.riskTier)) return undefined;
      const riskTier = decisionRow.riskTier;
      decision = { pd30: Number(decisionRow.pd30), pd90: Number(decisionRow.pd90), confidence: Number(decisionRow.confidence), freshnessScore: facts.length ? facts.filter(f => f.freshness === "Fresh").length / facts.length : 0, riskTier, reasonCodes: parsedReasonCodes, featureVersion: decisionRow.featureVersion, modelVersion: decisionRow.modelVersion, policyHash: decisionRow.policyHash, evidenceRoot: decisionRow.evidenceRoot, decisionHash: decisionRow.decisionHash, featureFingerprint: decisionRow.featureFingerprint ?? undefined };
    }
    const offerRow = offerRows[0];
    const offerStatus: Offer["status"] | undefined = offerRow && isOfferStatus(offerRow.status) ? offerRow.status : undefined;
    if (decision?.featureFingerprint !== undefined && offerRow && (offerRow.collateralValue === null || offerRow.collateralValue === undefined || offerRow.poolLiquidity === null || offerRow.poolLiquidity === undefined)) return undefined;
    const offer: Offer | undefined = offerRow && offerStatus ? { amount: Number(offerRow.amount), apr: Number(offerRow.apr), ltv: Number(offerRow.ltv), collateralValue: offerRow.collateralValue === null || offerRow.collateralValue === undefined ? undefined : Number(offerRow.collateralValue), poolLiquidity: Number(offerRow.poolLiquidity ?? 250000), termDays: offerRow.termDays, expiresAt: offerRow.expiresAt.toISOString(), status: offerStatus } : undefined;
    const audit: AuditEvent[] = auditRows.map(event => ({ state: event.state as AuditEvent["state"], label: event.label, timestamp: event.createdAt.toISOString(), detail: event.detail, hash: event.eventHash }));
    const reconstructionNow = Date.now();
    if (decision && decision.evidenceRoot !== hashValue(facts.map(fact => fact.proofRoot))) return undefined;
    const features = buildFeatureVector(facts, reconstructionNow);
    if (!isFeatureVectorFiniteAndBounded(features) || !isFeatureVectorConsistentWithFacts(features, facts, reconstructionNow)) return undefined;
    if (decision) decision = { ...decision, freshnessScore: features.freshnessScore };
    if (decision && decision.confidence > features.freshnessScore) return undefined;
        if (decision?.featureFingerprint !== undefined && decision.featureFingerprint !== fingerprintFeatureVector(features)) return undefined;
    if (decision?.featureFingerprint !== undefined && decision.decisionHash !== fingerprintDecision(decision)) return undefined;
    return { applicationId, walletAddress: application.walletAddress, sourceChain: application.sourceChain, state: application.state, facts, features, decision, offer, audit };
  } catch (error) {
    console.warn("[ProofLoan] Database read unavailable; using active in-memory snapshot.", error instanceof Error ? error.message : error);
    return undefined;
  }
}
