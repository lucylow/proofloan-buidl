import { describe, expect, it } from "vitest";
import { cleanProofLoanErrorMessage, getProofLoanErrorCode, isExpectedProofLoanError, isFreshness, isLiveTxHash, isOfferStatus, isProofLoanApplicationId, isProofLoanState, isReasonCode, isRiskTier, isSourceChain, isVerifiedEventType } from "@shared/proofloan";
import { isPersistedSnapshotValid, parsePersistedReasonCodes } from "./db";

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
    const valid = { application: { state: "Executed", sourceChain: "Ethereum Sepolia", requestedAmount: "1500" }, facts: [], decision: { reasonCodes: JSON.stringify(["HIGH_LEVERAGE"]), riskTier: "B", pd30: "0.08", pd90: "0.16", confidence: "0.92" }, offer: { status: "Executed", amount: "1500", apr: "11.5", ltv: "0.54", termDays: 90, expiresAt: new Date(Date.now() + 86_400_000) }, audit: [{ state: "Intake" }] };
    expect(isPersistedSnapshotValid(valid)).toBe(true);
    expect(isPersistedSnapshotValid({ ...valid, application: { ...valid.application, state: "Unknown" } })).toBe(false);
    expect(isPersistedSnapshotValid({ ...valid, application: { ...valid.application, sourceChain: "Mainnet" } })).toBe(false);
    expect(isPersistedSnapshotValid({ ...valid, decision: { ...valid.decision, reasonCodes: "not-json" } })).toBe(false);
    expect(isPersistedSnapshotValid({ ...valid, decision: { ...valid.decision, confidence: "NaN" } })).toBe(false);
    expect(isPersistedSnapshotValid({ ...valid, offer: { ...valid.offer, ltv: "1.5" } })).toBe(false);
    expect(isPersistedSnapshotValid({ ...valid, application: { ...valid.application, requestedAmount: "-1" } })).toBe(false);
    const fact = { chain: "Ethereum Sepolia", eventType: "REPAYMENT", freshness: "Fresh", sourceBlock: 1, verificationBlock: 1 };
    expect(isPersistedSnapshotValid({ ...valid, facts: Array.from({ length: 65 }, () => fact) })).toBe(false);
    expect(isPersistedSnapshotValid({ ...valid, audit: Array.from({ length: 129 }, () => ({ state: "Intake" })) })).toBe(false);
  });

  it("fails closed for malformed persisted reason codes and accepts domain enums", () => {
    expect(parsePersistedReasonCodes("not-json")).toBeUndefined();
    expect(parsePersistedReasonCodes(JSON.stringify(["NOT_A_REASON"]))).toBeUndefined();
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

