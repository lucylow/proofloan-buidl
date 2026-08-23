import { eq, and, asc, desc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users } from "../drizzle/schema";
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
  if (Number.isNaN(createdAt.getTime())) throw new Error("Invalid persisted audit event.");
  return { values: { state: event.state, label: event.label, detail: event.detail, eventHash: event.hash, createdAt }, updateSet: { detail: event.detail, state: event.state, label: event.label, createdAt } };
}

export function buildApplicationUpsertValues(snapshot: LoanSnapshot) {
  const requestedAmount = snapshot.offer?.amount ?? 1500;
  if (!isCanonicalNonEmptyText(snapshot.applicationId, MAX_PERSISTED_APPLICATION_ID_LENGTH) || !isProofLoanApplicationId(snapshot.applicationId) || !isCanonicalNonEmptyText(snapshot.walletAddress, MAX_PERSISTED_WALLET_LENGTH) || !isSourceChain(snapshot.sourceChain) || !isProofLoanState(snapshot.state) || !isFiniteInRange(requestedAmount, 0.01, 2500)) {
    throw new Error("Invalid persisted application.");
  }
  return { applicationId: snapshot.applicationId, walletAddress: snapshot.walletAddress, sourceChain: snapshot.sourceChain, state: snapshot.state, requestedAmount: String(requestedAmount), evidenceRoot: snapshot.decision?.evidenceRoot, policyHash: snapshot.decision?.policyHash, modelVersion: snapshot.decision?.modelVersion, decisionHash: snapshot.decision?.decisionHash };
}

export function buildDecisionUpsertValues(decision: NonNullable<LoanSnapshot["decision"]>) {
  if (!isCanonicalNonEmptyText(decision.featureVersion, MAX_PERSISTED_DECISION_METADATA_LENGTH) || !isCanonicalNonEmptyText(decision.modelVersion, MAX_PERSISTED_DECISION_METADATA_LENGTH) || !isCanonicalNonEmptyText(decision.policyHash, MAX_PERSISTED_DECISION_METADATA_LENGTH) || !isCanonicalNonEmptyText(decision.evidenceRoot, MAX_PERSISTED_DECISION_METADATA_LENGTH) || !isCanonicalNonEmptyText(decision.decisionHash, MAX_PERSISTED_DECISION_METADATA_LENGTH) || !parsePersistedReasonCodes(JSON.stringify(decision.reasonCodes)) || !isRiskTier(decision.riskTier) || !isFiniteInRange(decision.pd30, 0, 1) || !isFiniteInRange(decision.pd90, 0, 1) || Number(decision.pd30) > Number(decision.pd90) || !isFiniteInRange(decision.confidence, 0, 1)) {
    throw new Error("Invalid persisted decision.");
  }
  return { pd30: String(decision.pd30), pd90: String(decision.pd90), confidence: String(decision.confidence), riskTier: decision.riskTier, reasonCodes: JSON.stringify(decision.reasonCodes), featureVersion: decision.featureVersion, modelVersion: decision.modelVersion, policyHash: decision.policyHash, evidenceRoot: decision.evidenceRoot, decisionHash: decision.decisionHash };
}

export function buildOfferUpsertValues(offer: NonNullable<LoanSnapshot["offer"]>, applicationState: ProofLoanState, requestedAmount: number, now = Date.now()) {
  const expiresAt = new Date(offer.expiresAt);
  if (!isOfferStatus(offer.status) || !isOfferStateConsistent(applicationState, offer.status) || !isFiniteInRange(offer.amount, 0.01, 2500) || offer.amount !== requestedAmount || !isFiniteInRange(offer.apr, 0, 24) || !isFiniteInRange(offer.ltv, 0, 1) || !isFiniteInRange(offer.termDays, 1, 3650) || !isValidDate(expiresAt) || (offer.status === "Ready" && expiresAt.getTime() <= now)) {
    throw new Error("Invalid persisted offer.");
  }
  return { amount: String(offer.amount), apr: String(offer.apr), ltv: String(offer.ltv), termDays: offer.termDays, status: offer.status, expiresAt };
}

function hasUniqueFactReferences(facts: Array<{ chain?: unknown; txHash?: unknown }>): boolean {
  const references = facts.map(fact => `${String(fact.chain)}:${String(fact.txHash)}`);
  return new Set(references).size === references.length;
}

export function isLoanSnapshotWriteConsistent(snapshot: LoanSnapshot): boolean {
  if (!Array.isArray(snapshot.audit) || snapshot.audit.length === 0) return false;
  return isFactStateConsistent(snapshot.state, snapshot.facts.length) && hasUniqueFactReferences(snapshot.facts) && isDecisionStateConsistent(snapshot.state, Boolean(snapshot.decision)) && snapshot.audit[snapshot.audit.length - 1]?.state === snapshot.state && isAuditStateProgressionConsistent(snapshot.audit);
}

export function buildFactUpsertValues(fact: LoanSnapshot["facts"][number]) {
  const verifiedAt = new Date(fact.verifiedAt);
  if (!isCanonicalNonEmptyText(fact.id, MAX_PERSISTED_FACT_ID_LENGTH) || !isSourceChain(fact.chain) || !isVerifiedEventType(fact.eventType) || !isCanonicalNonEmptyText(fact.txHash, MAX_PERSISTED_TX_HASH_LENGTH) || !isCanonicalNonEmptyText(fact.amount, MAX_PERSISTED_AMOUNT_LENGTH) || !isCanonicalNonEmptyText(fact.proofRoot, MAX_PERSISTED_PROOF_ROOT_LENGTH) || !isFreshness(fact.freshness) || !isFiniteInRange(fact.sourceBlock, 1, Number.MAX_SAFE_INTEGER) || !isFiniteInRange(fact.verificationBlock, 1, Number.MAX_SAFE_INTEGER) || fact.verificationBlock < fact.sourceBlock || !isValidDate(verifiedAt)) {
    throw new Error("Invalid persisted verified fact.");
  }
  return { values: { factId: fact.id, chain: fact.chain, sourceBlock: fact.sourceBlock, txHash: fact.txHash, eventType: fact.eventType, amount: fact.amount, verificationBlock: fact.verificationBlock, freshness: fact.freshness, proofRoot: fact.proofRoot, verifiedAt }, updateSet: { freshness: fact.freshness, verificationBlock: fact.verificationBlock } };
}

type DatabaseClient = NonNullable<Awaited<ReturnType<typeof getDb>>>;

export async function persistLoanSnapshot(snapshot: LoanSnapshot, dbOverride?: DatabaseClient): Promise<boolean> {
  if (!isLoanSnapshotWriteConsistent(snapshot)) return false;
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


import { buildFeatureVector } from "./underwriting";
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
  decision?: { reasonCodes: unknown; riskTier: string; pd30: unknown; pd90: unknown; confidence: unknown; featureVersion?: unknown; modelVersion?: unknown; policyHash?: unknown; evidenceRoot?: unknown; decisionHash?: unknown };
  offer?: { status: string; amount: unknown; apr: unknown; ltv: unknown; termDays: unknown; expiresAt: unknown };
  audit: Array<{ state: string; label?: unknown; detail?: unknown; eventHash?: unknown; createdAt: unknown }>;
};

const isFiniteInRange = (value: unknown, min: number, max: number) => {
  if (typeof value !== "number" && typeof value !== "string") return false;
  if (typeof value === "string" && (value.trim().length === 0 || value !== value.trim())) return false;
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= min && numeric <= max;
};

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const isValidDate = (value: unknown): value is Date => value instanceof Date && !Number.isNaN(value.getTime());
const isBoundedText = (value: unknown, maxLength: number): value is string => typeof value === "string" && value.length <= maxLength;
const isBoundedNonEmptyText = (value: unknown, maxLength: number): value is string => isBoundedText(value, maxLength) && value.trim().length > 0;
const isCanonicalNonEmptyText = (value: unknown, maxLength: number): value is string => isBoundedNonEmptyText(value, maxLength) && value === value.trim();
const isOfferStateConsistent = (state: string, status: string) => (status === "Ready" && state === "AwaitingAcceptance") || (status === "Blocked" && state === "Rejected") || (status === "Executed" && state === "Executed");
const isOfferExpiryConsistent = (status: string, expiresAt: Date, now: number) => status !== "Ready" || expiresAt.getTime() > now;
const isDecisionStateConsistent = (state: string, hasDecision: boolean) => hasDecision ? ["Scored", "OfferPrepared", "AwaitingAcceptance", "Executed", "Rejected"].includes(state) : !["Scored", "OfferPrepared", "AwaitingAcceptance", "Executed", "Rejected"].includes(state);
const isFactStateConsistent = (state: string, factCount: number) => !["EvidenceVerified", "Scored", "OfferPrepared", "AwaitingAcceptance", "Executed", "Rejected"].includes(state) || factCount > 0;
const AUDIT_STATE_ORDER: Record<ProofLoanState, number> = { Intake: 0, EvidencePending: 1, EvidenceVerified: 2, Scored: 3, OfferPrepared: 4, AwaitingAcceptance: 5, Executed: 6, Rejected: 7 };
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
  if (!isCanonicalNonEmptyText(input.application.applicationId, MAX_PERSISTED_APPLICATION_ID_LENGTH) || !isProofLoanApplicationId(input.application.applicationId) || !isCanonicalNonEmptyText(input.application.walletAddress, MAX_PERSISTED_WALLET_LENGTH) || !isProofLoanState(input.application.state) || !isSourceChain(input.application.sourceChain) || !isFiniteInRange(input.application.requestedAmount, 0.01, 2500)) return false;
  if (input.facts.some(fact => !isRecord(fact) || !isCanonicalNonEmptyText(fact.factId, MAX_PERSISTED_FACT_ID_LENGTH) || !isSourceChain(fact.chain) || !isVerifiedEventType(fact.eventType) || !isCanonicalNonEmptyText(fact.txHash, MAX_PERSISTED_TX_HASH_LENGTH) || !isCanonicalNonEmptyText(fact.amount, MAX_PERSISTED_AMOUNT_LENGTH) || !isCanonicalNonEmptyText(fact.proofRoot, MAX_PERSISTED_PROOF_ROOT_LENGTH) || !isFreshness(fact.freshness) || !isFiniteInRange(fact.sourceBlock, 1, Number.MAX_SAFE_INTEGER) || !isFiniteInRange(fact.verificationBlock, 1, Number.MAX_SAFE_INTEGER) || Number(fact.verificationBlock) < Number(fact.sourceBlock) || !isValidDate(fact.verifiedAt))) return false;
  const factIds = input.facts.map(fact => fact.factId);
  if (new Set(factIds).size !== factIds.length || !hasUniqueFactReferences(input.facts)) return false;
  if (!isDecisionStateConsistent(input.application.state, Boolean(input.decision))) return false;
  if (input.decision && (!isRecord(input.decision) || !isCanonicalNonEmptyText(input.decision.featureVersion, MAX_PERSISTED_DECISION_METADATA_LENGTH) || !isCanonicalNonEmptyText(input.decision.modelVersion, MAX_PERSISTED_DECISION_METADATA_LENGTH) || !isCanonicalNonEmptyText(input.decision.policyHash, MAX_PERSISTED_DECISION_METADATA_LENGTH) || !isCanonicalNonEmptyText(input.decision.evidenceRoot, MAX_PERSISTED_DECISION_METADATA_LENGTH) || !isCanonicalNonEmptyText(input.decision.decisionHash, MAX_PERSISTED_DECISION_METADATA_LENGTH) || !parsePersistedReasonCodes(input.decision.reasonCodes) || !isRiskTier(input.decision.riskTier) || !isFiniteInRange(input.decision.pd30, 0, 1) || !isFiniteInRange(input.decision.pd90, 0, 1) || Number(input.decision.pd30) > Number(input.decision.pd90) || !isFiniteInRange(input.decision.confidence, 0, 1))) return false;
  if (input.decision) {
    const mirroredDecisionFields = ["featureVersion", "modelVersion", "policyHash", "evidenceRoot", "decisionHash"] as const;
    const applicationRecord = input.application as Record<string, unknown>;
    const decisionRecord = input.decision as Record<string, unknown>;
    if (mirroredDecisionFields.some(field => applicationRecord[field] !== undefined && applicationRecord[field] !== decisionRecord[field])) return false;
  }
  if (input.offer && (!input.decision || !isRecord(input.offer) || !isOfferStatus(input.offer.status) || !isOfferStateConsistent(input.application.state, input.offer.status) || !isFiniteInRange(input.offer.amount, 0.01, 2500) || Number(input.application.requestedAmount) !== Number(input.offer.amount) || !isFiniteInRange(input.offer.apr, 0, 24) || !isFiniteInRange(input.offer.ltv, 0, 1) || !isFiniteInRange(input.offer.termDays, 1, 3650) || !(input.offer.expiresAt instanceof Date) || Number.isNaN(input.offer.expiresAt.getTime()))) return false;
  if (!input.audit.every(event => isRecord(event) && isProofLoanState(event.state) && isValidDate(event.createdAt) && isBoundedNonEmptyText(event.label, MAX_PERSISTED_AUDIT_LABEL_LENGTH) && event.label === event.state && isCanonicalNonEmptyText(event.eventHash, MAX_PERSISTED_AUDIT_HASH_LENGTH) && isBoundedText(event.detail, MAX_PERSISTED_AUDIT_DETAIL_LENGTH))) return false;
  if (!isAuditStateProgressionConsistent(input.audit)) return false;
  const lastAuditState = input.audit.length ? (input.audit[input.audit.length - 1] as { state?: unknown }).state : undefined;
  if (lastAuditState !== input.application.state) return false;
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

export async function getPersistedLoanSnapshot(applicationId: string): Promise<LoanSnapshot | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  try {
    const applicationRows = await db.select().from(loanApplications).where(eq(loanApplications.applicationId, applicationId)).limit(1);
    const application = applicationRows[0];
    if (!application) return undefined;
    const factRows = await db.select().from(verifiedFacts).where(eq(verifiedFacts.applicationId, applicationId)).orderBy(asc(verifiedFacts.id));
    const decisionRows = await db.select().from(decisions).where(eq(decisions.applicationId, applicationId)).orderBy(desc(decisions.id)).limit(1);
    const offerRows = await db.select().from(offers).where(eq(offers.applicationId, applicationId)).orderBy(desc(offers.id)).limit(1);
    const auditRows = await db.select().from(auditEvents).where(eq(auditEvents.applicationId, applicationId)).orderBy(asc(auditEvents.id));
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
      decision = { pd30: Number(decisionRow.pd30), pd90: Number(decisionRow.pd90), confidence: Number(decisionRow.confidence), freshnessScore: facts.length ? facts.filter(f => f.freshness === "Fresh").length / facts.length : 0, riskTier, reasonCodes: parsedReasonCodes, featureVersion: decisionRow.featureVersion, modelVersion: decisionRow.modelVersion, policyHash: decisionRow.policyHash, evidenceRoot: decisionRow.evidenceRoot, decisionHash: decisionRow.decisionHash };
    }
    const offerRow = offerRows[0];
    const offerStatus: Offer["status"] | undefined = offerRow && isOfferStatus(offerRow.status) ? offerRow.status : undefined;
    const offer: Offer | undefined = offerRow && offerStatus ? { amount: Number(offerRow.amount), apr: Number(offerRow.apr), ltv: Number(offerRow.ltv), termDays: offerRow.termDays, expiresAt: offerRow.expiresAt.toISOString(), poolLiquidity: 250000, status: offerStatus } : undefined;
    const audit: AuditEvent[] = auditRows.map(event => ({ state: event.state as AuditEvent["state"], label: event.label, timestamp: event.createdAt.toISOString(), detail: event.detail, hash: event.eventHash }));
    return { applicationId, walletAddress: application.walletAddress, sourceChain: application.sourceChain, state: application.state, facts, features: buildFeatureVector(facts), decision, offer, audit };
  } catch (error) {
    console.warn("[ProofLoan] Database read unavailable; using active in-memory snapshot.", error instanceof Error ? error.message : error);
    return undefined;
  }
}
