import { describe, expect, it } from "vitest";
import { buildPersistenceDiagnosticsExport, clearPersistenceFailureAlertAcknowledgment, clearPersistenceFailureAlertUnacknowledgment, filterPersistenceFailureHistory, getPersistenceFailureAlertAcknowledgmentKey, getPersistenceFailureAlertAcknowledgmentNotice, getPersistenceFailureAlertUnacknowledgmentNotice, getPersistenceFailureAlertExplanation, getPersistenceFailureAlertEscalationNotice, getPersistenceFailureAlertLabel, getPersistenceFailureAlertLevel, getPersistenceHistoryFilterSummary, getPersistenceFailureFreshness, getPersistenceFailureTrend, getPersistenceFilterRestorationNotice, getPersistenceRuleGuidance, getPersistenceRuleRecurrence, isPersistenceFailureAlertAcknowledged, isPersistenceFailureAlertUnacknowledged, normalizePersistenceFailureAlertThresholds, PERSISTENCE_RULE_GUIDANCE, readPersistenceFailureAlertAcknowledgment, readPersistenceFailureAlertThresholds, readPersistenceFailureAlertUnacknowledgment, readPersistenceFailureHistoryFilter, writePersistenceFailureAlertAcknowledgment, writePersistenceFailureAlertUnacknowledgment, writePersistenceFailureAlertThresholds, writePersistenceFailureHistoryFilter } from "./persistenceDiagnostics";

describe("persistence diagnostics guidance", () => {
  it("serializes only bounded, privacy-safe diagnostics for operator export", () => {
    const payload = buildPersistenceDiagnosticsExport({ exportedAt: "2026-08-25T00:00:00.000Z", filter: "all", history: [
      { rule: "APPLICATION_IDENTITY", observedAt: "2026-08-24T23:59:00.000Z" },
      { rule: "UNKNOWN_RULE", observedAt: "2026-08-24T23:59:00.000Z" },
      ...Array.from({ length: 10 }, (_, index) => ({ rule: "CLOCK_INVALID", observedAt: `2026-08-24T23:${40 + index}:00.000Z` })),
    ], trend: { direction: "rising", priorCount: 10, recentCount: 12 }, alert: "critical", thresholds: { watchCount: 2, criticalCount: 4 } });
    const parsed = JSON.parse(payload) as Record<string, unknown>;
    expect(parsed.schemaVersion).toBe(1);
    expect(parsed.scope).toBe("all");
    expect(parsed.exportedAt).toBe("2026-08-25T00:00:00.000Z");
    expect((parsed.history as unknown[]).length).toBeLessThanOrEqual(6);
    expect(payload).not.toMatch(/walletAddress|sourceTransactionHash|payload|evidenceRoot/);
    expect(payload).toContain("CLOCK_INVALID");
  });

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

  it("classifies bounded recurrence alert levels without exposing raw details", () => {
    expect(getPersistenceFailureAlertLevel(0)).toBe("clear");
    expect(getPersistenceFailureAlertLevel(2)).toBe("watch");
    expect(getPersistenceFailureAlertLevel(4)).toBe("critical");
    expect(getPersistenceFailureAlertLevel(Number.NaN)).toBe("clear");
    expect(getPersistenceFailureAlertLevel(6, { watchCount: 1, criticalCount: 99 })).toBe("critical");
    expect(getPersistenceFailureAlertLabel("watch")).toBe("Watch recurrence");
    expect(JSON.stringify(getPersistenceFailureAlertLabel("critical"))).not.toMatch(/wallet|payload|evidence/);
  });

  it("summarizes the selected filter with bounded safe counts", () => {
    expect(getPersistenceHistoryFilterSummary("all", 6)).toBe("All persistence history: 6 safe entries.");
    expect(getPersistenceHistoryFilterSummary("current", 1)).toBe("Current persistence history: 1 safe entry.");
    expect(getPersistenceHistoryFilterSummary("stale", 99)).toBe("Stale persistence history: 6 safe entries.");
    expect(JSON.stringify(getPersistenceHistoryFilterSummary("all", 6))).not.toMatch(/wallet|payload|evidence/);
  });

  it("detects only watch-to-critical escalation without sensitive values", () => {
    expect(getPersistenceFailureAlertEscalationNotice("watch", "critical")).toContain("escalated from watch to critical");
    expect(getPersistenceFailureAlertEscalationNotice("clear", "critical")).toBeNull();
    expect(getPersistenceFailureAlertEscalationNotice("critical", "watch")).toBeNull();
    expect(JSON.stringify(getPersistenceFailureAlertEscalationNotice("watch", "critical"))).not.toMatch(/wallet|payload|evidence/);
  });

  it("explains threshold-aware alert states without sensitive values", () => {
    expect(getPersistenceFailureAlertExplanation("watch", 2, { watchCount: 2, criticalCount: 4 })).toContain("watch threshold of 2");
    expect(getPersistenceFailureAlertExplanation("critical", 6, { watchCount: 2, criticalCount: 4 })).toContain("critical threshold of 4");
    expect(getPersistenceFailureAlertExplanation("clear", 0)).toBe("Recent persistence failures are below the configured watch threshold.");
    expect(JSON.stringify(getPersistenceFailureAlertExplanation("critical", 6))).not.toMatch(/wallet|payload|evidence/);
  });

  it("normalizes and persists only bounded threshold values", () => {
    expect(normalizePersistenceFailureAlertThresholds({ watchCount: -4, criticalCount: 99 })).toEqual({ watchCount: 1, criticalCount: 6 });
    expect(normalizePersistenceFailureAlertThresholds({ watchCount: 4, criticalCount: 2 })).toEqual({ watchCount: 4, criticalCount: 5 });
    const values = new Map<string, string>();
    const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) };
    expect(writePersistenceFailureAlertThresholds(storage, { watchCount: 3, criticalCount: 5 })).toBe(true);
    expect(readPersistenceFailureAlertThresholds(storage)).toEqual({ watchCount: 3, criticalCount: 5 });
    values.set("proofloan.persistence-alert-thresholds", "wallet-secret");
    expect(readPersistenceFailureAlertThresholds(storage)).toEqual({ watchCount: 2, criticalCount: 4 });
    expect(JSON.stringify(values)).not.toContain("wallet");
  });

  it("describes restored filters without exposing storage contents", () => {
    expect(getPersistenceFilterRestorationNotice("current", true)).toBe("Restored the current persistence failures view for this session.");
    expect(getPersistenceFilterRestorationNotice("stale", true)).toBe("Restored the stale persistence failures view for this session.");
    expect(getPersistenceFilterRestorationNotice("all", true)).toBeNull();
    expect(getPersistenceFilterRestorationNotice("current", false)).toBeNull();
    expect(JSON.stringify(getPersistenceFilterRestorationNotice("stale", true))).not.toMatch(/wallet|payload|evidence/);
  });

  it("persists only a bounded critical acknowledgment and fails safely when storage is blocked", () => {
    const values = new Map<string, string>();
    const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key) };
    const acknowledgment = { filter: "current" as const, level: "critical" as const, recentCount: 4, acknowledgedAt: "2026-08-25T00:00:00.000Z" };
    expect(writePersistenceFailureAlertAcknowledgment(storage, acknowledgment)).toBe(true);
    expect(readPersistenceFailureAlertAcknowledgment(storage)).toEqual(acknowledgment);
    expect(clearPersistenceFailureAlertAcknowledgment(storage)).toBe(true);
    expect(readPersistenceFailureAlertAcknowledgment(storage)).toBeNull();
    expect(clearPersistenceFailureAlertAcknowledgment(undefined)).toBe(false);
    values.set("proofloan.persistence-alert-acknowledgment", JSON.stringify({ filter: "all", level: "watch", recentCount: 2, walletAddress: "secret" }));
    expect(readPersistenceFailureAlertAcknowledgment(storage)).toBeNull();
    values.set("proofloan.persistence-alert-acknowledgment", JSON.stringify({ filter: "all", level: "critical", recentCount: 2, acknowledgedAt: "not-a-date", payload: "secret" }));
    expect(readPersistenceFailureAlertAcknowledgment(storage)).toBeNull();
    expect(readPersistenceFailureAlertAcknowledgment({ getItem: () => { throw new Error("blocked"); } })).toBeNull();
    expect(writePersistenceFailureAlertAcknowledgment({ setItem: () => { throw new Error("blocked"); } }, acknowledgment)).toBe(false);
    expect(clearPersistenceFailureAlertAcknowledgment({ removeItem: () => { throw new Error("blocked"); } })).toBe(false);
    expect(JSON.stringify(values)).not.toContain("walletAddress");
  });

  it("matches acknowledgment only to the bounded critical scope and count", () => {
    const key = getPersistenceFailureAlertAcknowledgmentKey("stale", "critical", 99);
    expect(key).toBe("stale:critical:6");
    expect(getPersistenceFailureAlertAcknowledgmentKey("all", "watch", 6)).toBeNull();
    expect(isPersistenceFailureAlertAcknowledged({ filter: "stale", level: "critical", recentCount: 6, acknowledgedAt: "2026-08-25T00:00:00.000Z" }, key)).toBe(true);
    expect(isPersistenceFailureAlertAcknowledged({ filter: "current", level: "critical", recentCount: 6, acknowledgedAt: "2026-08-25T00:00:00.000Z" }, key)).toBe(false);
    expect(isPersistenceFailureAlertAcknowledged({ filter: "stale", level: "critical", recentCount: 5, acknowledgedAt: "2026-08-25T00:00:00.000Z" }, key)).toBe(false);
    expect(getPersistenceFailureAlertAcknowledgmentNotice("all", 1, "2026-08-25T00:00:00.000Z")).toBe("Critical persistence recurrence acknowledged for the all scope (1 recent safe failure) at 2026-08-25T00:00:00.000Z for this session.");
    expect(JSON.stringify(getPersistenceFailureAlertAcknowledgmentNotice("stale", 6))).not.toMatch(/wallet|payload|evidence/);
  });

  it("persists only a bounded unacknowledgment timestamp and fails closed on invalid data", () => {
    const values = new Map<string, string>();
    const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key) };
    const unacknowledgment = { filter: "current" as const, level: "critical" as const, recentCount: 4, unacknowledgedAt: "2026-08-25T00:00:00.000Z" };
    expect(writePersistenceFailureAlertUnacknowledgment(storage, unacknowledgment)).toBe(true);
    expect(readPersistenceFailureAlertUnacknowledgment(storage)).toEqual(unacknowledgment);
    const currentKey = getPersistenceFailureAlertAcknowledgmentKey("current", "critical", 4);
    expect(isPersistenceFailureAlertUnacknowledged(unacknowledgment, currentKey)).toBe(true);
    expect(isPersistenceFailureAlertUnacknowledged({ filter: "stale", level: "critical", recentCount: 4, unacknowledgedAt: unacknowledgment.unacknowledgedAt }, currentKey)).toBe(false);
    expect(isPersistenceFailureAlertUnacknowledged({ filter: "current", level: "critical", recentCount: 5, unacknowledgedAt: unacknowledgment.unacknowledgedAt }, currentKey)).toBe(false);
    expect(clearPersistenceFailureAlertUnacknowledgment(storage)).toBe(true);
    expect(readPersistenceFailureAlertUnacknowledgment(storage)).toBeNull();
    expect(clearPersistenceFailureAlertUnacknowledgment(undefined)).toBe(false);
    values.set("proofloan.persistence-alert-unacknowledgment", JSON.stringify({ filter: "current", level: "critical", recentCount: 4, unacknowledgedAt: "not-a-date", payload: "secret" }));
    expect(readPersistenceFailureAlertUnacknowledgment(storage)).toBeNull();
    expect(readPersistenceFailureAlertUnacknowledgment({ getItem: () => { throw new Error("blocked"); } })).toBeNull();
    expect(writePersistenceFailureAlertUnacknowledgment({ setItem: () => { throw new Error("blocked"); } }, unacknowledgment)).toBe(false);
    expect(clearPersistenceFailureAlertUnacknowledgment({ removeItem: () => { throw new Error("blocked"); } })).toBe(false);
    expect(getPersistenceFailureAlertUnacknowledgmentNotice("stale", 1, "2026-08-25T00:00:00.000Z")).toBe("Critical persistence recurrence unacknowledged for the stale scope (1 recent safe failure) at 2026-08-25T00:00:00.000Z; the escalation remains visible for this session.");
    expect(JSON.stringify(getPersistenceFailureAlertUnacknowledgmentNotice("all", 6))).not.toMatch(/wallet|payload|evidence/);
  });

  it("classifies bounded persistence failure recurrence trends without raw details", () => {
    const at = (minute: number, rule = "APPLICATION_IDENTITY") => ({ rule, observedAt: `2026-08-25T00:${String(minute).padStart(2, "0")}:00.000Z` });
    expect(getPersistenceFailureTrend([at(0), at(1), at(2), at(3)])).toMatchObject({ direction: "flat", priorCount: 2, recentCount: 2 });
    expect(getPersistenceFailureTrend([at(0), at(1), at(2), at(3), at(4), at(5)])).toMatchObject({ direction: "flat" });
    expect(getPersistenceFailureTrend([at(0), at(1), at(2)])).toMatchObject({ direction: "insufficient" });
    expect(getPersistenceFailureTrend([at(0), at(1), at(2), { rule: "UNKNOWN", observedAt: at(3).observedAt }])).toMatchObject({ direction: "insufficient" });
    expect(JSON.stringify(getPersistenceFailureTrend([at(0), at(1), at(2), at(3)]))).not.toMatch(/wallet|payload|evidence/);
  });
});
