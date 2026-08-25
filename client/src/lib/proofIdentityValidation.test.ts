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

  it("requires a usable identity before submission", () => {
    expect(getProofIdentityValidationError("short", "Ethereum Sepolia")).toContain("preview identifier");
  });
});
