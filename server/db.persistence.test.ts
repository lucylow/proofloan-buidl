import { describe, expect, it, vi } from "vitest";
import { buildAuditUpsertValues, persistLoanSnapshot } from "./db";
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
