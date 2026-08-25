import { describe, expect, it } from "vitest";
import { getProofRequestIdempotencyKey } from "./proofRequestIdempotency";

describe("proof-request idempotency helper", () => {
  it("reuses a key for the same trimmed wallet and chain", () => {
    const first = getProofRequestIdempotencyKey(null, "  0xwallet  ", "Ethereum Sepolia", () => "request-1");
    const retry = getProofRequestIdempotencyKey(first, "0xwallet", "Ethereum Sepolia", () => "request-2");
    expect(retry).toBe(first);
  });

  it("rotates a key when request inputs change", () => {
    const first = getProofRequestIdempotencyKey(null, "0xwallet", "Ethereum Sepolia", () => "request-1");
    const next = getProofRequestIdempotencyKey(first, "0xwallet", "Polygon Amoy", () => "request-2");
    expect(next).toEqual({ fingerprint: "0xwallet::Polygon Amoy", key: "proof-request-2" });
  });

  it("includes an explicit source transaction hash in the replay fingerprint", () => {
    const hash = `0x${"b".repeat(64)}`;
    const first = getProofRequestIdempotencyKey(null, "0xwallet", "Ethereum Sepolia", () => "request-1", hash);
    const next = getProofRequestIdempotencyKey(first, "0xwallet", "Ethereum Sepolia", () => "request-2", `0x${"c".repeat(64)}`);
    expect(first.fingerprint).toBe(`0xwallet::${hash}::Ethereum Sepolia`);
    expect(next.key).toBe("proof-request-2");
  });
});
