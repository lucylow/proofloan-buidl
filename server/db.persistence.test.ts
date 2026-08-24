import { describe, expect, it, vi } from "vitest";
import { buildAuditUpsertValues, claimAcceptanceReplay, claimProofRequestReplay, commitAcceptanceReplay, commitProofRequestReplay, getPersistedLoanSnapshot, getReplayProtectionDiagnostics, hasExactlyOneReplayCommit, isDurableAcceptanceReplayResult, isDurableProofRequestReplayResult, isReplayRecordExpired, persistLoanSnapshot, recordReplayProtectionEvent } from "./db";
import type { LoanSnapshot } from "@shared/proofloan";

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
  it("reconstructs a valid persisted snapshot at the database read boundary", async () => {
    const createdAt = new Date("2026-08-24T20:00:00.000Z");
    const rows = [
      [{ applicationId: "PL-READBOUNDARY", walletAddress: "0xread-boundary", state: "EvidencePending", sourceChain: "Ethereum Sepolia", requestedAmount: "1500" }],
      [],
      [],
      [],
      [{ state: "EvidencePending", label: "EvidencePending", detail: "proof dispatched", eventHash: "read-audit-1", createdAt }],
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
    const decision = { reasonCodes: JSON.stringify(["HIGH_LEVERAGE"]), riskTier: "B", pd30: "0.08", pd90: "0.16", confidence: "0.92", featureVersion: "features-v1", modelVersion: "model-v1", policyHash: "policy-1", evidenceRoot: "evidence-1", decisionHash: "decision-1" };
    const offer = { status: "Executed", amount: "1500", apr: "11.5", ltv: "0.54", termDays: 90, expiresAt: new Date("2026-08-25T20:00:00.000Z") };
    const audit = [{ state: "Executed", label: "Executed", detail: "executed", eventHash: "audit-rows-1", createdAt: new Date("2026-08-24T20:00:00.000Z") }];
    const rows = (factRow = fact, decisionRow = decision, offerRow = offer) => [ [application], [factRow], [decisionRow], [offerRow], audit ];
    expect(await getPersistedLoanSnapshot("PL-READROWS", createSnapshotReadDb(rows()) as never)).toMatchObject({ applicationId: "PL-READROWS", state: "Executed" });
    expect(await getPersistedLoanSnapshot("PL-READROWS", createSnapshotReadDb(rows({ ...fact, txHash: "" })) as never)).toBeUndefined();
    expect(await getPersistedLoanSnapshot("PL-READROWS", createSnapshotReadDb(rows(fact, { ...decision, reasonCodes: "not-json" })) as never)).toBeUndefined();
    expect(await getPersistedLoanSnapshot("PL-READROWS", createSnapshotReadDb(rows(fact, decision, { ...offer, expiresAt: new Date("invalid") })) as never)).toBeUndefined();
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
    expect(await commitProofRequestReplay("proof-key-123", "PL-PERSISTENCE-TEST", valid, update(1) as never)).toBe(true);
    expect(await commitProofRequestReplay("proof-key-123", "PL-PERSISTENCE-TEST", valid, update(0) as never)).toBe(false);
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
    const throwingDb = { update: () => ({ set: () => ({ where: async () => { throw new Error("db outage: proof-key-throw"); } }) }) };
    const valid = { applicationId: "PL-PERSISTENCE-TEST", state: "AwaitingAcceptance", facts: [], audit: [{ state: "Intake" }] };
    expect(await commitProofRequestReplay("proof-key-throw", "PL-PERSISTENCE-TEST", valid, throwingDb as never)).toBe(false);
    const payload = JSON.parse(info.mock.calls.at(-1)?.[0] as string) as Record<string, unknown>;
    expect(payload.reason).toBe("write_failed");
    expect(JSON.stringify(payload)).not.toContain("proof-key-throw");
    info.mockRestore();
  });

  it("requires exactly one affected replay row before reporting commit success", () => {
    expect(hasExactlyOneReplayCommit({ affectedRows: 1 })).toBe(true);
    expect(hasExactlyOneReplayCommit({ affectedRows: 0 })).toBe(false);
    expect(hasExactlyOneReplayCommit({ affectedRows: 2 })).toBe(false);
    expect(hasExactlyOneReplayCommit({})).toBe(false);
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
      select: () => ({ from: () => ({ where: () => ({ limit: async () => [{ requestKey: "proof-race-key", walletAddress: "0xproof-race-wallet", sourceChain: "Ethereum Sepolia", status: "Pending", createdAt: new Date("2020-01-01T00:00:00.000Z") }] }) }) }),
      update: () => ({ set: () => ({ where: async () => [{ affectedRows }] }) }),
    });
    await expect(claimProofRequestReplay("proof-race-key", "0xproof-race-wallet", "Ethereum Sepolia", replayDb(0) as never)).resolves.toEqual({ status: "unavailable" });
    await expect(claimProofRequestReplay("proof-race-key", "0xproof-race-wallet", "Ethereum Sepolia", replayDb(1) as never)).resolves.toEqual({ status: "claimed" });
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
      select: () => ({ from: () => ({ where: () => ({ limit: async () => [{ requestKey: "proof-exception-key", walletAddress: "0xproof-exception-wallet", sourceChain: "Ethereum Sepolia", status: "Pending", createdAt: new Date("2020-01-01T00:00:00.000Z") }] }) }) }),
      update: () => ({ set: () => ({ where: async () => { throw new Error("db outage: proof-exception-key"); } }) }),
    };
    await expect(claimProofRequestReplay("proof-exception-key", "0xproof-exception-wallet", "Ethereum Sepolia", replayDb as never)).resolves.toEqual({ status: "unavailable" });
    const payload = JSON.parse(info.mock.calls.at(-1)?.[0] as string) as Record<string, unknown>;
    expect(payload.reason).toBe("write_failed");
    expect(JSON.stringify(payload)).not.toContain("proof-exception-key");
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
  });

  it("validates proof-request replay results before durable commit", () => {
    const valid = { applicationId: "PL-PERSISTENCE-TEST", state: "AwaitingAcceptance", facts: [], audit: [{ state: "Intake" }] };
    expect(isDurableProofRequestReplayResult(valid)).toBe(true);
    expect(isDurableProofRequestReplayResult({ ...valid, applicationId: "not-canonical" })).toBe(false);
    expect(isDurableProofRequestReplayResult({ ...valid, facts: null })).toBe(false);
    expect(isDurableProofRequestReplayResult({ ...valid, audit: [] })).toBe(false);
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
