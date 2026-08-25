import { describe, expect, it } from "vitest";
import { getProofIdentityValidationError } from "./proofIdentityValidation";

describe("proof identity validation", () => {
  it("allows explicit preview identifiers", () => {
    expect(getProofIdentityValidationError("0xborrower", "Ethereum Sepolia")).toBeUndefined();
  });

  it("allows valid EVM wallet identities on supported chains", () => {
    expect(getProofIdentityValidationError(`0x${"a".repeat(40)}`, "Polygon Amoy")).toBeUndefined();
  });

  it("explains malformed address-shaped values", () => {
    expect(getProofIdentityValidationError(`0x${"g".repeat(40)}`, "Ethereum Sepolia")).toContain("valid EVM");
  });

  it("explains malformed hash-shaped values", () => {
    expect(getProofIdentityValidationError("0x1234567890abcdef", "Ethereum Sepolia")).toContain("32-byte hexadecimal");
    expect(getProofIdentityValidationError("0x71C7...9A2F", "Ethereum Sepolia")).toBeUndefined();
  });

  it("validates explicit wallet and source transaction fields independently", () => {
    expect(getProofIdentityValidationError(`0x${"a".repeat(40)}`, `0x${"b".repeat(64)}`, "Ethereum Sepolia")).toBeUndefined();
    expect(getProofIdentityValidationError(`0x${"a".repeat(40)}`, "0x1234", "Ethereum Sepolia")).toContain("32-byte hexadecimal");
    expect(getProofIdentityValidationError("0xborrower", `0x${"b".repeat(64)}`, "Ethereum Sepolia")).toContain("valid EVM wallet");
  });

  it("requires a usable identity before submission", () => {
    expect(getProofIdentityValidationError("short", "Ethereum Sepolia")).toContain("preview identifier");
  });
});
