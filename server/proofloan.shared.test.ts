import { describe, expect, it } from "vitest";
import { isFreshness, isLiveTxHash, isOfferStatus, isProofLoanState, isReasonCode, isRiskTier, isSourceChain, isVerifiedEventType } from "@shared/proofloan";
import { isPersistedSnapshotValid, parsePersistedReasonCodes } from "./db";

describe("ProofLoan shared validation", () => {
  it("accepts a canonical 32-byte hexadecimal transaction hash", () => {
    expect(isLiveTxHash(`0x${"a".repeat(64)}`)).toBe(true);
  });

  it("rejects malformed, short, and non-hex transaction values", () => {
    expect(isLiveTxHash("0x71C7...9A2F")).toBe(false);
    expect(isLiveTxHash(`0x${"a".repeat(63)}`)).toBe(false);
    expect(isLiveTxHash(`0x${"g".repeat(64)}`)).toBe(false);
    expect(isLiveTxHash("71C7...9A2F")).toBe(false);
  });

  it("fails closed for invalid persisted snapshot rows", () => {
    const valid = { application: { state: "Executed", sourceChain: "Ethereum Sepolia" }, facts: [], decision: { reasonCodes: JSON.stringify(["HIGH_LEVERAGE"]), riskTier: "B" }, offer: { status: "Executed" }, audit: [{ state: "Intake" }] };
    expect(isPersistedSnapshotValid(valid)).toBe(true);
    expect(isPersistedSnapshotValid({ ...valid, application: { ...valid.application, state: "Unknown" } })).toBe(false);
    expect(isPersistedSnapshotValid({ ...valid, application: { ...valid.application, sourceChain: "Mainnet" } })).toBe(false);
    expect(isPersistedSnapshotValid({ ...valid, decision: { ...valid.decision, reasonCodes: "not-json" } })).toBe(false);
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

