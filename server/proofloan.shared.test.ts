import { describe, expect, it } from "vitest";
import { cleanProofLoanErrorMessage, getProofLoanErrorCode, isExpectedProofLoanError, isFreshness, isLiveTxHash, isOfferStatus, isProofLoanApplicationId, isProofLoanState, isReasonCode, isRiskTier, isSourceChain, isVerifiedEventType } from "@shared/proofloan";
import { buildApplicationUpsertValues, buildAuditUpsertValues, buildDecisionUpsertValues, buildFactUpsertValues, buildOfferUpsertValues, isLoanSnapshotWriteConsistent, isPersistedSnapshotValid, parsePersistedReasonCodes } from "./db";

describe("ProofLoan shared validation", () => {
  it("accepts canonical ProofLoan application IDs and rejects malformed ones", () => {
    expect(isProofLoanApplicationId(`PL-${"A".repeat(64)}`)).toBe(true);
    expect(isProofLoanApplicationId(`  PL-${"A".repeat(64)}  `)).toBe(true);
    expect(isProofLoanApplicationId("PL-short")).toBe(false);
    expect(isProofLoanApplicationId(`PL-${"A".repeat(3)}/12345678`)).toBe(false);
    expect(isProofLoanApplicationId(`application-${"A".repeat(64)}`)).toBe(false);
  });

  it("accepts a canonical 32-byte hexadecimal transaction hash", () => {
    expect(isLiveTxHash(`0x${"a".repeat(64)}`)).toBe(true);
    expect(isLiveTxHash(`  0x${"a".repeat(64)}  `)).toBe(true);
  });

  it("rejects malformed, short, and non-hex transaction values", () => {
    expect(isLiveTxHash("0x71C7...9A2F")).toBe(false);
    expect(isLiveTxHash(`0x${"a".repeat(63)}`)).toBe(false);
    expect(isLiveTxHash(`0x${"g".repeat(64)}`)).toBe(false);
    expect(isLiveTxHash("71C7...9A2F")).toBe(false);
  });

  it("classifies structured router errors without misclassifying plain messages", () => {
    expect(getProofLoanErrorCode("[PROOFLOAN_STATE_CONFLICT] Offer is unavailable.")).toBe("PROOFLOAN_STATE_CONFLICT");
    expect(getProofLoanErrorCode("[PROOFLOAN_DATABASE_ERROR] Read-back failed.")).toBe("PROOFLOAN_DATABASE_ERROR");
    expect(getProofLoanErrorCode("[PROOFLOAN_PROOF_WORKER_ERROR] Source transaction is not mined yet.")).toBe("PROOFLOAN_PROOF_WORKER_ERROR");
    expect(cleanProofLoanErrorMessage("[PROOFLOAN_PROOF_WORKER_ERROR] Source transaction is not mined yet.")).toBe("Source transaction is not mined yet.");
    expect(cleanProofLoanErrorMessage("A plain error message")).toBe("A plain error message");
    expect(getProofLoanErrorCode("Offer is unavailable.")).toBeUndefined();
    expect(isExpectedProofLoanError(new Error("[PROOFLOAN_STATE_CONFLICT] Offer is already accepted."))).toBe(true);
    expect(isExpectedProofLoanError(new Error("Network request failed"))).toBe(false);
    expect(isExpectedProofLoanError("not an Error instance")).toBe(false);
  });

  it("fails closed for invalid persisted snapshot rows", () => {
    const valid = { application: { applicationId: "PL-APPTEST1", walletAddress: "0xborrower", state: "Executed", sourceChain: "Ethereum Sepolia", requestedAmount: "1500" }, facts: [{ factId: "fact-1", chain: "Ethereum Sepolia", sourceBlock: 1, txHash: "0xabc", eventType: "REPAYMENT", amount: "1,250 USDC", verificationBlock: 1, freshness: "Fresh", proofRoot: "root-1", verifiedAt: new Date() }], decision: { reasonCodes: JSON.stringify(["HIGH_LEVERAGE"]), riskTier: "B", pd30: "0.08", pd90: "0.16", confidence: "0.92", featureVersion: "features-v1", modelVersion: "model-v1", policyHash: "policy-1", evidenceRoot: "evidence-1", decisionHash: "decision-1" }, offer: { status: "Executed", amount: "1500", apr: "11.5", ltv: "0.54", termDays: 90, expiresAt: new Date(Date.now() + 86_400_000) }, audit: [{ state: "Executed", label: "Executed", detail: "short detail", eventHash: "hash-1", createdAt: new Date() }] };
    expect(isPersistedSnapshotValid(valid)).toBe(true);
    expect(isPersistedSnapshotValid({ ...valid, audit: [{ ...valid.audit[0], state: "OfferPrepared", label: "OfferPrepared" }] })).toBe(false);
    expect(isPersistedSnapshotValid({ ...valid, audit: [{ ...valid.audit[0], label: "Intake" }] })).toBe(false);
    expect(isPersistedSnapshotValid({ ...valid, audit: [] })).toBe(false);
    expect(isPersistedSnapshotValid(valid, "PL-DIFFERENT1")).toBe(false);
    expect(isPersistedSnapshotValid(valid, "PL-APPTEST1")).toBe(true);
    expect(isPersistedSnapshotValid({ ...valid, application: { ...valid.application, state: "Unknown" } })).toBe(false);
    expect(isPersistedSnapshotValid({ ...valid, application: { ...valid.application, state: "EvidencePending" }, decision: undefined, offer: undefined, audit: [{ ...valid.audit[0], state: "EvidencePending", label: "EvidencePending" }] })).toBe(true);
    expect(isPersistedSnapshotValid({ ...valid, application: { ...valid.application, state: "EvidenceVerified" }, facts: [], decision: undefined, offer: undefined })).toBe(false);
    expect(isPersistedSnapshotValid({ ...valid, application: { ...valid.application, state: "Intake" }, decision: valid.decision, offer: undefined })).toBe(false);
    expect(isPersistedSnapshotValid({ ...valid, decision: undefined })).toBe(false);
    expect(isPersistedSnapshotValid({ ...valid, application: { ...valid.application, sourceChain: "Mainnet" } })).toBe(false);
    expect(isPersistedSnapshotValid({ ...valid, decision: { ...valid.decision, reasonCodes: "not-json" } })).toBe(false);
    expect(isPersistedSnapshotValid({ ...valid, decision: { ...valid.decision, confidence: "NaN" } })).toBe(false);
    expect(isPersistedSnapshotValid({ ...valid, decision: { ...valid.decision, modelVersion: " model-v1" } })).toBe(false);
    expect(isPersistedSnapshotValid({ ...valid, decision: { ...valid.decision, policyHash: "policy-1 " } })).toBe(false);
    expect(isPersistedSnapshotValid({ ...valid, offer: { ...valid.offer, ltv: "1.5" } })).toBe(false);
    expect(isPersistedSnapshotValid({ ...valid, offer: { ...valid.offer, amount: "1499" } })).toBe(false);
    expect(isPersistedSnapshotValid({ ...valid, application: { ...valid.application, requestedAmount: "-1" } })).toBe(false);
    expect(isPersistedSnapshotValid({ ...valid, application: { ...valid.application, requestedAmount: "" } })).toBe(false);
    expect(isPersistedSnapshotValid({ ...valid, application: { ...valid.application, requestedAmount: " 1500" } })).toBe(false);
    expect(isPersistedSnapshotValid({ ...valid, application: { ...valid.application, requestedAmount: null } })).toBe(false);
    expect(isPersistedSnapshotValid({ ...valid, application: { ...valid.application, applicationId: "app-1" } })).toBe(false);
    expect(isPersistedSnapshotValid({ ...valid, application: { ...valid.application, applicationId: " PL-APPTEST1" } })).toBe(false);
    expect(isPersistedSnapshotValid({ ...valid, application: { ...valid.application, applicationId: "PL-APPTEST1 " } })).toBe(false);
    expect(isPersistedSnapshotValid({ ...valid, application: { ...valid.application, walletAddress: "   " } })).toBe(false);
    expect(isPersistedSnapshotValid({ ...valid, application: { ...valid.application, walletAddress: "x".repeat(129) } })).toBe(false);
    expect(isPersistedSnapshotValid({ ...valid, decision: { ...valid.decision, confidence: " " } })).toBe(false);
    expect(isPersistedSnapshotValid({ ...valid, decision: { ...valid.decision, pd30: "0.08 " } })).toBe(false);
    expect(isPersistedSnapshotValid({ ...valid, decision: { ...valid.decision, modelVersion: "" } })).toBe(false);
    expect(isPersistedSnapshotValid({ ...valid, decision: { ...valid.decision, policyHash: "   " } })).toBe(false);
    expect(isPersistedSnapshotValid({ ...valid, decision: { ...valid.decision, policyHash: "x".repeat(129) } })).toBe(false);
    expect(isPersistedSnapshotValid({ ...valid, offer: { ...valid.offer, termDays: true } as never })).toBe(false);
    expect(isPersistedSnapshotValid({ ...valid, offer: { ...valid.offer, apr: " 11.5" } })).toBe(false);
    expect(isPersistedSnapshotValid({ ...valid, offer: { ...valid.offer, status: "Ready" } })).toBe(false);
    expect(isPersistedSnapshotValid({ ...valid, application: { ...valid.application, state: "Rejected" }, offer: { ...valid.offer, status: "Blocked" }, audit: [{ ...valid.audit[0], state: "Rejected", label: "Rejected" }] })).toBe(true);
    expect(isPersistedSnapshotValid({ ...valid, application: { ...valid.application, state: "AwaitingAcceptance" }, offer: { ...valid.offer, status: "Ready", expiresAt: new Date(2_000) }, facts: valid.facts.map(fact => ({ ...fact, verifiedAt: new Date(500) })), audit: valid.audit.map(event => ({ ...event, state: "AwaitingAcceptance", label: "AwaitingAcceptance", createdAt: new Date(500) })) }, undefined, 1_000)).toBe(true);
    expect(isPersistedSnapshotValid({ ...valid, application: { ...valid.application, state: "AwaitingAcceptance" }, offer: { ...valid.offer, status: "Ready", expiresAt: new Date(1_000) } }, undefined, 2_000)).toBe(false);
    expect(isPersistedSnapshotValid(valid, undefined, Infinity)).toBe(false);
    const laterAudit = { ...valid.audit[0], eventHash: "hash-2", createdAt: new Date(valid.audit[0].createdAt.getTime() + 1_000) };
    expect(isPersistedSnapshotValid({ ...valid, audit: [valid.audit[0], laterAudit] }, undefined, laterAudit.createdAt.getTime())).toBe(true);
    expect(isPersistedSnapshotValid({ ...valid, audit: [laterAudit, valid.audit[0]] })).toBe(false);
    const scoredAudit = { ...valid.audit[0], state: "Scored", label: "Scored", eventHash: "hash-scored", createdAt: new Date(valid.audit[0].createdAt.getTime() - 1_000) };
    expect(isPersistedSnapshotValid({ ...valid, audit: [scoredAudit, { ...valid.audit[0], state: "EvidenceVerified", label: "EvidenceVerified", eventHash: "hash-evidence" }] })).toBe(false);
    expect(isPersistedSnapshotValid({ ...valid, audit: [valid.audit[0], { ...valid.audit[0], state: "Rejected", label: "Rejected", eventHash: "hash-rejected", createdAt: new Date(valid.audit[0].createdAt.getTime() + 1_000) }] })).toBe(false);
    const fact = { factId: "fact-1", chain: "Ethereum Sepolia", sourceBlock: 1, txHash: "0xabc", eventType: "REPAYMENT", amount: "1,250 USDC", verificationBlock: 1, freshness: "Fresh", proofRoot: "root-1", verifiedAt: new Date() };
    expect(isPersistedSnapshotValid({ ...valid, facts: [fact] })).toBe(true);
    expect(isPersistedSnapshotValid({ ...valid, facts: Array.from({ length: 65 }, () => fact) })).toBe(false);
    expect(isPersistedSnapshotValid({ ...valid, facts: null as never })).toBe(false);
    expect(isPersistedSnapshotValid({ ...valid, facts: [null] as never })).toBe(false);
    expect(isPersistedSnapshotValid({ ...valid, application: null as never })).toBe(false);
    expect(isPersistedSnapshotValid({ ...valid, application: { ...valid.application, walletAddress: " 0xwallet" } })).toBe(false);
    expect(isPersistedSnapshotValid({ ...valid, application: [] as never })).toBe(false);
    expect(isPersistedSnapshotValid({ ...valid, decision: [] as never })).toBe(false);
    expect(isPersistedSnapshotValid(null as never)).toBe(false);
    expect(isPersistedSnapshotValid({ ...valid, audit: Array.from({ length: 129 }, () => ({ state: "Intake" })) })).toBe(false);
    expect(isPersistedSnapshotValid({ ...valid, audit: null as never })).toBe(false);
    expect(isPersistedSnapshotValid({ ...valid, audit: [null] as never })).toBe(false);
    expect(isPersistedSnapshotValid({ ...valid, audit: [{ state: "Intake", detail: "x".repeat(513) }] })).toBe(false);
    expect(isPersistedSnapshotValid({ ...valid, audit: [{ state: "Intake", detail: 42, createdAt: new Date() }] as never })).toBe(false);
    expect(isPersistedSnapshotValid({ ...valid, audit: [{ state: "Intake", label: "Intake", detail: "short detail", eventHash: "hash-1", createdAt: new Date("invalid") }] })).toBe(false);
    expect(isPersistedSnapshotValid({ ...valid, audit: [{ state: "Intake", label: "x".repeat(65), detail: "short detail", eventHash: "hash-1", createdAt: new Date() }] })).toBe(false);
    expect(isPersistedSnapshotValid({ ...valid, audit: [{ state: "Intake", label: "Intake", detail: "short detail", eventHash: "", createdAt: new Date() }] })).toBe(false);
    expect(isPersistedSnapshotValid({ ...valid, audit: [{ state: "Intake", label: "Intake", detail: "short detail", eventHash: " hash-1", createdAt: new Date() }] })).toBe(false);
    expect(isPersistedSnapshotValid({ ...valid, audit: [{ state: "Intake", label: "   ", detail: "short detail", eventHash: "hash-1", createdAt: new Date() }] })).toBe(false);
    expect(isPersistedSnapshotValid({ ...valid, facts: [{ ...fact, verifiedAt: new Date("invalid") }] })).toBe(false);
    expect(isPersistedSnapshotValid({ ...valid, facts: [{ ...fact, verifiedAt: new Date(2_000) }] }, undefined, 1_000)).toBe(false);
    expect(isPersistedSnapshotValid({ ...valid, audit: [{ ...valid.audit[0], createdAt: new Date(2_000) }] }, undefined, 1_000)).toBe(false);
    expect(isPersistedSnapshotValid({ ...valid, facts: [{ ...fact, txHash: "" }] })).toBe(false);
    expect(isPersistedSnapshotValid({ ...valid, facts: [{ ...fact, txHash: " 0xabc" }] })).toBe(false);
    expect(isPersistedSnapshotValid({ ...valid, facts: [{ ...fact, proofRoot: " root-1" }] })).toBe(false);
    expect(isPersistedSnapshotValid({ ...valid, facts: [{ ...fact, sourceBlock: 12, verificationBlock: 11 }] })).toBe(false);
    expect(isPersistedSnapshotValid({ ...valid, facts: [{ ...fact, factId: "  " }] })).toBe(false);
    expect(isPersistedSnapshotValid({ ...valid, facts: [{ ...fact, factId: " fact-1" }] })).toBe(false);
    expect(isPersistedSnapshotValid({ ...valid, facts: [{ ...fact, factId: "fact-1 " }] })).toBe(false);
    expect(isPersistedSnapshotValid({ ...valid, facts: [{ ...fact, proofRoot: "x".repeat(129) }] })).toBe(false);
    expect(isPersistedSnapshotValid({ ...valid, facts: [fact, { ...fact, txHash: "0xdef" }] })).toBe(false);
    expect(isPersistedSnapshotValid({ ...valid, audit: [valid.audit[0], { ...valid.audit[0], label: "Review" }] })).toBe(false);
  });

  it("rejects malformed audit details before database writes", () => {
    const baseEvent = { state: "Intake" as const, label: "Intake", timestamp: new Date().toISOString(), detail: "short detail", hash: "abc123" };
    expect(buildAuditUpsertValues(baseEvent).values.detail).toBe("short detail");
    expect(() => buildAuditUpsertValues({ ...baseEvent, detail: "x".repeat(513) })).toThrow("Invalid persisted audit detail.");
    expect(() => buildAuditUpsertValues({ ...baseEvent, detail: 42 } as never)).toThrow("Invalid persisted audit detail.");
    expect(() => buildAuditUpsertValues({ ...baseEvent, state: "Unknown", label: "Unknown" } as never)).toThrow("Invalid persisted audit event.");
    expect(() => buildAuditUpsertValues({ ...baseEvent, label: "EvidencePending" } as never)).toThrow("Invalid persisted audit event.");
    expect(() => buildAuditUpsertValues({ ...baseEvent, hash: "   " })).toThrow("Invalid persisted audit event.");
    expect(() => buildAuditUpsertValues({ ...baseEvent, hash: " hash-1" })).toThrow("Invalid persisted audit event.");
    expect(() => buildAuditUpsertValues({ ...baseEvent, hash: "hash-1 " })).toThrow("Invalid persisted audit event.");
    expect(() => buildAuditUpsertValues({ ...baseEvent, timestamp: "invalid" })).toThrow("Invalid persisted audit event.");
  });

  it("rejects malformed decisions and offers before database writes", () => {
    const decision = { pd30: 0.1, pd90: 0.2, confidence: 0.9, freshnessScore: 0.9, riskTier: "B" as const, reasonCodes: ["STRONG_REPAYMENT_HISTORY" as const], modelVersion: "model", featureVersion: "features", evidenceRoot: "root", policyHash: "policy", decisionHash: "decision" };
    expect(buildDecisionUpsertValues(decision).riskTier).toBe("B");
    expect(() => buildDecisionUpsertValues({ ...decision, confidence: Number.NaN })).toThrow("Invalid persisted decision.");
    expect(() => buildDecisionUpsertValues({ ...decision, reasonCodes: ["UNKNOWN"] as never })).toThrow("Invalid persisted decision.");
    expect(() => buildDecisionUpsertValues({ ...decision, modelVersion: " model" })).toThrow("Invalid persisted decision.");
    expect(() => buildDecisionUpsertValues({ ...decision, policyHash: "policy " })).toThrow("Invalid persisted decision.");
    const offer = { amount: 1500, apr: 11.5, ltv: 0.42, termDays: 90, expiresAt: new Date(20_000).toISOString(), poolLiquidity: 100_000, status: "Ready" as const };
    expect(buildOfferUpsertValues(offer, "AwaitingAcceptance", 1500, 10_000).amount).toBe("1500");
    expect(() => buildOfferUpsertValues({ ...offer, amount: 1_501 }, "AwaitingAcceptance", 1500, 10_000)).toThrow("Invalid persisted offer.");
    expect(() => buildOfferUpsertValues(offer, "AwaitingAcceptance", 1500, 20_000)).toThrow("Invalid persisted offer.");
  });

  it("rejects malformed applications before database writes", () => {
    const baseSnapshot = { applicationId: "PL-APPTEST1", walletAddress: "0xborrower", sourceChain: "Ethereum Sepolia" as const, state: "Intake" as const, facts: [], features: { repaymentCount: 0, latePayments: 0, leverageRatio: 0, walletAgeDays: 0, volume7d: 0, volume30d: 0, volume180d: 0, evidenceCount: 0, freshnessScore: 0 }, audit: [] };
    expect(buildApplicationUpsertValues(baseSnapshot).requestedAmount).toBe("1500");
    expect(() => buildApplicationUpsertValues({ ...baseSnapshot, applicationId: " PL-APPTEST1" })).toThrow("Invalid persisted application.");
    expect(() => buildApplicationUpsertValues({ ...baseSnapshot, walletAddress: " 0xborrower" })).toThrow("Invalid persisted application.");
    expect(() => buildApplicationUpsertValues({ ...baseSnapshot, walletAddress: "0xborrower " })).toThrow("Invalid persisted application.");
    expect(() => buildApplicationUpsertValues({ ...baseSnapshot, state: "Unknown" } as never)).toThrow("Invalid persisted application.");
    expect(() => buildApplicationUpsertValues({ ...baseSnapshot, offer: { amount: Number.NaN } } as never)).toThrow("Invalid persisted application.");
    const consistentSnapshot = { ...baseSnapshot, audit: [{ state: "Intake", label: "Intake", timestamp: new Date().toISOString(), detail: "", hash: "hash-intake" }] };
    expect(isLoanSnapshotWriteConsistent(consistentSnapshot as never)).toBe(true);
    expect(isLoanSnapshotWriteConsistent({ ...consistentSnapshot, audit: [] } as never)).toBe(false);
    expect(isLoanSnapshotWriteConsistent({ ...consistentSnapshot, state: "EvidencePending" } as never)).toBe(false);
    expect(isLoanSnapshotWriteConsistent({ ...consistentSnapshot, state: "Scored", decision: undefined } as never)).toBe(false);
  });

  it("rejects malformed verified facts before database writes", () => {
    const baseFact = { id: "fact-1", chain: "Ethereum Sepolia" as const, sourceBlock: 10, txHash: "0xabc", eventType: "REPAYMENT" as const, amount: "1,250 USDC", asset: "USDC", verificationBlock: 11, verifiedAt: new Date().toISOString(), observedAt: new Date().toISOString(), freshness: "Fresh" as const, proofRoot: "root-1", proofWorker: "Attestcoin proof worker" as const };
    expect(buildFactUpsertValues(baseFact).values.factId).toBe("fact-1");
    expect(() => buildFactUpsertValues({ ...baseFact, id: " fact-1" })).toThrow("Invalid persisted verified fact.");
    expect(() => buildFactUpsertValues({ ...baseFact, txHash: " 0xabc" })).toThrow("Invalid persisted verified fact.");
    expect(() => buildFactUpsertValues({ ...baseFact, proofRoot: "root-1 " })).toThrow("Invalid persisted verified fact.");
    expect(() => buildFactUpsertValues({ ...baseFact, verificationBlock: 9 })).toThrow("Invalid persisted verified fact.");
    expect(() => buildFactUpsertValues({ ...baseFact, verifiedAt: "invalid" })).toThrow("Invalid persisted verified fact.");
  });

  it("fails closed for malformed persisted reason codes and accepts domain enums", () => {
    expect(parsePersistedReasonCodes("not-json")).toBeUndefined();
    expect(parsePersistedReasonCodes(42)).toBeUndefined();
    expect(parsePersistedReasonCodes("[" + " ".repeat(512) + "]")).toBeUndefined();
    expect(parsePersistedReasonCodes(JSON.stringify(["NOT_A_REASON"]))).toBeUndefined();
    expect(parsePersistedReasonCodes(JSON.stringify(["HIGH_LEVERAGE", "HIGH_LEVERAGE"]))).toBeUndefined();
    expect(parsePersistedReasonCodes(JSON.stringify(["STRONG_REPAYMENT_HISTORY", "RECENT_LATE_PAYMENT", "HIGH_LEVERAGE", "SPARSE_EVIDENCE", "HIGH_LEVERAGE"]))).toBeUndefined();
    expect(parsePersistedReasonCodes(JSON.stringify(["STRONG_REPAYMENT_HISTORY"]))).toEqual(["STRONG_REPAYMENT_HISTORY"]);
    expect(isProofLoanState("Executed")).toBe(true);
    expect(isProofLoanState("Unknown")).toBe(false);
    expect(isSourceChain("Polygon Amoy")).toBe(true);
    expect(isSourceChain("Mainnet")).toBe(false);
    expect(isVerifiedEventType("REPAYMENT")).toBe(true);
    expect(isVerifiedEventType("TRANSFER")).toBe(false);
    expect(isFreshness("Stale")).toBe(true);
    expect(isFreshness("Unknown")).toBe(false);
    expect(isRiskTier("B")).toBe(true);
    expect(isRiskTier("E")).toBe(false);
    expect(isOfferStatus("Executed")).toBe(true);
    expect(isOfferStatus("Settled")).toBe(false);
    expect(isReasonCode("HIGH_LEVERAGE")).toBe(true);
    expect(isReasonCode("UNKNOWN_REASON")).toBe(false);
  });
});

