import { describe, expect, it } from "vitest";
import { getPersistenceFailureFreshness, getPersistenceRuleGuidance, getPersistenceRuleRecurrence, PERSISTENCE_RULE_GUIDANCE } from "./persistenceDiagnostics";

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

  it("classifies persistence failure freshness without exposing input details", () => {
    const now = Date.parse("2026-08-25T00:00:00.000Z");
    expect(getPersistenceFailureFreshness("2026-08-24T23:59:00.000Z", now)).toBe("fresh");
    expect(getPersistenceFailureFreshness("2026-08-24T23:50:00.000Z", now)).toBe("stale");
    expect(getPersistenceFailureFreshness("2026-08-25T00:03:00.000Z", now)).toBe("future");
    expect(getPersistenceFailureFreshness("not-a-date", now)).toBe("invalid");
    expect(getPersistenceFailureFreshness("2026-08-24T23:59:00.000Z", Number.NaN)).toBe("invalid");
  });

  it("summarizes only bounded allowlisted persistence rule recurrence", () => {
    const summary = getPersistenceRuleRecurrence([
      { rule: "SNAPSHOT_INTEGRITY" }, { rule: "APPLICATION_IDENTITY" }, { rule: "SNAPSHOT_INTEGRITY" }, { rule: "UNKNOWN_RULE" },
    ]);
    expect(summary).toEqual([{ rule: "APPLICATION_IDENTITY", count: 1 }, { rule: "SNAPSHOT_INTEGRITY", count: 2 }]);
    expect(getPersistenceRuleRecurrence(Array.from({ length: 12 }, () => ({ rule: "AUDIT_METADATA" })))).toEqual([{ rule: "AUDIT_METADATA", count: 6 }]);
    expect(JSON.stringify(summary)).not.toMatch(/wallet|payload|evidence/);
  });
});
