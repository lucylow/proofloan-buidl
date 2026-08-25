import { describe, expect, it, vi } from "vitest";

vi.mock("./attestcoin", async () => {
  const actual = await vi.importActual<typeof import("./attestcoin")>("./attestcoin");
  return { ...actual, verifyTransactionWithAttestcoin: vi.fn() };
});

const mockedLiveStates = new Map<string, string>();

vi.mock("./db", async () => {
  const actual = await vi.importActual<typeof import("./db")>("./db");
  return {
    ...actual,
    persistLoanSnapshot: vi.fn(async () => true),
    transitionLoanState: vi.fn(async (applicationId: string, _from: string, to: string) => { mockedLiveStates.set(applicationId, to); return "committed"; }),
    getPersistedLoanSnapshot: vi.fn(async (applicationId: string) => {
      const state = mockedLiveStates.get(applicationId);
      return state ? { applicationId, state } as LoanSnapshot : undefined;
    }),
  };
});
import { appRouter, allowProofRequest, createProofLoanApplicationId, normalizeAuditDetail, normalizeProofLoanErrorMessage, storePreviewApplication, registerPreviewApplication, withApplicationMutation } from "./routers";
import type { LoanSnapshot } from "@shared/proofloan";
import type { TrpcContext } from "./_core/context";
import { previewAttestcoinFacts, verifyTransactionWithAttestcoin } from "./attestcoin";
import { createLoanFixture, createMalformedLoanFixture } from "./proofloan.fixtures";

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
  it("restricts replay diagnostics to admin callers", async () => {
    const caller = appRouter.createCaller(createContext());
    await expect(caller.proofloan.replayDiagnostics()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("generates canonical non-colliding application IDs without relying on wall-clock precision", () => {
    const first = createProofLoanApplicationId();
    const second = createProofLoanApplicationId();
    expect(first).toMatch(/^PL-[A-F0-9]{32}$/);
    expect(second).toMatch(/^PL-[A-F0-9]{32}$/);
    expect(second).not.toBe(first);
  });

  it("keeps preview evidence block chronology physically consistent", () => {
    for (const sourceChain of ["Ethereum Sepolia", "Polygon Amoy"] as const) {
      const facts = previewAttestcoinFacts("0xpreview-chronology", sourceChain);
      expect(facts.every(fact => fact.verificationBlock >= fact.sourceBlock)).toBe(true);
    }
  });

  it("throttles repeated proof requests and allows requests after the window", () => {
    const key = `throttle-${Date.now()}-${Math.random()}`;
    expect(allowProofRequest(key, 1_000, 2, 100)).toBe(true);
    expect(allowProofRequest(key, 1_050, 2, 100)).toBe(true);
    expect(allowProofRequest(key, 1_060, 2, 100)).toBe(false);
    expect(allowProofRequest(key, 1_101, 2, 100)).toBe(true);
  });

  it("serializes concurrent mutations for one application and releases the lock", async () => {
    const events: string[] = [];
    const first = withApplicationMutation("PL-LOCK001", async () => {
      events.push("first-start");
      await Promise.resolve();
      events.push("first-end");
      return 1;
    });
    const second = withApplicationMutation("PL-LOCK001", async () => {
      events.push("second-start");
      return 2;
    });
    expect(await Promise.all([first, second])).toEqual([1, 2]);
    expect(events).toEqual(["first-start", "first-end", "second-start"]);
    await expect(withApplicationMutation("PL-LOCK001", async () => "released")).resolves.toBe("released");
  });

  it("rejects malformed throttle keys and normalizes whitespace", () => {
    expect(allowProofRequest("", 3_000, 2, 100)).toBe(false);
    expect(allowProofRequest("   ", 3_000, 2, 100)).toBe(false);
    const key = `throttle-whitespace-${Date.now()}-${Math.random()}`;
    expect(allowProofRequest(`  ${key}  `, 3_000, 1, 100)).toBe(true);
    expect(allowProofRequest(key, 3_001, 1, 100)).toBe(false);
    const nonFiniteKey = `throttle-time-${Date.now()}-${Math.random()}`;
    expect(allowProofRequest(nonFiniteKey, Number.NaN, 1, 100)).toBe(true);
  });

  it("normalizes invalid throttle bounds to safe defaults", () => {
    const key = `throttle-bounds-${Date.now()}-${Math.random()}`;
    expect(allowProofRequest(key, 2_000, 0, 100)).toBe(true);
    expect(allowProofRequest(key, 2_001, 0, 100)).toBe(false);
    const fallbackKey = `throttle-fallback-${Date.now()}-${Math.random()}`;
    expect(allowProofRequest(fallbackKey, 2_000, Number.NaN, Number.POSITIVE_INFINITY)).toBe(true);
  });

  it("bounds audit detail and error messages without changing short messages", () => {
    expect(normalizeAuditDetail("short detail")).toBe("short detail");
    const normalized = normalizeAuditDetail("x".repeat(600));
    expect(normalized).toHaveLength(512);
    expect(normalized.endsWith("…")).toBe(true);
    expect(normalizeProofLoanErrorMessage("short error")).toBe("short error");
    expect(normalizeProofLoanErrorMessage("e".repeat(600))).toHaveLength(512);
  });

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

    const overCapacityStore = new Map<string, LoanSnapshot>([
      ["PL-OLD001", previewSnapshot("PL-OLD001")],
      ["PL-OLD002", previewSnapshot("PL-OLD002")],
      ["PL-OLD003", previewSnapshot("PL-OLD003")],
    ]);
    storePreviewApplication(overCapacityStore, previewSnapshot("PL-NEW001"), 1);
    expect(overCapacityStore.size).toBe(1);
    expect(overCapacityStore.has("PL-NEW001")).toBe(true);
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

  it("runs the live proof path with distinct identity fields and verified provenance", async () => {
    const sourceHash = `0x${"b".repeat(64)}`;
    vi.mocked(verifyTransactionWithAttestcoin).mockResolvedValueOnce({ verified: true, chainKey: 1, sourceBlock: 6421883, verificationBlock: 7000000, txHash: sourceHash, proofRoot: "0xproof-root", mode: "sdk" });
    const caller = appRouter.createCaller(createContext());
    const snapshot = await caller.proofloan.createApplication({ walletAddress: `0x${"a".repeat(40)}`, sourceTransactionHash: sourceHash, sourceChain: "Ethereum Sepolia" });
    expect(verifyTransactionWithAttestcoin).toHaveBeenCalledWith(sourceHash, "Ethereum Sepolia");
    expect(snapshot.sourceTransactionHash).toBe(sourceHash);
    expect(snapshot.facts[0]?.txHash).toBe(sourceHash);
    expect(snapshot.audit.map(event => event.state)).toContain("EvidenceVerified");
    expect(["AwaitingAcceptance", "Rejected"]).toContain(snapshot.state);
  }, 30_000);

  it("rejects whitespace-only proof requests at the API boundary", async () => {
    const caller = appRouter.createCaller(createContext());
    await expect(caller.proofloan.createApplication({ walletAddress: "        ", sourceChain: "Ethereum Sepolia" })).rejects.toThrow();
  });

  it("rejects oversized proof-request payloads at the API boundary", async () => {
    const caller = appRouter.createCaller(createContext());
    await expect(caller.proofloan.createApplication({ walletAddress: "0x" + "a".repeat(300), sourceChain: "Ethereum Sepolia" })).rejects.toThrow();
  });

  it("keeps live proof identity fields distinct at the API boundary", async () => {
    const caller = appRouter.createCaller(createContext());
    const sourceHash = `0x${"b".repeat(64)}`;
    await expect(caller.proofloan.createApplication({ walletAddress: sourceHash, sourceTransactionHash: "0x1234", sourceChain: "Ethereum Sepolia" })).rejects.toThrow("32-byte");
    await expect(caller.proofloan.createApplication({ walletAddress: `0x${"a".repeat(64)}`, sourceTransactionHash: sourceHash, sourceChain: "Ethereum Sepolia" })).rejects.toThrow("valid wallet");
  });

  it("rejects undersized proof-request idempotency keys at the API boundary", async () => {
    const caller = appRouter.createCaller(createContext());
    await expect(caller.proofloan.createApplication({ walletAddress: "0xproof-request-key-wallet", sourceChain: "Ethereum Sepolia", idempotencyKey: "short" })).rejects.toThrow();
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
    const snapshot = createLoanFixture("PL-ACCEPTONCEFIXTURE", "accepted");
    registerPreviewApplication(snapshot);
    const executed = await caller.proofloan.acceptOffer({ applicationId: snapshot.applicationId });
    expect(executed.state).toBe("Executed");
    await expect(caller.proofloan.acceptOffer({ applicationId: snapshot.applicationId })).rejects.toThrow("[PROOFLOAN_STATE_CONFLICT]");
    await expect(caller.proofloan.acceptOffer({ applicationId: snapshot.applicationId })).rejects.toThrow("already accepted");
  }, 30_000);

  it("replays a committed acceptance result when the preview offer passes policy", async () => {
    const caller = appRouter.createCaller(createContext());
    const snapshot = createLoanFixture("PL-IDEMPOTENCYFIXTURE", "accepted");
    registerPreviewApplication(snapshot);
    const idempotencyKey = "accept-retry-key-0001";
    const first = await caller.proofloan.acceptOffer({ applicationId: snapshot.applicationId, idempotencyKey });
    const retry = await caller.proofloan.acceptOffer({ applicationId: snapshot.applicationId, idempotencyKey });
    expect(retry.transactionHash).toBe(first.transactionHash);
    expect(retry.audit).toEqual(first.audit);
    await expect(caller.proofloan.acceptOffer({ applicationId: snapshot.applicationId, idempotencyKey: "different-retry-key-01" })).rejects.toThrow("[PROOFLOAN_STATE_CONFLICT]");
  }, 30_000);

  it("rejects blocked, expired, and executed loan fixtures at the acceptance boundary", async () => {
    const caller = appRouter.createCaller(createContext());
    for (const kind of ["blocked", "expired", "executed"] as const) {
      const snapshot = createLoanFixture(`PL-${kind.toUpperCase()}FIXTURE`, kind);
      registerPreviewApplication(snapshot);
      await expect(caller.proofloan.acceptOffer({ applicationId: snapshot.applicationId })).rejects.toThrow("Offer is unavailable");
    }
  });

  it("fails closed for malformed loan snapshots without executing an offer", async () => {
    const caller = appRouter.createCaller(createContext());
    for (const kind of ["missing-offer", "partial-offer"] as const) {
      const snapshot = createMalformedLoanFixture(`PL-MALFORMED${kind === "missing-offer" ? "MISSING" : "PARTIAL"}`, kind);
      registerPreviewApplication(snapshot);
      await expect(caller.proofloan.acceptOffer({ applicationId: snapshot.applicationId })).rejects.toThrow("Offer is unavailable");
    }
  });

  it("rejects undersized acceptance idempotency keys at the API boundary", async () => {
    const caller = appRouter.createCaller(createContext());
    const snapshot = await caller.proofloan.createApplication({ walletAddress: "0xidempotency-validation-wallet", sourceChain: "Polygon Amoy" });
    await expect(caller.proofloan.acceptOffer({ applicationId: snapshot.applicationId, idempotencyKey: "short" })).rejects.toThrow();
  }, 30_000);
});
