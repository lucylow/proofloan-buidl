import { describe, expect, it } from "vitest";
import { filterPersistenceFailureHistory, getPersistenceFailureFreshness, getPersistenceRuleGuidance, getPersistenceRuleRecurrence, PERSISTENCE_RULE_GUIDANCE, readPersistenceFailureHistoryFilter, writePersistenceFailureHistoryFilter } from "./persistenceDiagnostics";

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

  it("filters persistence history by freshness without exposing invalid entries", () => {
    const now = Date.parse("2026-08-25T00:00:00.000Z");
    const history = [
      { rule: "APPLICATION_IDENTITY", observedAt: "2026-08-24T23:59:00.000Z" },
      { rule: "SNAPSHOT_INTEGRITY", observedAt: "2026-08-24T23:00:00.000Z" },
      { rule: "UNKNOWN_RULE", observedAt: "2026-08-24T23:59:00.000Z" },
    ];
    expect(filterPersistenceFailureHistory(history, "current", now)).toEqual([history[0]]);
    expect(filterPersistenceFailureHistory(history, "stale", now)).toEqual([history[1]]);
    expect(filterPersistenceFailureHistory(history, "all", now)).toEqual([history[0], history[1]]);
  });

  it("persists only allowlisted diagnostic filters and fails safely when storage is blocked", () => {
    const values = new Map<string, string>();
    const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) };
    expect(writePersistenceFailureHistoryFilter(storage, "stale")).toBe(true);
    expect(readPersistenceFailureHistoryFilter(storage)).toBe("stale");
    values.set("proofloan.persistence-history-filter", "wallet-secret");
    expect(readPersistenceFailureHistoryFilter(storage)).toBe("all");
    expect(readPersistenceFailureHistoryFilter({ getItem: () => { throw new Error("blocked"); } })).toBe("all");
    expect(writePersistenceFailureHistoryFilter({ setItem: () => { throw new Error("blocked"); } }, "current")).toBe(false);
    expect(JSON.stringify(values)).not.toContain("wallet");
  });
});
