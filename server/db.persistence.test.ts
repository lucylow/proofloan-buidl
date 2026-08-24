import { describe, expect, it, vi } from "vitest";
import { buildAuditUpsertValues, isDurableAcceptanceReplayResult, isDurableProofRequestReplayResult, isReplayRecordExpired, persistLoanSnapshot, recordReplayProtectionEvent } from "./db";
import type { LoanSnapshot } from "@shared/proofloan";

type TxLike = {
  insert: (table: unknown) => { values: (values: unknown) => { onDuplicateKeyUpdate: (config: unknown) => Promise<void> } };
};

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
