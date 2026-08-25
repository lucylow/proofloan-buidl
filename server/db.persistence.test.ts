import { describe, expect, it, vi } from "vitest";
import { buildApplicationUpsertValues, buildAuditUpsertValues, buildDecisionUpsertValues, buildFactUpsertValues, buildOfferUpsertValues, cleanupReplayProtectionRecords, claimAcceptanceReplay, isCanonicalReplayRequestKey, claimProofRequestReplay, commitAcceptanceReplay, commitProofRequestReplay, getPersistedLoanSnapshot, getReplayProtectionDiagnostics, hasExactlyOneReplayCommit, isDurableAcceptanceReplayResult, isDurableProofRequestReplayResult, isLoanSnapshotWriteConsistent, isReplayRecordExpired, persistLoanSnapshot, recordReplayProtectionEvent } from "./db";
import type { LoanSnapshot } from "@shared/proofloan";
import { fingerprintDecision, hashValue, POLICY_HASH } from "./underwriting";

type TxLike = {
  insert: (table: unknown) => { values: (values: unknown) => { onDuplicateKeyUpdate: (config: unknown) => Promise<void> } };
};

function createSnapshotReadDb(rowSets: unknown[][]) {
  let index = 0;
  return { select: () => ({ from: () => ({ where: () => { const current = index++; return current === 0 ? { limit: async () => rowSets[0] } : { orderBy: () => current === 2 || current === 3 ? { limit: async () => rowSets[current] } : rowSets[current] }; } }) }) };
}

const snapshot: LoanSnapshot = {
  applicationId: "PL-PERSISTENCE-TEST",
  walletAddress: "0xpersist-test-wallet",
  sourceChain: "Ethereum Sepolia",
  state: "EvidencePending",
  facts: [],
  features: { repaymentCount: 0, latePayments: 0, leverageRatio: 0, walletAgeDays: 0, volume7d: 0, volume30d: 0, volume180d: 0, evidenceCount: 0, freshnessScore: 0 },
  audit: [{ state: "EvidencePending", label: "EvidencePending", timestamp: "2026-08-21T20:00:00.000Z", detail: "proof dispatched", hash: "audit-hash-1" }],
};

describe("transactional snapshot persistence", () => {
  it("rejects non-finite cleanup clock input without touching persistence", async () => {
    await expect(cleanupReplayProtectionRecords(Number.NaN)).resolves.toBe(false);
    await expect(cleanupReplayProtectionRecords(Number.POSITIVE_INFINITY)).resolves.toBe(false);
  });
  it("rejects malformed reconstruction identifiers before touching the database", async () => {
    const select = vi.fn();
    await expect(getPersistedLoanSnapshot("not-a-proofloan-id", { select } as never)).resolves.toBeUndefined();
    expect(select).not.toHaveBeenCalled();
  });

  it("reconstructs a valid persisted snapshot at the database read boundary", async () => {
    const createdAt = new Date("2026-08-24T20:00:00.000Z");
    const rows = [
      [{ applicationId: "PL-READBOUNDARY", walletAddress: "0xread-boundary", state: "EvidencePending", sourceChain: "Ethereum Sepolia", requestedAmount: "1500" }],
      [],
      [],
      [],
      [{ applicationId: "PL-READBOUNDARY", state: "EvidencePending", label: "EvidencePending", detail: "proof dispatched", eventHash: "read-audit-1", createdAt }],
    ];
    let index = 0;
    const db = { select: () => ({ from: () => ({ where: () => { const current = index++; return current === 0 ? { limit: async () => rows[0] } : { orderBy: () => current === 2 || current === 3 ? { limit: async () => rows[current] } : rows[current] }; } }) }) };
    const result = await getPersistedLoanSnapshot("PL-READBOUNDARY", db as never);
    expect(result).toMatchObject({ applicationId: "PL-READBOUNDARY", state: "EvidencePending", audit: [{ state: "EvidencePending", hash: "read-audit-1" }] });
  });

  it("fails closed when the persisted audit row is malformed at read time", async () => {
    const createdAt = new Date("invalid");
    const rows = [
      [{ applicationId: "PL-READMALFORMED", walletAddress: "0xread-malformed", state: "EvidencePending", sourceChain: "Ethereum Sepolia", requestedAmount: "1500" }],
      [],
      [],
      [],
      [{ state: "EvidencePending", label: "EvidencePending", detail: "raw-wallet=0xsecret", eventHash: "read-audit-1", createdAt }],
    ];
    let index = 0;
    const db = { select: () => ({ from: () => ({ where: () => { const current = index++; return current === 0 ? { limit: async () => rows[0] } : { orderBy: () => current === 2 || current === 3 ? { limit: async () => rows[current] } : rows[current] }; } }) }) };
    expect(await getPersistedLoanSnapshot("PL-READMALFORMED", db as never)).toBeUndefined();
  });

  it("fails closed for malformed persisted facts, decisions, and offers at read time", async () => {
    const application = { applicationId: "PL-READROWS", walletAddress: "0xread-rows", state: "Executed", sourceChain: "Ethereum Sepolia", requestedAmount: "1500" };
    const fact = { factId: "fact-rows-1", chain: "Ethereum Sepolia", sourceBlock: 1, txHash: "0xrows", eventType: "REPAYMENT", amount: "1 USDC", verificationBlock: 1, freshness: "Fresh", proofRoot: "root-rows", verifiedAt: new Date("2026-08-24T20:00:00.000Z") };
    const decision = { reasonCodes: JSON.stringify(["HIGH_LEVERAGE"]), riskTier: "B", pd30: "0.12", pd90: "0.16", confidence: "0.92", featureVersion: "features-v1", modelVersion: "model-v1", policyHash: "policy-1", evidenceRoot: hashValue(["root-rows"]), decisionHash: "decision-1" };
    const offer = { status: "Executed", amount: "1500", apr: "11.5", ltv: "0.54", termDays: 90, expiresAt: new Date("2026-08-25T20:00:00.000Z") };
    const audit = [{ state: "Executed", label: "Executed", detail: "executed", eventHash: "audit-rows-1", createdAt: new Date("2026-08-24T20:00:00.000Z") }];
    const rows = (factRow = fact, decisionRow = decision, offerRow = offer) => [ [application], [{ applicationId: "PL-READROWS", ...factRow }], [{ applicationId: "PL-READROWS", ...decisionRow }], [{ applicationId: "PL-READROWS", ...offerRow }], audit.map(event => ({ applicationId: "PL-READROWS", ...event })) ];
    expect(await getPersistedLoanSnapshot("PL-READROWS", createSnapshotReadDb(rows()) as never)).toMatchObject({ applicationId: "PL-READROWS", state: "Executed" });
    expect(await getPersistedLoanSnapshot("PL-READROWS", createSnapshotReadDb(rows({ ...fact, txHash: "" })) as never)).toBeUndefined();
    expect(await getPersistedLoanSnapshot("PL-READROWS", createSnapshotReadDb([ [application], [{ applicationId: "PL-OTHER", ...fact }], [{ applicationId: "PL-READROWS", ...decision }], [{ applicationId: "PL-READROWS", ...offer }], audit.map(event => ({ applicationId: "PL-READROWS", ...event })) ]) as never)).toBeUndefined();
    expect(await getPersistedLoanSnapshot("PL-READROWS", createSnapshotReadDb(rows(fact, { ...decision, reasonCodes: "not-json" })) as never)).toBeUndefined();
    expect(await getPersistedLoanSnapshot("PL-READROWS", createSnapshotReadDb(rows(fact, decision, { ...offer, expiresAt: new Date("invalid") })) as never)).toBeUndefined();
    expect(await getPersistedLoanSnapshot("PL-READROWS", createSnapshotReadDb(rows(fact, { ...decision, featureFingerprint: "0".repeat(18) })) as never)).toBeUndefined();
    const terminalTime = audit[0].createdAt.getTime();
    expect(await getPersistedLoanSnapshot("PL-READROWS", createSnapshotReadDb(rows(fact, { ...decision, createdAt: new Date(terminalTime + 1) })) as never)).toBeUndefined();
    expect(await getPersistedLoanSnapshot("PL-READROWS", createSnapshotReadDb(rows(fact, decision, { ...offer, createdAt: new Date(terminalTime + 1) })) as never)).toBeUndefined();
  });

  it("fails closed for malformed application metadata before feature derivation", async () => {
    const audit = [{ applicationId: "PL-READMETA", state: "EvidencePending", label: "EvidencePending", detail: "proof dispatched", eventHash: "metadata-audit-1", createdAt: new Date("2026-08-24T20:00:00.000Z") }];
    const rows = (application: Record<string, unknown>) => [[application], [], [], [], audit];
    const base = { applicationId: "PL-READMETA", walletAddress: "0xread-meta", state: "EvidencePending", sourceChain: "Ethereum Sepolia", requestedAmount: "1500" };
    expect(await getPersistedLoanSnapshot("PL-READMETA", createSnapshotReadDb(rows(base)) as never)).toMatchObject({ applicationId: "PL-READMETA", features: { evidenceCount: 0 } });
    expect(await getPersistedLoanSnapshot("PL-READMETA", createSnapshotReadDb(rows({ ...base, walletAddress: " " })) as never)).toBeUndefined();
    expect(await getPersistedLoanSnapshot("PL-READMETA", createSnapshotReadDb(rows({ ...base, requestedAmount: "Infinity" })) as never)).toBeUndefined();
    expect(await getPersistedLoanSnapshot("PL-READMETA", createSnapshotReadDb(rows({ ...base, sourceChain: "Unknown" })) as never)).toBeUndefined();
    expect(await getPersistedLoanSnapshot("PL-READMETA", createSnapshotReadDb(rows({ ...base, createdAt: new Date("invalid") })) as never)).toBeUndefined();
    expect(await getPersistedLoanSnapshot("PL-READMETA", createSnapshotReadDb(rows({ ...base, createdAt: new Date("2026-08-25T20:00:00.000Z") })) as never)).toBeUndefined();
    expect(await getPersistedLoanSnapshot("PL-READMETA", createSnapshotReadDb(rows({ ...base, createdAt: new Date("2026-08-24T19:00:00.000Z"), updatedAt: new Date("2026-08-24T18:00:00.000Z") })) as never)).toBeUndefined();
    expect(await getPersistedLoanSnapshot("PL-READMETA", createSnapshotReadDb(rows({ ...base, updatedAt: new Date("2026-08-25T20:00:00.000Z") })) as never)).toBeUndefined();
  });

  it("rejects duplicate audit identity before persistence", () => {
    const duplicateAudit = [{ ...snapshot.audit[0] }, { ...snapshot.audit[0], state: "Intake" as const, label: "Intake" as const }];
    expect(isLoanSnapshotWriteConsistent({ ...snapshot, audit: duplicateAudit })).toBe(false);
    expect(isLoanSnapshotWriteConsistent(snapshot)).toBe(true);
  });

  it("rejects duplicate evidence identity before persistence", () => {
    const fact = { id: "fact-identity-1", chain: "Ethereum Sepolia" as const, sourceBlock: 1, txHash: "0xidentity-1", eventType: "REPAYMENT" as const, amount: "1 USDC", verificationBlock: 1, verifiedAt: "2026-08-24T20:00:00.000Z", observedAt: "2026-08-24T20:00:00.000Z", freshness: "Fresh" as const, proofRoot: "root-identity-1", proofWorker: "Attestcoin proof worker" };
    const base = { ...snapshot, applicationId: "PL-IDENTITY", state: "EvidenceVerified" as const, facts: [fact], audit: [{ ...snapshot.audit[0], state: "EvidenceVerified" as const, label: "EvidenceVerified" }] };
    expect(isLoanSnapshotWriteConsistent({ ...base, facts: [fact, { ...fact, id: "fact-identity-2" }] })).toBe(false);
    expect(isLoanSnapshotWriteConsistent({ ...base, facts: [fact, { ...fact, id: "fact-identity-2", txHash: fact.txHash }] })).toBe(false);
    expect(isLoanSnapshotWriteConsistent(base)).toBe(true);
  });

  it("fails closed when persisted singleton rows are ambiguous", async () => {
    const application = { applicationId: "PL-DUPLICATE", walletAddress: "0xduplicate", state: "EvidencePending", sourceChain: "Ethereum Sepolia", requestedAmount: "1500" };
    const audit = [{ state: "EvidencePending", label: "EvidencePending", detail: "proof dispatched", eventHash: "duplicate-audit-1", createdAt: new Date("2026-08-24T20:00:00.000Z") }];
    expect(await getPersistedLoanSnapshot("PL-DUPLICATE", createSnapshotReadDb([[application, application], [], [], [], audit]) as never)).toBeUndefined();
    expect(await getPersistedLoanSnapshot("PL-DUPLICATE", createSnapshotReadDb([[application], [], [{ id: 2 }, { id: 1 }], [], audit]) as never)).toBeUndefined();
    expect(await getPersistedLoanSnapshot("PL-DUPLICATE", createSnapshotReadDb([[application], [], [], [{ id: 2 }, { id: 1 }], audit]) as never)).toBeUndefined();
  });

  it("persists only canonical feature fingerprints in decision metadata", () => {
    const decision = { pd30: 0.12, pd90: 0.16, confidence: 0.92, freshnessScore: 1, riskTier: "B" as const, reasonCodes: ["STRONG_REPAYMENT_HISTORY" as const], featureVersion: "features-v1", modelVersion: "model-v1", policyHash: POLICY_HASH, evidenceRoot: "evidence-1", decisionHash: "decision-1", featureFingerprint: "a".repeat(18) };
    expect(buildDecisionUpsertValues(decision).featureFingerprint).toBe("a".repeat(18));
    expect(() => buildDecisionUpsertValues({ ...decision, featureFingerprint: "not-a-fingerprint" })).toThrow("Invalid persisted decision.");
  });

  it("keeps decision fingerprints stable when only the stored hash changes", () => {
    const decision = { pd30: 0.12, pd90: 0.16, confidence: 0.92, freshnessScore: 1, riskTier: "B" as const, reasonCodes: ["HIGH_LEVERAGE" as const], featureVersion: "features-v1", modelVersion: "model-v1", policyHash: "policy-1", evidenceRoot: "evidence-1", decisionHash: "stored-hash" };
    expect(fingerprintDecision(decision)).toBe(fingerprintDecision({ ...decision, decisionHash: "tampered-hash" }));
  });

  it("rejects persisted decision evidence-root drift", async () => {
    const application = { applicationId: "PL-ROOT-DRIFT", walletAddress: "0xroot-drift", state: "Executed", sourceChain: "Ethereum Sepolia", requestedAmount: "1500" };
    const fact = { factId: "fact-root-1", chain: "Ethereum Sepolia", sourceBlock: 1, txHash: "0xroot-1", eventType: "REPAYMENT", amount: "1 USDC", verificationBlock: 1, freshness: "Fresh", proofRoot: "root-1", verifiedAt: new Date("2026-08-24T20:00:00.000Z") };
    const decision = { reasonCodes: JSON.stringify(["HIGH_LEVERAGE"]), riskTier: "B", pd30: "0.12", pd90: "0.16", confidence: "0.92", featureVersion: "features-v1", modelVersion: "model-v1", policyHash: "policy-1", evidenceRoot: "wrong-root", decisionHash: "decision-1" };
    const offer = { status: "Executed", amount: "1500", apr: "11.5", ltv: "0.54", termDays: 90, expiresAt: new Date("2026-08-25T20:00:00.000Z") };
    const audit = [{ state: "Executed", label: "Executed", detail: "executed", eventHash: "root-audit-1", createdAt: new Date("2026-08-24T20:00:00.000Z") }];
    expect(await getPersistedLoanSnapshot("PL-ROOT-DRIFT", createSnapshotReadDb([[application], [fact], [decision], [offer], audit]) as never)).toBeUndefined();
  });

  it("validates decision metadata before emitting application metadata", () => {
    const invalidDecision = { pd30: 0.12, pd90: 0.16, confidence: 0.92, freshnessScore: 1, riskTier: "B", reasonCodes: ["NOT_A_REASON_CODE"], featureVersion: "features-v1", modelVersion: "model-v1", policyHash: "policy-1", evidenceRoot: "evidence-1", decisionHash: "decision-1" } as never;
    expect(() => buildApplicationUpsertValues({ ...snapshot, decision: invalidDecision })).toThrow("Invalid persisted decision.");
  });

  it("rejects observed-after-verification fact chronology before persistence", () => {
    const fact = { id: "fact-chronology-1", chain: "Ethereum Sepolia" as const, sourceBlock: 1, txHash: "0xchronology-1", eventType: "REPAYMENT" as const, amount: "1 USDC", asset: "USDC", verificationBlock: 1, verifiedAt: "2026-08-21T20:00:00.000Z", observedAt: "2026-08-21T20:00:01.000Z", freshness: "Fresh" as const, proofRoot: "root-chronology-1", proofWorker: "Attestcoin proof worker" };
    expect(() => buildFactUpsertValues(fact)).toThrow("Invalid persisted verified fact.");
  });

  it("rejects non-canonical fact and offer timestamps before persistence", () => {
    const fact = { id: "fact-time-1", chain: "Ethereum Sepolia" as const, sourceBlock: 1, txHash: "0xtime-1", eventType: "REPAYMENT" as const, amount: "1 USDC", asset: "USDC", verificationBlock: 1, verifiedAt: "2026-08-21T20:00:00.000Z", observedAt: "2026-08-21T20:00:00.000Z", freshness: "Fresh" as const, proofRoot: "root-time-1", proofWorker: "Attestcoin proof worker" };
    const offer = { amount: 1500, apr: 11.5, ltv: 0.54, termDays: 90, expiresAt: "2026-08-25T20:00:00.000Z", poolLiquidity: 250000, status: "Ready" as const };
    expect(buildFactUpsertValues(fact).values.verifiedAt).toEqual(new Date("2026-08-21T20:00:00.000Z"));
    expect(buildOfferUpsertValues(offer, "AwaitingAcceptance", 1500, Date.parse("2026-08-21T20:00:00.000Z")).expiresAt).toEqual(new Date("2026-08-25T20:00:00.000Z"));
    expect(() => buildFactUpsertValues({ ...fact, verifiedAt: "2026-08-21T20:00:00Z" })).toThrow("Invalid persisted verified fact.");
    expect(() => buildOfferUpsertValues({ ...offer, expiresAt: "2026-08-25T20:00:00Z" }, "AwaitingAcceptance", 1500)).toThrow("Invalid persisted offer.");
  });

  it("rejects non-canonical audit timestamps before persistence", () => {
    expect(() => buildAuditUpsertValues({ ...snapshot.audit[0], timestamp: "2026-08-21T20:00:00Z" })).toThrow("Invalid persisted audit event.");
    expect(() => buildAuditUpsertValues({ ...snapshot.audit[0], timestamp: "2026-08-21T15:00:00.000-05:00" })).toThrow("Invalid persisted audit event.");
  });

  it("keeps audit insert and update payloads synchronized", () => {
    const payload = buildAuditUpsertValues(snapshot.audit[0]);
    expect(payload.values).toEqual({ state: "EvidencePending", label: "EvidencePending", detail: "proof dispatched", eventHash: "audit-hash-1", createdAt: new Date("2026-08-21T20:00:00.000Z") });
    expect(payload.updateSet).toEqual({ state: "EvidencePending", label: "EvidencePending", detail: "proof dispatched", createdAt: new Date("2026-08-21T20:00:00.000Z") });
  });

  it("fails the whole bundle when a later audit write fails after the application write succeeds", async () => {
    let insertCount = 0;
    let rollbackObserved = false;
    const midBundleFailingTx = {
      insert: () => {
        insertCount += 1;
        return { values: () => ({ onDuplicateKeyUpdate: async () => { if (insertCount === 2) throw new Error("audit write failed after application write"); } }) };
      },
    } as unknown as TxLike;
    const fakeDb = {
      transaction: vi.fn(async (callback: (tx: TxLike) => Promise<void>) => {
        try {
          await callback(midBundleFailingTx);
        } catch {
          rollbackObserved = true;
          throw new Error("transaction rolled back after partial bundle");
        }
      }),
    };

    const result = await persistLoanSnapshot(snapshot, fakeDb as never);
    expect(result).toBe(false);
    expect(insertCount).toBe(2);
    expect(fakeDb.transaction).toHaveBeenCalledOnce();
    expect(rollbackObserved).toBe(true);
  });

  it("validates durable acceptance replay results against the application and execution state", () => {
    const valid = { applicationId: "PL-PERSISTENCE-TEST", state: "Executed", transactionHash: "0xcreditcoin_result", audit: [{ state: "Executed" }] };
    expect(isDurableAcceptanceReplayResult("PL-PERSISTENCE-TEST", valid)).toBe(true);
    expect(isDurableAcceptanceReplayResult("PL-OTHER", valid)).toBe(false);
    expect(isDurableAcceptanceReplayResult("PL-PERSISTENCE-TEST", { ...valid, state: "AwaitingAcceptance" })).toBe(false);
    expect(isDurableAcceptanceReplayResult("PL-PERSISTENCE-TEST", { ...valid, transactionHash: " 0xcreditcoin_result" })).toBe(false);
    expect(isDurableAcceptanceReplayResult("PL-PERSISTENCE-TEST", { ...valid, audit: [] })).toBe(false);
    const modern = { ...valid, receiptHash: "a".repeat(18), offer: { amount: 1500 }, decision: { decisionHash: "decision" }, audit: [{ state: "Executed", hash: "audit" }] };
    expect(isDurableAcceptanceReplayResult("PL-PERSISTENCE-TEST", modern)).toBe(false);
    expect(isDurableAcceptanceReplayResult("PL-PERSISTENCE-TEST", { ...modern, transactionHash: "0xcreditcoin_notcanonical" })).toBe(false);
  });

  it("commits acceptance replay only when the mocked database updates one pending row", async () => {
    const update = (affectedRows: number) => ({ update: () => ({ set: () => ({ where: async () => [{ affectedRows }] }) }) });
    const valid = { applicationId: "PL-PERSISTENCE-TEST", state: "Executed", transactionHash: "0xcreditcoin_result", audit: [{ state: "Executed" }] };
    expect(await commitAcceptanceReplay("PL-PERSISTENCE-TEST", "acceptance-key-123", valid, update(1) as never)).toBe(true);
    expect(await commitAcceptanceReplay("PL-PERSISTENCE-TEST", "acceptance-key-123", valid, update(0) as never)).toBe(false);
  });

  it("commits proof-request replay only when the mocked database updates one pending row", async () => {
    const update = (affectedRows: number) => ({ update: () => ({ set: () => ({ where: async () => [{ affectedRows }] }) }) });
    const valid = { applicationId: "PL-PERSISTENCE-TEST", state: "AwaitingAcceptance", facts: [], audit: [{ state: "Intake" }] };
    expect(await commitProofRequestReplay("proof-request-key-123", "PL-PERSISTENCE-TEST", valid, update(1) as never)).toBe(true);
    expect(await commitProofRequestReplay("proof-request-key-123", "PL-PERSISTENCE-TEST", valid, update(0) as never)).toBe(false);
  });

  it("fails closed and records a redacted write failure when acceptance commit throws", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const throwingDb = { update: () => ({ set: () => ({ where: async () => { throw new Error("db outage: acceptance-key-throw"); } }) }) };
    const valid = { applicationId: "PL-PERSISTENCE-TEST", state: "Executed", transactionHash: "0xcreditcoin_result", audit: [{ state: "Executed" }] };
    expect(await commitAcceptanceReplay("PL-PERSISTENCE-TEST", "acceptance-key-throw", valid, throwingDb as never)).toBe(false);
    const payload = JSON.parse(info.mock.calls.at(-1)?.[0] as string) as Record<string, unknown>;
    expect(payload.reason).toBe("write_failed");
    expect(JSON.stringify(payload)).not.toContain("acceptance-key-throw");
    info.mockRestore();
  });

  it("fails closed and records a redacted write failure when proof-request commit throws", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const throwingDb = { update: () => ({ set: () => ({ where: async () => { throw new Error("db outage: proof-request-key-throw"); } }) }) };
    const valid = { applicationId: "PL-PERSISTENCE-TEST", state: "AwaitingAcceptance", facts: [], audit: [{ state: "Intake" }] };
    expect(await commitProofRequestReplay("proof-request-key-throw", "PL-PERSISTENCE-TEST", valid, throwingDb as never)).toBe(false);
    const payload = JSON.parse(info.mock.calls.at(-1)?.[0] as string) as Record<string, unknown>;
    expect(payload.reason).toBe("write_failed");
    expect(JSON.stringify(payload)).not.toContain("proof-request-key-throw");
    info.mockRestore();
  });

  it("requires exactly one affected replay row before reporting commit success", () => {
    expect(hasExactlyOneReplayCommit({ affectedRows: 1 })).toBe(true);
    expect(hasExactlyOneReplayCommit({ affectedRows: 0 })).toBe(false);
    expect(hasExactlyOneReplayCommit({ affectedRows: 2 })).toBe(false);
    expect(hasExactlyOneReplayCommit({})).toBe(false);
    expect(hasExactlyOneReplayCommit({ affectedRows: "1" })).toBe(false);
    expect(hasExactlyOneReplayCommit({ affectedRows: true })).toBe(false);
    expect(hasExactlyOneReplayCommit({ affectedRows: null })).toBe(false);
    expect(hasExactlyOneReplayCommit({ affectedRows: 1.5 })).toBe(false);
    expect(hasExactlyOneReplayCommit({ affectedRows: Number.NaN })).toBe(false);
  });

  it("rejects malformed replay request keys at the identity boundary", () => {
    expect(isCanonicalReplayRequestKey("proof-request-key-123")).toBe(true);
    expect(isCanonicalReplayRequestKey("too-short")).toBe(false);
    expect(isCanonicalReplayRequestKey(" proof-request-key-123")).toBe(false);
    expect(isCanonicalReplayRequestKey("proof-request-key-123 ")).toBe(false);
    expect(isCanonicalReplayRequestKey("proof-request-key-\n")).toBe(false);
    expect(isCanonicalReplayRequestKey("1".repeat(129))).toBe(false);
    expect(isCanonicalReplayRequestKey(123)).toBe(false);
  });

  it("records privacy-safe structured replay events", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    recordReplayProtectionEvent({ operation: "proof_request", outcome: "unavailable", reason: "invalid_result", requestKey: "proof-secret-key", applicationId: "PL-PERSISTENCE-TEST" });
    const payload = JSON.parse(info.mock.calls[0]?.[0] as string) as Record<string, unknown>;
    expect(payload.event).toBe("proofloan.replay_protection");
    expect(payload.operation).toBe("proof_request");
    expect(payload.outcome).toBe("unavailable");
    expect(payload.reason).toBe("invalid_result");
    expect(payload.requestFingerprint).toMatch(/^[a-f0-9]{16}$/);
    expect(payload.applicationFingerprint).toMatch(/^[a-f0-9]{16}$/);
    expect(JSON.stringify(payload)).not.toContain("proof-secret-key");
    expect(JSON.stringify(payload)).not.toContain("PL-PERSISTENCE-TEST");
    info.mockRestore();
  });

  it("fails closed when a stale acceptance claim loses its recovery race", async () => {
    const replayDb = (affectedRows: number) => ({
      insert: () => ({ values: () => ({ onDuplicateKeyUpdate: async () => undefined }) }),
      select: () => ({ from: () => ({ where: () => ({ limit: async () => [{ applicationId: "PL-PERSISTENCE-TEST", requestKey: "acceptance-race-key", status: "Pending", createdAt: new Date("2020-01-01T00:00:00.000Z") }] }) }) }),
      update: () => ({ set: () => ({ where: async () => [{ affectedRows }] }) }),
    });
    await expect(claimAcceptanceReplay("PL-PERSISTENCE-TEST", "acceptance-race-key", replayDb(0) as never)).resolves.toEqual({ status: "unavailable" });
    await expect(claimAcceptanceReplay("PL-PERSISTENCE-TEST", "acceptance-race-key", replayDb(1) as never)).resolves.toEqual({ status: "claimed" });
  });

  it("fails closed when a stale proof-request claim loses its recovery race", async () => {
    const replayDb = (affectedRows: number) => ({
      insert: () => ({ values: () => ({ onDuplicateKeyUpdate: async () => undefined }) }),
      select: () => ({ from: () => ({ where: () => ({ limit: async () => [{ requestKey: "proof-request-race-key", walletAddress: "0xproof-race-wallet", sourceChain: "Ethereum Sepolia", status: "Pending", createdAt: new Date("2020-01-01T00:00:00.000Z") }] }) }) }),
      update: () => ({ set: () => ({ where: async () => [{ affectedRows }] }) }),
    });
    await expect(claimProofRequestReplay("proof-request-race-key", "0xproof-race-wallet", "Ethereum Sepolia", replayDb(0) as never)).resolves.toEqual({ status: "unavailable" });
    await expect(claimProofRequestReplay("proof-request-race-key", "0xproof-race-wallet", "Ethereum Sepolia", replayDb(1) as never)).resolves.toEqual({ status: "claimed" });
  });

  it("fails closed and classifies acceptance recovery database exceptions", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const replayDb = {
      insert: () => ({ values: () => ({ onDuplicateKeyUpdate: async () => undefined }) }),
      select: () => ({ from: () => ({ where: () => ({ limit: async () => [{ applicationId: "PL-PERSISTENCE-TEST", requestKey: "acceptance-exception-key", status: "Pending", createdAt: new Date("2020-01-01T00:00:00.000Z") }] }) }) }),
      update: () => ({ set: () => ({ where: async () => { throw new Error("db outage: acceptance-exception-key"); } }) }),
    };
    await expect(claimAcceptanceReplay("PL-PERSISTENCE-TEST", "acceptance-exception-key", replayDb as never)).resolves.toEqual({ status: "unavailable" });
    const payload = JSON.parse(info.mock.calls.at(-1)?.[0] as string) as Record<string, unknown>;
    expect(payload.reason).toBe("write_failed");
    expect(JSON.stringify(payload)).not.toContain("acceptance-exception-key");
    info.mockRestore();
  });

  it("fails closed and classifies proof-request recovery database exceptions", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const replayDb = {
      insert: () => ({ values: () => ({ onDuplicateKeyUpdate: async () => undefined }) }),
      select: () => ({ from: () => ({ where: () => ({ limit: async () => [{ requestKey: "proof-request-exception-key", walletAddress: "0xproof-exception-wallet", sourceChain: "Ethereum Sepolia", status: "Pending", createdAt: new Date("2020-01-01T00:00:00.000Z") }] }) }) }),
      update: () => ({ set: () => ({ where: async () => { throw new Error("db outage: proof-request-exception-key"); } }) }),
    };
    await expect(claimProofRequestReplay("proof-request-exception-key", "0xproof-exception-wallet", "Ethereum Sepolia", replayDb as never)).resolves.toEqual({ status: "unavailable" });
    const payload = JSON.parse(info.mock.calls.at(-1)?.[0] as string) as Record<string, unknown>;
    expect(payload.reason).toBe("write_failed");
    expect(JSON.stringify(payload)).not.toContain("proof-request-exception-key");
    info.mockRestore();
  });

  it("returns bounded replay diagnostics without exposing identifiers", async () => {
    const replayDb = {
      select: () => ({ from: () => ({ where: async () => [{ count: 1_000_001 }] }) }),
    };
    await expect(getReplayProtectionDiagnostics(replayDb as never)).resolves.toMatchObject({ acceptance: { pending: 1_000_000, stale: 1_000_000 }, proofRequest: { pending: 1_000_000, stale: 1_000_000 } });
  });

  it("classifies a missing acceptance replay record without proceeding", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const replayDb = {
      insert: () => ({ values: () => ({ onDuplicateKeyUpdate: async () => undefined }) }),
      select: () => ({ from: () => ({ where: () => ({ limit: async () => [] }) }) }),
    };
    await expect(claimAcceptanceReplay("PL-PERSISTENCE-TEST", "acceptance-missing-key", replayDb as never)).resolves.toEqual({ status: "unavailable" });
    const payload = JSON.parse(info.mock.calls.at(-1)?.[0] as string) as Record<string, unknown>;
    expect(payload.reason).toBe("missing_record");
    expect(JSON.stringify(payload)).not.toContain("acceptance-missing-key");
    info.mockRestore();
  });

  it("classifies a missing proof-request replay record without proceeding", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const replayDb = {
      insert: () => ({ values: () => ({ onDuplicateKeyUpdate: async () => undefined }) }),
      select: () => ({ from: () => ({ where: () => ({ limit: async () => [] }) }) }),
    };
    await expect(claimProofRequestReplay("proof-missing-key", "0xproof-missing-wallet", "Ethereum Sepolia", replayDb as never)).resolves.toEqual({ status: "unavailable" });
    const payload = JSON.parse(info.mock.calls.at(-1)?.[0] as string) as Record<string, unknown>;
    expect(payload.reason).toBe("missing_record");
    expect(JSON.stringify(payload)).not.toContain("proof-missing-key");
    info.mockRestore();
  });

  it("expires stale replay leases but preserves fresh claims", () => {
    const now = Date.parse("2026-08-24T00:30:00.000Z");
    expect(isReplayRecordExpired(new Date(now - 10 * 60_000 - 1), now)).toBe(true);
    expect(isReplayRecordExpired(new Date(now - 10 * 60_000), now)).toBe(false);
    expect(isReplayRecordExpired(new Date(now + 1), now)).toBe(false);
    expect(isReplayRecordExpired(new Date("invalid"), now)).toBe(false);
    expect(isReplayRecordExpired({ getTime: () => now - 20 * 60_000 } as unknown as Date, now)).toBe(false);
    expect(isReplayRecordExpired(new Date(now - 20 * 60_000), Number.NaN)).toBe(false);
  });

  it("validates proof-request replay results before durable commit", () => {
    const valid = { applicationId: "PL-PERSISTENCE-TEST", state: "AwaitingAcceptance", facts: [], audit: [{ state: "Intake" }] };
    expect(isDurableProofRequestReplayResult(valid)).toBe(true);
    expect(isDurableProofRequestReplayResult({ ...valid, applicationId: "not-canonical" })).toBe(false);
    expect(isDurableProofRequestReplayResult({ ...valid, facts: null })).toBe(false);
    expect(isDurableProofRequestReplayResult({ ...valid, audit: [] })).toBe(false);
  });

  it("rejects modern acceptance commits without a receipt before touching storage", async () => {
    const update = vi.fn();
    const replayDb = { update };
    const modernWithoutReceipt = {
      applicationId: "PL-PERSISTENCE-TEST",
      state: "Executed",
      transactionHash: "0xlegacy-transaction",
      offer: {},
      decision: { decisionHash: "decision-hash" },
      audit: [{ hash: "terminal-audit-hash" }],
    };
    await expect(commitAcceptanceReplay("PL-PERSISTENCE-TEST", "acceptance-modern-missing-receipt", modernWithoutReceipt, replayDb as never)).resolves.toBe(false);
    expect(update).not.toHaveBeenCalled();
  });

  it("rejects incomplete modern acceptance payloads when replayed from storage", () => {
    expect(isDurableAcceptanceReplayResult("PL-PERSISTENCE-TEST", {
      applicationId: "PL-PERSISTENCE-TEST",
      state: "Executed",
      transactionHash: "0xlegacy-transaction",
      offer: {},
      decision: { decisionHash: "decision-hash" },
      audit: [{ hash: "terminal-audit-hash" }],
    })).toBe(false);
    expect(isDurableAcceptanceReplayResult("PL-PERSISTENCE-TEST", {
      applicationId: "PL-PERSISTENCE-TEST",
      state: "Executed",
      transactionHash: `0xcreditcoin_${"a".repeat(18)}`,
      receiptHash: "a".repeat(18),
      offer: {},
      audit: [{ hash: "terminal-audit-hash" }],
    })).toBe(false);
    expect(isDurableAcceptanceReplayResult("PL-PERSISTENCE-TEST", {
      applicationId: "PL-PERSISTENCE-TEST",
      state: "Executed",
      transactionHash: `0xcreditcoin_${"a".repeat(18)}`,
      receiptHash: "a".repeat(18),
      offer: {},
      decision: { pd30: 0.12, pd90: 0.16, confidence: 0.92, freshnessScore: 1, riskTier: "B", reasonCodes: ["HIGH_LEVERAGE"], featureVersion: "features-v1", modelVersion: "model-v1", policyHash: "policy-1", evidenceRoot: "evidence-1", decisionHash: "stale-decision-hash" },
      audit: [{ hash: "terminal-audit-hash" }],
    })).toBe(false);
  });

  it("rejects receipt-bearing replays with out-of-order audit timestamps", () => {
    const decisionBase = { pd30: 0.12, pd90: 0.16, confidence: 0.92, freshnessScore: 1, riskTier: "B" as const, reasonCodes: ["HIGH_LEVERAGE" as const], featureVersion: "features-v1", modelVersion: "model-v1", policyHash: "policy-1", evidenceRoot: "evidence-1", decisionHash: "placeholder" };
    const decision = { ...decisionBase, decisionHash: fingerprintDecision(decisionBase) };
    expect(isDurableAcceptanceReplayResult("PL-PERSISTENCE-TEST", {
      applicationId: "PL-PERSISTENCE-TEST",
      state: "Executed",
      transactionHash: `0xcreditcoin_${"a".repeat(18)}`,
      receiptHash: "a".repeat(18),
      offer: { status: "Executed" },
      decision,
      audit: [
        { state: "Scored", hash: "scored-audit-hash", timestamp: "2026-08-24T20:00:01.000Z" },
        { state: "Executed", hash: "executed-audit-hash", timestamp: "2026-08-24T20:00:00.000Z" },
      ],
    })).toBe(false);
  });

  it("rejects receipt-bearing replays with duplicate audit hashes", () => {
    const decisionBase = { pd30: 0.12, pd90: 0.16, confidence: 0.92, freshnessScore: 1, riskTier: "B" as const, reasonCodes: ["HIGH_LEVERAGE" as const], featureVersion: "features-v1", modelVersion: "model-v1", policyHash: "policy-1", evidenceRoot: "evidence-1", decisionHash: "placeholder" };
    const decision = { ...decisionBase, decisionHash: fingerprintDecision(decisionBase) };
    expect(isDurableAcceptanceReplayResult("PL-PERSISTENCE-TEST", {
      applicationId: "PL-PERSISTENCE-TEST",
      state: "Executed",
      transactionHash: `0xcreditcoin_${"a".repeat(18)}`,
      receiptHash: "a".repeat(18),
      offer: { status: "Executed" },
      decision,
      audit: [
        { state: "Scored", hash: "duplicate-audit-hash" },
        { state: "Executed", hash: "duplicate-audit-hash" },
      ],
    })).toBe(false);
  });

  it("rejects receipt-bearing replays with Executed state before the terminal event", () => {
    const decisionBase = { pd30: 0.12, pd90: 0.16, confidence: 0.92, freshnessScore: 1, riskTier: "B" as const, reasonCodes: ["HIGH_LEVERAGE" as const], featureVersion: "features-v1", modelVersion: "model-v1", policyHash: "policy-1", evidenceRoot: "evidence-1", decisionHash: "placeholder" };
    const decision = { ...decisionBase, decisionHash: fingerprintDecision(decisionBase) };
    expect(isDurableAcceptanceReplayResult("PL-PERSISTENCE-TEST", {
      applicationId: "PL-PERSISTENCE-TEST",
      state: "Executed",
      transactionHash: `0xcreditcoin_${"a".repeat(18)}`,
      receiptHash: "a".repeat(18),
      offer: { status: "Executed" },
      decision,
      audit: [
        { state: "Executed", hash: "early-executed-hash" },
        { state: "Executed", hash: "terminal-executed-hash" },
      ],
    })).toBe(false);
  });

  it("rejects receipt-bearing replays with missing audit state metadata", () => {
    const decisionBase = { pd30: 0.12, pd90: 0.16, confidence: 0.92, freshnessScore: 1, riskTier: "B" as const, reasonCodes: ["HIGH_LEVERAGE" as const], featureVersion: "features-v1", modelVersion: "model-v1", policyHash: "policy-1", evidenceRoot: "evidence-1", decisionHash: "placeholder" };
    const decision = { ...decisionBase, decisionHash: fingerprintDecision(decisionBase) };
    expect(isDurableAcceptanceReplayResult("PL-PERSISTENCE-TEST", {
      applicationId: "PL-PERSISTENCE-TEST",
      state: "Executed",
      transactionHash: `0xcreditcoin_${"a".repeat(18)}`,
      receiptHash: "a".repeat(18),
      offer: { status: "Executed" },
      decision,
      audit: [
        { hash: "missing-state-hash" },
        { state: "Executed", hash: "terminal-executed-hash" },
      ],
    })).toBe(false);
  });

  it("rejects receipt-bearing replays with audit label drift", () => {
    const decisionBase = { pd30: 0.12, pd90: 0.16, confidence: 0.92, freshnessScore: 1, riskTier: "B" as const, reasonCodes: ["HIGH_LEVERAGE" as const], featureVersion: "features-v1", modelVersion: "model-v1", policyHash: "policy-1", evidenceRoot: "evidence-1", decisionHash: "placeholder" };
    const decision = { ...decisionBase, decisionHash: fingerprintDecision(decisionBase) };
    expect(isDurableAcceptanceReplayResult("PL-PERSISTENCE-TEST", {
      applicationId: "PL-PERSISTENCE-TEST",
      state: "Executed",
      transactionHash: `0xcreditcoin_${"a".repeat(18)}`,
      receiptHash: "a".repeat(18),
      offer: { status: "Executed" },
      decision,
      audit: [{ state: "Executed", label: "Tampered", hash: "terminal-executed-hash" }],
    })).toBe(false);
  });

  it("rejects receipt-bearing replays with missing audit detail metadata", () => {
    const decisionBase = { pd30: 0.12, pd90: 0.16, confidence: 0.92, freshnessScore: 1, riskTier: "B" as const, reasonCodes: ["HIGH_LEVERAGE" as const], featureVersion: "features-v1", modelVersion: "model-v1", policyHash: "policy-1", evidenceRoot: "evidence-1", decisionHash: "placeholder" };
    const decision = { ...decisionBase, decisionHash: fingerprintDecision(decisionBase) };
    expect(isDurableAcceptanceReplayResult("PL-PERSISTENCE-TEST", {
      applicationId: "PL-PERSISTENCE-TEST",
      state: "Executed",
      transactionHash: `0xcreditcoin_${"a".repeat(18)}`,
      receiptHash: "a".repeat(18),
      offer: { status: "Executed" },
      decision,
      audit: [{ state: "Executed", label: "Executed", hash: "terminal-executed-hash" }],
    })).toBe(false);
    expect(isDurableAcceptanceReplayResult("PL-PERSISTENCE-TEST", {
      applicationId: "PL-PERSISTENCE-TEST",
      state: "Executed",
      transactionHash: `0xcreditcoin_${"a".repeat(18)}`,
      receiptHash: "a".repeat(18),
      offer: { status: "Executed" },
      decision,
      audit: [{ state: "Executed", label: "Executed", detail: "   ", hash: "terminal-executed-hash" }],
    })).toBe(false);
  });

  it("rejects receipt-bearing replays with missing audit timestamps", () => {
    const decisionBase = { pd30: 0.12, pd90: 0.16, confidence: 0.92, freshnessScore: 1, riskTier: "B" as const, reasonCodes: ["HIGH_LEVERAGE" as const], featureVersion: "features-v1", modelVersion: "model-v1", policyHash: "policy-1", evidenceRoot: "evidence-1", decisionHash: "placeholder" };
    const decision = { ...decisionBase, decisionHash: fingerprintDecision(decisionBase) };
    expect(isDurableAcceptanceReplayResult("PL-PERSISTENCE-TEST", {
      applicationId: "PL-PERSISTENCE-TEST",
      state: "Executed",
      transactionHash: `0xcreditcoin_${"a".repeat(18)}`,
      receiptHash: "a".repeat(18),
      offer: { status: "Executed" },
      decision,
      audit: [{ state: "Executed", label: "Executed", detail: "execution complete", hash: "terminal-executed-hash" }],
    })).toBe(false);
  });

  it("rejects receipt-bearing replays with non-canonical audit hashes", () => {
    const decisionBase = { pd30: 0.12, pd90: 0.16, confidence: 0.92, freshnessScore: 1, riskTier: "B" as const, reasonCodes: ["HIGH_LEVERAGE" as const], featureVersion: "features-v1", modelVersion: "model-v1", policyHash: "policy-1", evidenceRoot: "evidence-1", decisionHash: "placeholder" };
    const decision = { ...decisionBase, decisionHash: fingerprintDecision(decisionBase) };
    expect(isDurableAcceptanceReplayResult("PL-PERSISTENCE-TEST", {
      applicationId: "PL-PERSISTENCE-TEST",
      state: "Executed",
      transactionHash: `0xcreditcoin_${"a".repeat(18)}`,
      receiptHash: "a".repeat(18),
      offer: { status: "Executed" },
      decision,
      audit: [{ state: "Executed", label: "Executed", detail: "execution complete", hash: " terminal-executed-hash" }],
    })).toBe(false);
  });

  it("rejects receipt-bearing replays with offer metadata drift", () => {
    const decisionBase = { pd30: 0.12, pd90: 0.16, confidence: 0.92, freshnessScore: 1, riskTier: "B" as const, reasonCodes: ["HIGH_LEVERAGE" as const], featureVersion: "features-v1", modelVersion: "model-v1", policyHash: "policy-1", evidenceRoot: "evidence-1", decisionHash: "placeholder" };
    const decision = { ...decisionBase, decisionHash: fingerprintDecision(decisionBase) };
    expect(isDurableAcceptanceReplayResult("PL-PERSISTENCE-TEST", {
      applicationId: "PL-PERSISTENCE-TEST",
      state: "Executed",
      transactionHash: `0xcreditcoin_${"a".repeat(18)}`,
      receiptHash: "a".repeat(18),
      offer: { status: "Executed", amount: 1500, apr: 12.5, ltv: 0.54, termDays: 90, expiresAt: "2026-08-26T00:00:00.000Z", poolLiquidity: 250_000 },
      decision,
      audit: [{ state: "Executed", label: "Executed", detail: "execution complete", hash: "terminal-executed-hash", timestamp: "2026-08-25T00:00:00.000Z" }],
    })).toBe(false);
  });

  it("rejects receipt-bearing replays executed after offer expiry", () => {
    const decisionBase = { pd30: 0.12, pd90: 0.16, confidence: 0.92, freshnessScore: 1, riskTier: "B" as const, reasonCodes: ["HIGH_LEVERAGE" as const], featureVersion: "features-v1", modelVersion: "model-v1", policyHash: "policy-1", evidenceRoot: "evidence-1", decisionHash: "placeholder" };
    const decision = { ...decisionBase, decisionHash: fingerprintDecision(decisionBase) };
    expect(isDurableAcceptanceReplayResult("PL-PERSISTENCE-TEST", {
      applicationId: "PL-PERSISTENCE-TEST",
      state: "Executed",
      transactionHash: `0xcreditcoin_${"a".repeat(18)}`,
      receiptHash: "a".repeat(18),
      offer: { status: "Executed", amount: 1500, apr: 11.5, ltv: 0.54, termDays: 90, expiresAt: "2026-08-24T23:59:59.000Z", poolLiquidity: 250_000 },
      decision,
      audit: [{ state: "Executed", label: "Executed", detail: "execution complete", hash: "terminal-executed-hash", timestamp: "2026-08-25T00:00:00.000Z" }],
    })).toBe(false);
  });

  it("rejects receipt-bearing replays with collateral-basis and LTV drift", () => {
    const decisionBase = { pd30: 0.12, pd90: 0.16, confidence: 0.92, freshnessScore: 1, riskTier: "B" as const, reasonCodes: ["HIGH_LEVERAGE" as const], featureVersion: "features-v1", modelVersion: "model-v1", policyHash: "policy-1", evidenceRoot: "evidence-1", decisionHash: "placeholder" };
    const decision = { ...decisionBase, decisionHash: fingerprintDecision(decisionBase), featureFingerprint: "feature-fingerprint" };
    expect(isDurableAcceptanceReplayResult("PL-PERSISTENCE-TEST", {
      applicationId: "PL-PERSISTENCE-TEST",
      state: "Executed",
      transactionHash: `0xcreditcoin_${"a".repeat(18)}`,
      receiptHash: "a".repeat(18),
      offer: { status: "Executed", amount: 1500, apr: 11.5, ltv: 0.54, collateralValue: 3000, termDays: 90, expiresAt: "2026-08-26T00:00:00.000Z", poolLiquidity: 250_000 },
      decision,
      audit: [{ state: "Executed", label: "Executed", detail: "execution complete", hash: "terminal-executed-hash", timestamp: "2026-08-25T00:00:00.000Z" }],
    })).toBe(false);
  });

  it("rejects fingerprinted receipt-bearing replays without pool-liquidity provenance", () => {
    const decisionBase = { pd30: 0.12, pd90: 0.16, confidence: 0.92, freshnessScore: 1, riskTier: "B" as const, reasonCodes: ["HIGH_LEVERAGE" as const], featureVersion: "features-v1", modelVersion: "model-v1", policyHash: "policy-1", evidenceRoot: "evidence-1", decisionHash: "placeholder" };
    const decision = { ...decisionBase, decisionHash: fingerprintDecision(decisionBase), featureFingerprint: "feature-fingerprint" };
    expect(isDurableAcceptanceReplayResult("PL-PERSISTENCE-TEST", {
      applicationId: "PL-PERSISTENCE-TEST",
      state: "Executed",
      transactionHash: `0xcreditcoin_${"a".repeat(18)}`,
      receiptHash: "a".repeat(18),
      offer: { status: "Executed", amount: 1500, apr: 11.5, ltv: 0.5, collateralValue: 3000, termDays: 90, expiresAt: "2026-08-26T00:00:00.000Z" },
      decision,
      audit: [{ state: "Executed", label: "Executed", detail: "execution complete", hash: "terminal-executed-hash", timestamp: "2026-08-25T00:00:00.000Z" }],
    })).toBe(false);
  });

  it("rejects receipt-bearing replays with string-encoded offer amounts", () => {
    const decisionBase = { pd30: 0.12, pd90: 0.16, confidence: 0.92, freshnessScore: 1, riskTier: "B" as const, reasonCodes: ["HIGH_LEVERAGE" as const], featureVersion: "features-v1", modelVersion: "model-v1", policyHash: "policy-1", evidenceRoot: "evidence-1", decisionHash: "placeholder" };
    const decision = { ...decisionBase, decisionHash: fingerprintDecision(decisionBase) };
    expect(isDurableAcceptanceReplayResult("PL-PERSISTENCE-TEST", {
      applicationId: "PL-PERSISTENCE-TEST",
      state: "Executed",
      transactionHash: `0xcreditcoin_${"a".repeat(18)}`,
      receiptHash: "a".repeat(18),
      offer: { status: "Executed", amount: "1500", apr: 11.5, ltv: 0.54, termDays: 90, expiresAt: "2026-08-26T00:00:00.000Z", poolLiquidity: 250_000 },
      decision,
      audit: [{ state: "Executed", label: "Executed", detail: "execution complete", hash: "terminal-executed-hash", timestamp: "2026-08-25T00:00:00.000Z" }],
    })).toBe(false);
  });

  it("rejects receipt-bearing replays with confidence above freshness support", () => {
    const decisionBase = { pd30: 0.12, pd90: 0.16, confidence: 0.99, freshnessScore: 0.8, riskTier: "B" as const, reasonCodes: ["HIGH_LEVERAGE" as const], featureVersion: "features-v1", modelVersion: "model-v1", policyHash: "policy-1", evidenceRoot: "evidence-1", decisionHash: "placeholder" };
    const decision = { ...decisionBase, decisionHash: fingerprintDecision(decisionBase) };
    expect(isDurableAcceptanceReplayResult("PL-PERSISTENCE-TEST", {
      applicationId: "PL-PERSISTENCE-TEST",
      state: "Executed",
      transactionHash: `0xcreditcoin_${"a".repeat(18)}`,
      receiptHash: "a".repeat(18),
      offer: { status: "Executed", amount: 1500, apr: 11.5, ltv: 0.54, collateralValue: 2800, termDays: 90, expiresAt: "2026-08-26T00:00:00.000Z", poolLiquidity: 250_000 },
      decision,
      audit: [{ state: "Executed", label: "Executed", detail: "execution complete", hash: "terminal-executed-hash", timestamp: "2026-08-25T00:00:00.000Z" }],
    })).toBe(false);
  });

  it("rejects receipt-bearing replays with probability-order and risk-tier drift", () => {
    const decisionBase = { pd30: 0.2, pd90: 0.16, confidence: 0.8, freshnessScore: 0.9, riskTier: "B" as const, reasonCodes: ["HIGH_LEVERAGE" as const], featureVersion: "features-v1", modelVersion: "model-v1", policyHash: "policy-1", evidenceRoot: "evidence-1", decisionHash: "placeholder" };
    const decision = { ...decisionBase, decisionHash: fingerprintDecision(decisionBase) };
    expect(isDurableAcceptanceReplayResult("PL-PERSISTENCE-TEST", {
      applicationId: "PL-PERSISTENCE-TEST",
      state: "Executed",
      transactionHash: `0xcreditcoin_${"a".repeat(18)}`,
      receiptHash: "a".repeat(18),
      offer: { status: "Executed", amount: 1500, apr: 11.5, ltv: 0.54, collateralValue: 2800, termDays: 90, expiresAt: "2026-08-26T00:00:00.000Z", poolLiquidity: 250_000 },
      decision,
      audit: [{ state: "Executed", label: "Executed", detail: "execution complete", hash: "terminal-executed-hash", timestamp: "2026-08-25T00:00:00.000Z" }],
    })).toBe(false);
  });

  it("rejects modern receipt-bearing replays with malformed feature fingerprints", () => {
    const decisionBase = { pd30: 0.12, pd90: 0.16, confidence: 0.8, freshnessScore: 0.9, riskTier: "B" as const, reasonCodes: ["HIGH_LEVERAGE" as const], featureVersion: "features-v1", modelVersion: "model-v1", policyHash: POLICY_HASH, evidenceRoot: "evidence-1", decisionHash: "placeholder" };
    const decision = { ...decisionBase, decisionHash: fingerprintDecision(decisionBase), featureFingerprint: "not-a-canonical-fingerprint" };
    expect(isDurableAcceptanceReplayResult("PL-PERSISTENCE-TEST", {
      applicationId: "PL-PERSISTENCE-TEST",
      state: "Executed",
      transactionHash: `0xcreditcoin_${"a".repeat(18)}`,
      receiptHash: "a".repeat(18),
      offer: { status: "Executed", amount: 1500, apr: 11.5, ltv: 0.54, collateralValue: 2800, termDays: 90, expiresAt: "2026-08-26T00:00:00.000Z", poolLiquidity: 250_000 },
      decision,
      audit: [{ state: "Executed", label: "Executed", detail: "execution complete", hash: "terminal-executed-hash", timestamp: "2026-08-25T00:00:00.000Z" }],
    })).toBe(false);
  });

  it("rejects receipt-bearing replays with malformed decision metadata", () => {
    const decisionBase = { pd30: 0.12, pd90: 0.16, confidence: 0.8, freshnessScore: 0.9, riskTier: "B" as const, reasonCodes: ["HIGH_LEVERAGE" as const], featureVersion: " ", modelVersion: "model-v1", policyHash: POLICY_HASH, evidenceRoot: "evidence-1", decisionHash: "placeholder" };
    const decision = { ...decisionBase, decisionHash: fingerprintDecision(decisionBase) };
    expect(isDurableAcceptanceReplayResult("PL-PERSISTENCE-TEST", {
      applicationId: "PL-PERSISTENCE-TEST",
      state: "Executed",
      transactionHash: `0xcreditcoin_${"a".repeat(18)}`,
      receiptHash: "a".repeat(18),
      offer: { status: "Executed", amount: 1500, apr: 11.5, ltv: 0.54, collateralValue: 2800, termDays: 90, expiresAt: "2026-08-26T00:00:00.000Z", poolLiquidity: 250_000 },
      decision,
      audit: [{ state: "Executed", label: "Executed", detail: "execution complete", hash: "terminal-executed-hash", timestamp: "2026-08-25T00:00:00.000Z" }],
    })).toBe(false);
  });

  it("rejects receipt-bearing replays with JSON-encoded reason-code metadata", () => {
    const decisionBase = { pd30: 0.12, pd90: 0.16, confidence: 0.8, freshnessScore: 0.9, riskTier: "B" as const, reasonCodes: JSON.stringify(["HIGH_LEVERAGE"]), featureVersion: "features-v1", modelVersion: "model-v1", policyHash: POLICY_HASH, evidenceRoot: "evidence-1", decisionHash: "placeholder" };
    const decision = { ...decisionBase, decisionHash: fingerprintDecision(decisionBase) };
    expect(isDurableAcceptanceReplayResult("PL-PERSISTENCE-TEST", {
      applicationId: "PL-PERSISTENCE-TEST",
      state: "Executed",
      transactionHash: `0xcreditcoin_${"a".repeat(18)}`,
      receiptHash: "a".repeat(18),
      offer: { status: "Executed", amount: 1500, apr: 11.5, ltv: 0.54, collateralValue: 2800, termDays: 90, expiresAt: "2026-08-26T00:00:00.000Z", poolLiquidity: 250_000 },
      decision,
      audit: [{ state: "Executed", label: "Executed", detail: "execution complete", hash: "terminal-executed-hash", timestamp: "2026-08-25T00:00:00.000Z" }],
    })).toBe(false);
  });

  it("rejects acceptance replays with non-canonical transaction hashes", () => {
    const result = { applicationId: "PL-PERSISTENCE-TEST", state: "Executed", transactionHash: "tx\noperator", audit: [{ state: "Executed", label: "Executed", detail: "execution complete", hash: "terminal-executed-hash", timestamp: "2026-08-25T00:00:00.000Z" }] };
    expect(isDurableAcceptanceReplayResult(result.applicationId, result as never)).toBe(false);
    expect(isDurableAcceptanceReplayResult(result.applicationId, { ...result, transactionHash: "tx\u0000operator" } as never)).toBe(false);
  });

  it("rejects receipt-bearing replays with a non-canonical application identifier", () => {
    const applicationId = "not-a-proofloan-id";
    const decisionBase = { pd30: 0.12, pd90: 0.16, confidence: 0.8, freshnessScore: 0.9, riskTier: "B" as const, reasonCodes: ["HIGH_LEVERAGE" as const], featureVersion: "features-v1", modelVersion: "model-v1", policyHash: POLICY_HASH, evidenceRoot: "evidence-1", decisionHash: "placeholder" };
    const decision = { ...decisionBase, decisionHash: fingerprintDecision(decisionBase) };
    expect(isDurableAcceptanceReplayResult(applicationId, {
      applicationId,
      state: "Executed",
      transactionHash: `0xcreditcoin_${"a".repeat(18)}`,
      receiptHash: "a".repeat(18),
      offer: { status: "Executed", amount: 1500, apr: 11.5, ltv: 0.54, collateralValue: 2800, termDays: 90, expiresAt: "2026-08-26T00:00:00.000Z", poolLiquidity: 250_000 },
      decision,
      audit: [{ state: "Executed", label: "Executed", detail: "execution complete", hash: "terminal-executed-hash", timestamp: "2026-08-25T00:00:00.000Z" }],
    })).toBe(false);
  });

  it("rejects receipt-bearing replays with a malformed serialized application identifier", () => {
    const applicationId = "PL-PERSISTENCE-TEST";
    const decisionBase = { pd30: 0.12, pd90: 0.16, confidence: 0.8, freshnessScore: 0.9, riskTier: "B" as const, reasonCodes: ["HIGH_LEVERAGE" as const], featureVersion: "features-v1", modelVersion: "model-v1", policyHash: POLICY_HASH, evidenceRoot: "evidence-1", decisionHash: "placeholder" };
    const decision = { ...decisionBase, decisionHash: fingerprintDecision(decisionBase) };
    expect(isDurableAcceptanceReplayResult(applicationId, {
      applicationId: "not-a-proofloan-id",
      state: "Executed",
      transactionHash: `0xcreditcoin_${"a".repeat(18)}`,
      receiptHash: "a".repeat(18),
      offer: { status: "Executed", amount: 1500, apr: 11.5, ltv: 0.54, collateralValue: 2800, termDays: 90, expiresAt: "2026-08-26T00:00:00.000Z", poolLiquidity: 250_000 },
      decision,
      audit: [{ state: "Executed", label: "Executed", detail: "execution complete", hash: "terminal-executed-hash", timestamp: "2026-08-25T00:00:00.000Z" }],
    })).toBe(false);
  });

  it("returns false when the transaction callback fails, allowing the driver to roll back the bundle", async () => {
    let rollbackObserved = false;
    const failingTx = {
      insert: () => ({ values: () => ({ onDuplicateKeyUpdate: async () => { throw new Error("audit write failed"); } }) }),
    } as unknown as TxLike;
    const fakeDb = {
      transaction: vi.fn(async (callback: (tx: TxLike) => Promise<void>) => {
        try {
          await callback(failingTx);
        } catch {
          rollbackObserved = true;
          throw new Error("transaction rolled back");
        }
      }),
    };

    const result = await persistLoanSnapshot(snapshot, fakeDb as never);
    expect(result).toBe(false);
    expect(fakeDb.transaction).toHaveBeenCalledOnce();
    expect(rollbackObserved).toBe(true);
  });
});
