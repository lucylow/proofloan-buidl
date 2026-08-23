import { eq, and, asc, desc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;
const MAX_PERSISTED_FACTS = 64;
const MAX_PERSISTED_AUDIT_EVENTS = 128;

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
  const createdAt = new Date(event.timestamp);
  return { values: { state: event.state, label: event.label, detail: event.detail, eventHash: event.hash, createdAt }, updateSet: { detail: event.detail, state: event.state, label: event.label, createdAt } };
}

type DatabaseClient = NonNullable<Awaited<ReturnType<typeof getDb>>>;

export async function persistLoanSnapshot(snapshot: LoanSnapshot, dbOverride?: DatabaseClient): Promise<boolean> {
  const db = dbOverride ?? await getDb();
  if (!db) return false;
  try {
    await db.transaction(async tx => {
      await tx.insert(loanApplications).values({
        applicationId: snapshot.applicationId,
        walletAddress: snapshot.walletAddress,
        sourceChain: snapshot.sourceChain,
        state: snapshot.state,
        requestedAmount: String(snapshot.offer?.amount ?? 1500),
        evidenceRoot: snapshot.decision?.evidenceRoot,
        policyHash: snapshot.decision?.policyHash,
        modelVersion: snapshot.decision?.modelVersion,
        decisionHash: snapshot.decision?.decisionHash,
      }).onDuplicateKeyUpdate({ set: { state: snapshot.state, evidenceRoot: snapshot.decision?.evidenceRoot, policyHash: snapshot.decision?.policyHash, modelVersion: snapshot.decision?.modelVersion, decisionHash: snapshot.decision?.decisionHash } });

      for (const fact of snapshot.facts) {
        await tx.insert(verifiedFacts).values({ factId: fact.id, applicationId: snapshot.applicationId, chain: fact.chain, sourceBlock: fact.sourceBlock, txHash: fact.txHash, eventType: fact.eventType, amount: fact.amount, verificationBlock: fact.verificationBlock, freshness: fact.freshness, proofRoot: fact.proofRoot, verifiedAt: new Date(fact.verifiedAt) }).onDuplicateKeyUpdate({ set: { freshness: fact.freshness, verificationBlock: fact.verificationBlock } });
      }
      if (snapshot.decision) {
        const decisionValues = { pd30: String(snapshot.decision.pd30), pd90: String(snapshot.decision.pd90), confidence: String(snapshot.decision.confidence), riskTier: snapshot.decision.riskTier, reasonCodes: JSON.stringify(snapshot.decision.reasonCodes), featureVersion: snapshot.decision.featureVersion, modelVersion: snapshot.decision.modelVersion, policyHash: snapshot.decision.policyHash, evidenceRoot: snapshot.decision.evidenceRoot, decisionHash: snapshot.decision.decisionHash };
        const existingDecision = await tx.select({ id: decisions.id }).from(decisions).where(eq(decisions.applicationId, snapshot.applicationId)).orderBy(desc(decisions.id)).limit(1);
        if (existingDecision[0]) await tx.update(decisions).set(decisionValues).where(eq(decisions.id, existingDecision[0].id));
        else await tx.insert(decisions).values({ applicationId: snapshot.applicationId, ...decisionValues });
      }
      if (snapshot.offer) {
        const existingOffer = await tx.select({ id: offers.id }).from(offers).where(eq(offers.applicationId, snapshot.applicationId)).orderBy(desc(offers.id)).limit(1);
        const offerValues = { amount: String(snapshot.offer.amount), apr: String(snapshot.offer.apr), ltv: String(snapshot.offer.ltv), termDays: snapshot.offer.termDays, status: snapshot.offer.status, expiresAt: new Date(snapshot.offer.expiresAt) };
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
import { isFreshness, isOfferStatus, isProofLoanState, isReasonCode, isRiskTier, isSourceChain, isVerifiedEventType, type SourceChain, type VerifiedFact, type Decision, type Offer, type AuditEvent, type ProofLoanState } from "@shared/proofloan";

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
    return Array.isArray(parsed) && parsed.every(code => typeof code === "string" && isReasonCode(code)) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

type PersistedSnapshotValidationInput = {
  application: { state: string; sourceChain: string; requestedAmount: unknown };
  facts: Array<{ chain: string; eventType: string; freshness: string; sourceBlock: unknown; verificationBlock: unknown }>;
  decision?: { reasonCodes: unknown; riskTier: string; pd30: unknown; pd90: unknown; confidence: unknown };
  offer?: { status: string; amount: unknown; apr: unknown; ltv: unknown; termDays: unknown; expiresAt: unknown };
  audit: Array<{ state: string }>;
};

const isFiniteInRange = (value: unknown, min: number, max: number) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= min && numeric <= max;
};

function isPersistedSnapshotValidUnsafe(input: PersistedSnapshotValidationInput): boolean {
  if (!Array.isArray(input.facts) || !Array.isArray(input.audit)) return false;
  if (input.facts.length > MAX_PERSISTED_FACTS || input.audit.length > MAX_PERSISTED_AUDIT_EVENTS) return false;
  if (!isProofLoanState(input.application.state) || !isSourceChain(input.application.sourceChain) || !isFiniteInRange(input.application.requestedAmount, 0.01, 2500)) return false;
  if (input.facts.some(fact => !isSourceChain(fact.chain) || !isVerifiedEventType(fact.eventType) || !isFreshness(fact.freshness) || !isFiniteInRange(fact.sourceBlock, 1, Number.MAX_SAFE_INTEGER) || !isFiniteInRange(fact.verificationBlock, 1, Number.MAX_SAFE_INTEGER))) return false;
  if (input.decision && (!parsePersistedReasonCodes(input.decision.reasonCodes) || !isRiskTier(input.decision.riskTier) || !isFiniteInRange(input.decision.pd30, 0, 1) || !isFiniteInRange(input.decision.pd90, 0, 1) || !isFiniteInRange(input.decision.confidence, 0, 1))) return false;
  if (input.offer && (!isOfferStatus(input.offer.status) || !isFiniteInRange(input.offer.amount, 0.01, 2500) || !isFiniteInRange(input.offer.apr, 0, 24) || !isFiniteInRange(input.offer.ltv, 0, 1) || !isFiniteInRange(input.offer.termDays, 1, 3650) || !(input.offer.expiresAt instanceof Date) || Number.isNaN(input.offer.expiresAt.getTime()))) return false;
  return input.audit.every(event => isProofLoanState(event.state));
}

export function isPersistedSnapshotValid(input: PersistedSnapshotValidationInput): boolean {
  try {
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
    if (!isPersistedSnapshotValid({ application, facts: factRows, decision: decisionRows[0], offer: offerRows[0], audit: auditRows })) return undefined;
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
