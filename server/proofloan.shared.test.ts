import { describe, expect, it } from "vitest";
import { isLiveTxHash } from "@shared/proofloan";

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
});

