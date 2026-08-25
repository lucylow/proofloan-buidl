import { describe, expect, it } from "vitest";
import { getPersistenceRuleGuidance, PERSISTENCE_RULE_GUIDANCE } from "./persistenceDiagnostics";

describe("persistence diagnostics guidance", () => {
  it("provides bounded guidance for every persistence rule", () => {
    expect(PERSISTENCE_RULE_GUIDANCE).toHaveLength(9);
    expect(PERSISTENCE_RULE_GUIDANCE.every(entry => entry.rule && entry.label && entry.guidance)).toBe(true);
  });

  it("returns guidance by stable rule ID only", () => {
    expect(getPersistenceRuleGuidance("APPLICATION_IDENTITY")?.label).toBe("Application identity");
    expect(getPersistenceRuleGuidance("UNKNOWN_RULE")).toBeUndefined();
    expect(JSON.stringify(PERSISTENCE_RULE_GUIDANCE)).not.toMatch(/walletAddress|payload|evidenceRoot/);
  });
});
