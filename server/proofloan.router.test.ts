import { describe, expect, it } from "vitest";
import { appRouter, storePreviewApplication } from "./routers";
import type { LoanSnapshot } from "@shared/proofloan";
import type { TrpcContext } from "./_core/context";

function createContext(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

function previewSnapshot(applicationId: string): LoanSnapshot {
  return { applicationId, walletAddress: "0xpreview", sourceChain: "Ethereum Sepolia", state: "Intake", facts: [], features: { repaymentCount: 0, latePayments: 0, leverageRatio: 0, walletAgeDays: 0, volume7d: 0, volume30d: 0, volume180d: 0, evidenceCount: 0, freshnessScore: 0 }, audit: [] };
}

describe("proofloan API flow", () => {
  it("bounds preview storage and preserves updates for existing applications", () => {
    const store = new Map<string, LoanSnapshot>();
    storePreviewApplication(store, previewSnapshot("PL-ONE1234"), 2);
    storePreviewApplication(store, previewSnapshot("PL-TWO1234"), 2);
    storePreviewApplication(store, { ...previewSnapshot("PL-TWO1234"), state: "Executed" }, 2);
    storePreviewApplication(store, previewSnapshot("PL-THREE1234"), 2);

    expect(store.size).toBe(2);
    expect(store.has("PL-ONE1234")).toBe(false);
    expect(store.get("PL-TWO1234")?.state).toBe("Executed");
    expect(store.has("PL-THREE1234")).toBe(true);

    const zeroCapacityStore = new Map<string, LoanSnapshot>();
    storePreviewApplication(zeroCapacityStore, previewSnapshot("PL-CAP001"), 0);
    storePreviewApplication(zeroCapacityStore, previewSnapshot("PL-CAP002"), 0);
    expect(zeroCapacityStore.size).toBe(1);
    expect(zeroCapacityStore.has("PL-CAP001")).toBe(false);
    expect(zeroCapacityStore.has("PL-CAP002")).toBe(true);

    const fractionalCapacityStore = new Map<string, LoanSnapshot>();
    storePreviewApplication(fractionalCapacityStore, previewSnapshot("PL-CAP003"), 2.9);
    storePreviewApplication(fractionalCapacityStore, previewSnapshot("PL-CAP004"), 2.9);
    storePreviewApplication(fractionalCapacityStore, previewSnapshot("PL-CAP005"), 2.9);
    expect(fractionalCapacityStore.size).toBe(2);
    expect(fractionalCapacityStore.has("PL-CAP003")).toBe(false);
    expect(fractionalCapacityStore.has("PL-CAP004")).toBe(true);
    expect(fractionalCapacityStore.has("PL-CAP005")).toBe(true);

    const invalidCapacityStore = new Map<string, LoanSnapshot>();
    storePreviewApplication(invalidCapacityStore, previewSnapshot("PL-CAP006"), Number.NaN);
    storePreviewApplication(invalidCapacityStore, previewSnapshot("PL-CAP007"), Number.POSITIVE_INFINITY);
    expect(invalidCapacityStore.size).toBe(2);
  });
  it("moves a preview application through the exact auditable state sequence", async () => {
    const caller = appRouter.createCaller(createContext());
    const snapshot = await caller.proofloan.createApplication({ walletAddress: "0xrouter-flow-wallet", sourceChain: "Ethereum Sepolia" });
    expect(["AwaitingAcceptance", "Rejected"]).toContain(snapshot.state);
    expect(snapshot.audit.map(event => event.state).slice(0, 5)).toEqual(["Intake", "EvidencePending", "EvidencePending", "EvidenceVerified", "Scored"]);
    expect(["OfferPrepared", "Rejected"]).toContain(snapshot.audit.at(-1)?.state);
    expect(snapshot.facts).toHaveLength(3);
    expect(snapshot.decision?.reasonCodes.length).toBeGreaterThan(0);
  }, 30_000);

  it("rejects whitespace-only proof requests at the API boundary", async () => {
    const caller = appRouter.createCaller(createContext());
    await expect(caller.proofloan.createApplication({ walletAddress: "        ", sourceChain: "Ethereum Sepolia" })).rejects.toThrow();
  });

  it("rejects oversized proof-request payloads at the API boundary", async () => {
    const caller = appRouter.createCaller(createContext());
    await expect(caller.proofloan.createApplication({ walletAddress: "0x" + "a".repeat(300), sourceChain: "Ethereum Sepolia" })).rejects.toThrow();
  });

  it("trims proof-request input before creating the snapshot", async () => {
    const caller = appRouter.createCaller(createContext());
    const snapshot = await caller.proofloan.createApplication({ walletAddress: "  0xtrimmed-wallet  ", sourceChain: "Ethereum Sepolia" });
    expect(snapshot.walletAddress).toBe("0xtrimmed-wallet");
  }, 30_000);

  it("rejects malformed application IDs at the API boundary", async () => {
    const caller = appRouter.createCaller(createContext());
    await expect(caller.proofloan.getApplication({ applicationId: "not-an-application-id" })).rejects.toThrow();
    await expect(caller.proofloan.acceptOffer({ applicationId: "PL/<invalid>" })).rejects.toThrow();
  });

  it("accepts an offer once and rejects a replay at the API boundary", async () => {
    const caller = appRouter.createCaller(createContext());
    const snapshot = await caller.proofloan.createApplication({ walletAddress: "0xreplay-test-wallet", sourceChain: "Polygon Amoy" });
    const executed = await caller.proofloan.acceptOffer({ applicationId: snapshot.applicationId });
    expect(executed.state).toBe("Executed");
    await expect(caller.proofloan.acceptOffer({ applicationId: snapshot.applicationId })).rejects.toThrow("[PROOFLOAN_STATE_CONFLICT]");
    await expect(caller.proofloan.acceptOffer({ applicationId: snapshot.applicationId })).rejects.toThrow("already accepted");
  }, 30_000);
});
