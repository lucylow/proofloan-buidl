import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

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

export async function persistLoanSnapshot(snapshot: LoanSnapshot): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  try {
    await db.insert(loanApplications).values({
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
    await db.insert(verifiedFacts).values({ factId: fact.id, applicationId: snapshot.applicationId, chain: fact.chain, sourceBlock: fact.sourceBlock, txHash: fact.txHash, eventType: fact.eventType, amount: fact.amount, verificationBlock: fact.verificationBlock, freshness: fact.freshness, proofRoot: fact.proofRoot, verifiedAt: new Date(fact.verifiedAt) }).onDuplicateKeyUpdate({ set: { freshness: fact.freshness, verificationBlock: fact.verificationBlock } });
  }
  if (snapshot.decision) {
    const decisionValues = { pd30: String(snapshot.decision.pd30), pd90: String(snapshot.decision.pd90), confidence: String(snapshot.decision.confidence), riskTier: snapshot.decision.riskTier, reasonCodes: JSON.stringify(snapshot.decision.reasonCodes), featureVersion: snapshot.decision.featureVersion, modelVersion: snapshot.decision.modelVersion, policyHash: snapshot.decision.policyHash, evidenceRoot: snapshot.decision.evidenceRoot, decisionHash: snapshot.decision.decisionHash };
    const existingDecision = await db.select({ id: decisions.id }).from(decisions).where(eq(decisions.applicationId, snapshot.applicationId)).limit(1);
    if (existingDecision[0]) await db.update(decisions).set(decisionValues).where(eq(decisions.id, existingDecision[0].id));
    else await db.insert(decisions).values({ applicationId: snapshot.applicationId, ...decisionValues });
  }
    if (snapshot.offer) {
      const existingOffer = await db.select({ id: offers.id }).from(offers).where(eq(offers.applicationId, snapshot.applicationId)).limit(1);
      const offerValues = { amount: String(snapshot.offer.amount), apr: String(snapshot.offer.apr), ltv: String(snapshot.offer.ltv), termDays: snapshot.offer.termDays, status: snapshot.offer.status, expiresAt: new Date(snapshot.offer.expiresAt) };
      if (existingOffer[0]) await db.update(offers).set(offerValues).where(eq(offers.id, existingOffer[0].id));
      else await db.insert(offers).values({ applicationId: snapshot.applicationId, ...offerValues });
    }
    for (const event of snapshot.audit) {
      await db.insert(auditEvents).values({ applicationId: snapshot.applicationId, state: event.state, label: event.label, detail: event.detail, eventHash: event.hash, createdAt: new Date(event.timestamp) }).onDuplicateKeyUpdate({ set: { detail: event.detail, state: event.state } });
    }
    return true;
  } catch (error) {
    console.warn("[ProofLoan] Persistence unavailable; keeping the active snapshot in memory for the demo.", error instanceof Error ? error.message : error);
    return false;
  }
}


import { buildFeatureVector } from "./underwriting";
import type { SourceChain, VerifiedFact, Decision, Offer, AuditEvent, ProofLoanState } from "@shared/proofloan";

export async function transitionLoanState(applicationId: string, expectedState: ProofLoanState, nextState: ProofLoanState): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  try {
    const result = await db.update(loanApplications).set({ state: nextState }).where(and(eq(loanApplications.applicationId, applicationId), eq(loanApplications.state, expectedState)));
    const affectedRows = Number((result as unknown as { affectedRows?: number }).affectedRows ?? 0);
    return affectedRows === 1;
  } catch (error) {
    console.warn("[ProofLoan] Database transition unavailable", error instanceof Error ? error.message : error);
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
    const factRows = await db.select().from(verifiedFacts).where(eq(verifiedFacts.applicationId, applicationId));
    const decisionRows = await db.select().from(decisions).where(eq(decisions.applicationId, applicationId)).limit(1);
    const offerRows = await db.select().from(offers).where(eq(offers.applicationId, applicationId)).limit(1);
    const auditRows = await db.select().from(auditEvents).where(eq(auditEvents.applicationId, applicationId));
    const facts: VerifiedFact[] = factRows.map(fact => ({ id: fact.factId, chain: fact.chain as SourceChain, sourceBlock: fact.sourceBlock, txHash: fact.txHash, eventType: fact.eventType as VerifiedFact["eventType"], amount: fact.amount, asset: "USDC", verificationBlock: fact.verificationBlock, verifiedAt: fact.verifiedAt.toISOString(), observedAt: fact.verifiedAt.toISOString(), freshness: fact.freshness as VerifiedFact["freshness"], proofRoot: fact.proofRoot, proofWorker: "Attestcoin proof worker" }));
    const decisionRow = decisionRows[0];
    const decision: Decision | undefined = decisionRow ? { pd30: Number(decisionRow.pd30), pd90: Number(decisionRow.pd90), confidence: Number(decisionRow.confidence), freshnessScore: facts.length ? facts.filter(f => f.freshness === "Fresh").length / facts.length : 0, riskTier: decisionRow.riskTier as Decision["riskTier"], reasonCodes: JSON.parse(decisionRow.reasonCodes) as Decision["reasonCodes"], featureVersion: decisionRow.featureVersion, modelVersion: decisionRow.modelVersion, policyHash: decisionRow.policyHash, evidenceRoot: decisionRow.evidenceRoot, decisionHash: decisionRow.decisionHash } : undefined;
    const offerRow = offerRows[0];
    const offer: Offer | undefined = offerRow ? { amount: Number(offerRow.amount), apr: Number(offerRow.apr), ltv: Number(offerRow.ltv), termDays: offerRow.termDays, expiresAt: offerRow.expiresAt.toISOString(), poolLiquidity: 250000, status: offerRow.status as Offer["status"] } : undefined;
    const audit: AuditEvent[] = auditRows.map(event => ({ state: event.state as AuditEvent["state"], label: event.label, timestamp: event.createdAt.toISOString(), detail: event.detail, hash: event.eventHash }));
    return { applicationId, walletAddress: application.walletAddress, sourceChain: application.sourceChain as SourceChain, state: application.state as LoanSnapshot["state"], facts, features: buildFeatureVector(facts), decision, offer, audit };
  } catch (error) {
    console.warn("[ProofLoan] Database read unavailable; using active in-memory snapshot.", error instanceof Error ? error.message : error);
    return undefined;
  }
}
