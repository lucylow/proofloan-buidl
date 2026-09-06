import { describe, expect, it } from "vitest";
import { ATTESTCOIN_INTEGRATION_STAGES, ATTESTCOIN_INTEGRATION_VERSION, getAttestcoinIntegrationSummary, isAttestcoinLifecycleStage } from "@shared/attestcoin-integration";

describe("Attestcoin integration summary", () => {
  it("describes the real live USC SDK lifecycle in stable order", () => {
    expect(ATTESTCOIN_INTEGRATION_VERSION).toBe("attestcoin-integration-v1.1.0");
    expect(ATTESTCOIN_INTEGRATION_STAGES.map(stage => stage.stage)).toEqual([
      "SOURCE_LOOKUP",
      "WAITING_ATTESTATION",
      "PROOF_BUILDING",
      "CREDITCOIN_VERIFYING",
      "VERIFIED",
    ]);
    expect(getAttestcoinIntegrationSummary("LIVE").stages).toHaveLength(5);
    expect(getAttestcoinIntegrationSummary("LIVE").description).toContain("USC SDK");
  });

  it("keeps preview explicitly separate from live proof authority", () => {
    const preview = getAttestcoinIntegrationSummary("PREVIEW");
    expect(preview.headline).toBe("Preview adapter path");
    expect(preview.description).toContain("mock history");
  });

  it("does not include identifiers or payload data in the public summary", () => {
    const serialized = JSON.stringify(getAttestcoinIntegrationSummary("LIVE"));
    expect(serialized).not.toMatch(/0x|wallet|payload|txHash|proofRoot/i);
  });

  it("recognizes only documented lifecycle stages", () => {
    expect(isAttestcoinLifecycleStage("CREDITCOIN_VERIFYING")).toBe(true);
    expect(isAttestcoinLifecycleStage("FAIL_CLOSED")).toBe(true);
    expect(isAttestcoinLifecycleStage("SECRET_STAGE")).toBe(false);
  });
});
