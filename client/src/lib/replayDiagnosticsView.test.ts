import { describe, expect, it } from "vitest";
import { appendReplayRefreshThresholdAuditEvent, areReplayRefreshSeverityThresholdsEqual, getReplayRefreshThresholdAuditAriaLabel, getReplayRefreshThresholdAuditLabel, getReplayRefreshSeverityExplanation, getReplayRefreshSeverityStatusSummary, getReplayRefreshSeverityNotice, getReplayRefreshSeverityPersistenceNotice, getReplayRefreshSeverityPersistenceStatus, getReplayRefreshSeverityPersistenceTransition, persistReplayRefreshSeverityThresholds, shouldApplyReplayRefreshPersistenceUpdate, normalizeReplayRefreshTimeline, getReplayRefreshFilterChangeNotice, getReplayRefreshFilterChangeScopeNotice, getReplayRefreshFilterLabel, getReplayRefreshFilterRestorationNotice, getReplayRefreshFilterScopeLabel, readReplayRefreshTimelineFilter, writeReplayRefreshTimelineFilter } from "./replayDiagnosticsView";
import { appendReplayRefreshTimelineEvent, categorizeReplayRefreshFailure, filterReplayRefreshTimeline, formatReplayDiagnosticsTimestamp, getReplayDiagnosticsFreshness, getReplayDiagnosticsRefreshFeedback, getReplayDiagnosticsRefreshState, getReplayDiagnosticsRows, getReplayRefreshCategoryCounts, getReplayRefreshCategoryTrends, getReplayRefreshTimelineSummary, normalizeReplayRefreshSeverityThresholds, readReplayRefreshSeverityThresholds, writeReplayRefreshSeverityThresholds, shouldShowReplayRefreshFilterReset, getReplayRefreshTrend, normalizeReplayDiagnostics, shouldApplyReplayRefreshOutcome } from "./replayDiagnosticsView";

describe("replay diagnostics view model", () => {
  it("normalizes malformed timeline entries without exposing raw values", () => {
    const normalized = normalizeReplayRefreshTimeline([
      { id: 1, occurredAt: "not-a-date", outcome: "error", category: "unknown", raw: "secret" },
      { id: -4, occurredAt: "2026-08-24T12:00:00.000Z", outcome: "success", category: "malformed" },
      null,
      { id: 2, occurredAt: "2026-08-24T12:01:00.000Z", outcome: "error", category: "unavailable" },
    ]);
    expect(normalized).toHaveLength(3);
    expect(normalized[0]).toMatchObject({ id: 1, outcome: "error", category: "request_error", occurredAt: "1970-01-01T00:00:00.000Z" });
    expect(normalized[1]).toMatchObject({ id: 1, outcome: "success" });
    expect(normalized[1]).not.toHaveProperty("category");
    expect(JSON.stringify(normalized)).not.toContain("secret");
    expect(normalizeReplayRefreshTimeline("invalid")).toEqual([]);
  });

  it("maps every supported filter to a safe operator label", () => {
    expect(["all", "failures", "unavailable", "malformed", "request_error"].map(filter => getReplayRefreshFilterLabel(filter as any))).toEqual(["All attempts", "Failures only", "Service unavailable", "Invalid response", "Request error"]);
  });

  it("describes only allowlisted filter changes and stays silent when unchanged", () => {
    expect(getReplayRefreshFilterChangeNotice("all", "failures")).toBe("Filter changed to failures only");
    expect(getReplayRefreshFilterChangeNotice("failures", "malformed")).toBe("Filter changed to invalid response");
    expect(getReplayRefreshFilterChangeNotice("all", "all")).toBeNull();
  });

  it("includes only bounded matching counts in changed-filter notices", () => {
    expect(getReplayRefreshFilterChangeScopeNotice("all", "failures", 3)).toBe("Filter changed to failures only · 3");
    expect(getReplayRefreshFilterChangeScopeNotice("all", "malformed", 99)).toBe("Filter changed to invalid response · 6");
    expect(getReplayRefreshFilterChangeScopeNotice("all", "request_error", Number.NaN)).toBe("Filter changed to request error · 0");
    expect(getReplayRefreshFilterChangeScopeNotice("failures", "failures", 4)).toBeNull();
  });

  it("bounds matching-count labels and never exposes invalid count values", () => {
    expect(getReplayRefreshFilterScopeLabel("failures", 4)).toBe("Failures only · 4");
    expect(getReplayRefreshFilterScopeLabel("malformed", 99)).toBe("Invalid response · 6");
    expect(getReplayRefreshFilterScopeLabel("request_error", -4)).toBe("Request error · 0");
    expect(getReplayRefreshFilterScopeLabel("all", Number.NaN)).toBe("All attempts · 0");
  });

  it("describes restored filters without exposing storage values", () => {
    expect(getReplayRefreshFilterRestorationNotice("failures", true)).toBe("Restored the failures view");
    expect(getReplayRefreshFilterRestorationNotice("malformed", true)).toBe("Restored the invalid response view");
    expect(getReplayRefreshFilterRestorationNotice("all", true)).toBe("Restored the full refresh timeline");
    expect(getReplayRefreshFilterRestorationNotice("failures", false)).toBeNull();
  });

  it("restores only validated session filters and fails safely when storage is blocked", () => {
    const values = new Map<string, string>();
    const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
    writeReplayRefreshTimelineFilter(storage, "malformed");
    expect(readReplayRefreshTimelineFilter(storage)).toBe("malformed");
    values.set("proofloan.replay-refresh-filter", "wallet-secret");
    expect(readReplayRefreshTimelineFilter(storage)).toBe("all");
    expect(readReplayRefreshTimelineFilter({ getItem: () => { throw new Error("blocked"); } })).toBe("all");
    expect(() => writeReplayRefreshTimelineFilter({ setItem: () => { throw new Error("blocked"); } }, "failures")).not.toThrow();
  });

  it("marks stale records for operator attention", () => {
    expect(getReplayDiagnosticsRows({ acceptance: { pending: 3, stale: 1 }, proofRequest: { pending: 2, stale: 0 } })).toEqual([
      { label: "Acceptance", pending: 3, stale: 1, tone: "attention" },
      { label: "Proof requests", pending: 2, stale: 0, tone: "clear" },
    ]);
  });

  it("classifies fresh, stale, future, and invalid diagnostics timestamps", () => {
    const now = Date.parse("2026-08-24T00:00:00.000Z");
    expect(getReplayDiagnosticsFreshness("2026-08-23T23:59:30.000Z", now)).toBe("fresh");
    expect(getReplayDiagnosticsFreshness("2026-08-23T23:55:00.000Z", now)).toBe("stale");
    expect(getReplayDiagnosticsFreshness("2026-08-24T00:03:00.000Z", now)).toBe("future");
    expect(getReplayDiagnosticsFreshness("not-a-date", now)).toBe("invalid");
  });

  it("marks rows for attention when diagnostics are not fresh", () => {
    expect(getReplayDiagnosticsRows({ generatedAt: "2026-08-24T00:00:00.000Z", acceptance: { pending: 1, stale: 0 }, proofRequest: { pending: 1, stale: 0 } }, "stale").every(row => row.tone === "attention")).toBe(true);
  });

  it("gates manual refresh while offline or already fetching", () => {
    expect(getReplayDiagnosticsRefreshState({ isOnline: false, isFetching: false })).toEqual({ enabled: false, label: "Offline" });
    expect(getReplayDiagnosticsRefreshState({ isOnline: true, isFetching: true })).toEqual({ enabled: false, label: "Refreshing" });
    expect(getReplayDiagnosticsRefreshState({ isOnline: true, isFetching: false })).toEqual({ enabled: true, label: "Refresh now" });
  });

  it("filters to bounded failures while preserving newest-first source order", () => {
    const events = [
      { id: 1, occurredAt: "2026-08-24T00:00:00.000Z", outcome: "success" as const },
      { id: 2, occurredAt: "2026-08-24T00:01:00.000Z", outcome: "error" as const, category: "unavailable" as const },
      { id: 3, occurredAt: "2026-08-24T00:02:00.000Z", outcome: "success" as const },
      { id: 4, occurredAt: "2026-08-24T00:03:00.000Z", outcome: "error" as const, category: "malformed" as const },
    ];
    expect(filterReplayRefreshTimeline(events, "failures").map(event => event.id)).toEqual([2, 4]);
    expect(filterReplayRefreshTimeline(events, "all")).toHaveLength(4);
    expect(filterReplayRefreshTimeline(events, "failures").every(event => event.outcome === "error")).toBe(true);
    expect(filterReplayRefreshTimeline(events, "malformed").map(event => event.id)).toEqual([4]);
    expect(filterReplayRefreshTimeline(events, "request_error")).toEqual([]);
    expect(shouldShowReplayRefreshFilterReset({ filter: "request_error", visibleCount: 0 })).toBe(true);
    expect(shouldShowReplayRefreshFilterReset({ filter: "request_error", visibleCount: 1 })).toBe(false);
    expect(shouldShowReplayRefreshFilterReset({ filter: "all", visibleCount: 0 })).toBe(false);
  });

  it("classifies bounded failure trends without exposing event details", () => {
    const event = (id: number, outcome: "success" | "error") => ({ id, occurredAt: `2026-08-24T00:0${id}:00.000Z`, outcome });
    expect(getReplayRefreshTrend([event(1, "success"), event(2, "success"), event(3, "error"), event(4, "error")])).toMatchObject({ direction: "rising", confidence: "medium", priorSampleSize: 2, recentSampleSize: 2, priorFailureRatePercent: 0, recentFailureRatePercent: 100 });
    expect(getReplayRefreshTrend([event(1, "error"), event(2, "error"), event(3, "success"), event(4, "success")])).toMatchObject({ direction: "falling" });
    expect(getReplayRefreshTrend([event(1, "error"), event(2, "success"), event(3, "error"), event(4, "success")])).toMatchObject({ direction: "flat" });
    expect(getReplayRefreshTrend([event(1, "error"), event(2, "success")])).toMatchObject({ direction: "insufficient", confidence: "low", priorSampleSize: 0, recentSampleSize: 0 });
    expect(getReplayRefreshTrend([event(1, "success"), event(2, "success"), event(3, "success"), event(4, "success"), event(5, "error"), event(6, "error")])).toMatchObject({ confidence: "high", recentSampleSize: 3, priorSampleSize: 3 });
  });

  it("compares coarse failure categories across bounded windows without raw details", () => {
    const event = (id: number, category: "unavailable" | "malformed" | "request_error") => ({ id, occurredAt: `2026-08-24T00:0${id}:00.000Z`, outcome: "error" as const, category });
    const trends = getReplayRefreshCategoryTrends([event(1, "unavailable"), event(2, "malformed"), event(3, "unavailable"), event(4, "unavailable"), event(5, "request_error"), event(6, "unavailable")]);
    expect(trends).toEqual([
      { category: "unavailable", direction: "flat", severity: "neutral", recentCount: 2, priorCount: 2 },
      { category: "malformed", direction: "falling", severity: "neutral", recentCount: 0, priorCount: 1 },
      { category: "request_error", direction: "rising", severity: "attention", recentCount: 1, priorCount: 0 },
    ]);
    expect(getReplayRefreshCategoryTrends([event(1, "malformed")])).toEqual([{ category: "malformed", direction: "insufficient", severity: "neutral", recentCount: 1, priorCount: 0 }]);
  });

  it("explains normalized threshold semantics without raw diagnostics", () => {
    expect(getReplayRefreshSeverityExplanation({ attentionCount: 1, criticalCount: 3 })).toBe("Attention at 1 recent event; critical at 3. Based on the bounded six-event window.");
    expect(getReplayRefreshSeverityExplanation({ attentionCount: 9, criticalCount: -2 })).toBe("Attention at 2 recent events; critical at 3. Based on the bounded six-event window.");
    expect(getReplayRefreshSeverityStatusSummary({ attentionCount: 1, criticalCount: 2 })).toBe("Attention threshold: 1 recent event. Critical threshold: 2 recent events.");
    expect(getReplayRefreshSeverityStatusSummary({ attentionCount: 9, criticalCount: -2 })).toBe("Attention threshold: 2 recent events. Critical threshold: 3 recent events.");
    expect(areReplayRefreshSeverityThresholdsEqual({ attentionCount: 1, criticalCount: 2 }, { attentionCount: 0, criticalCount: 1 })).toBe(true);
    expect(areReplayRefreshSeverityThresholdsEqual({ attentionCount: 1, criticalCount: 2 }, { attentionCount: 2, criticalCount: 3 })).toBe(false);
  });

  it("keeps threshold audit events bounded, normalized, and coarse", () => {
    const events = Array.from({ length: 6 }, (_, index) => ({ id: index, occurredAt: `2026-08-24T00:0${index}:00.000Z`, attentionCount: 1, criticalCount: 2, kind: "saved" as const }));
    const next = appendReplayRefreshThresholdAuditEvent(events, { id: 7, occurredAt: "2026-08-24T00:07:00.000Z", attentionCount: 9, criticalCount: -2, kind: "restored" });
    expect(next).toHaveLength(6);
    expect(next[0].id).toBe(1);
    expect(next.at(-1)).toEqual({ id: 7, occurredAt: "2026-08-24T00:07:00.000Z", attentionCount: 2, criticalCount: 3, kind: "restored" });
    expect(getReplayRefreshThresholdAuditLabel(next.at(-1)!)).toBe("Default severity thresholds restored");
    expect(getReplayRefreshThresholdAuditAriaLabel(next.at(-1)!)).toBe("Default severity thresholds restored. Attention 2; Critical 3.");
    expect(JSON.stringify(next)).not.toContain("wallet");
    expect(JSON.stringify(next)).not.toContain("payload");
    const unchanged = appendReplayRefreshThresholdAuditEvent(next, { id: 8, occurredAt: "2026-08-24T00:08:00.000Z", attentionCount: 2, criticalCount: 3, kind: "restored" });
    expect(unchanged).toEqual(next);
    const malformed = appendReplayRefreshThresholdAuditEvent([], { id: -4, occurredAt: "not-a-date", attentionCount: Number.NaN, criticalCount: Number.POSITIVE_INFINITY });
    expect(malformed[0]).toMatchObject({ id: expect.any(Number), attentionCount: 1, criticalCount: 2, kind: "saved" });
  });

  it("uses safe threshold feedback text without exposing values", () => {
    expect(getReplayRefreshSeverityNotice("saved")).toBe("Thresholds saved for this session");
    expect(getReplayRefreshSeverityNotice("restored")).toBe("Default thresholds restored");
  });

  it("restores only valid session thresholds and fails safely when storage is blocked", () => {
    const values = new Map<string, string>([["proofloan.replay-refresh-thresholds", JSON.stringify({ attentionCount: 2, criticalCount: 3 })]]);
    const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) };
    expect(readReplayRefreshSeverityThresholds(storage)).toEqual({ attentionCount: 2, criticalCount: 3 });
    expect(writeReplayRefreshSeverityThresholds(storage, { attentionCount: 2, criticalCount: 3 })).toBe(true);
    expect(values.get("proofloan.replay-refresh-thresholds")).toBe(JSON.stringify({ attentionCount: 2, criticalCount: 3 }));
    expect(readReplayRefreshSeverityThresholds({ getItem: () => "not-json" })).toEqual({ attentionCount: 1, criticalCount: 2 });
    expect(readReplayRefreshSeverityThresholds({ getItem: () => JSON.stringify({ attentionCount: 9, criticalCount: -2 }) })).toEqual({ attentionCount: 2, criticalCount: 3 });
    expect(writeReplayRefreshSeverityThresholds({ setItem: () => { throw new Error("blocked"); } }, { attentionCount: 2 })).toBe(false);
    expect(writeReplayRefreshSeverityThresholds(undefined, { attentionCount: 2 })).toBe(false);
    expect(getReplayRefreshSeverityPersistenceNotice(true)).toBeNull();
    expect(getReplayRefreshSeverityPersistenceNotice(false)).toContain("remain active in memory");
    expect(getReplayRefreshSeverityPersistenceTransition(null, true)).toBe("ready");
    expect(getReplayRefreshSeverityPersistenceTransition(null, false)).toBe("unavailable");
    expect(getReplayRefreshSeverityPersistenceTransition(false, true)).toBe("recovered");
    expect(getReplayRefreshSeverityPersistenceStatus("ready")).toBe("Session persistence ready for this browser session.");
    expect(getReplayRefreshSeverityPersistenceStatus("unavailable")).toContain("remain active in memory");
    expect(getReplayRefreshSeverityPersistenceStatus("recovered")).toContain("restored for this browser session");
    const transitionValues = new Map<string, string>();
    const transitionStorage = { setItem: (key: string, value: string) => transitionValues.set(key, value) };
    expect(persistReplayRefreshSeverityThresholds(transitionStorage, { attentionCount: 2, criticalCount: 3 }, null)).toMatchObject({ available: true, transition: "ready", warning: null });
    expect(persistReplayRefreshSeverityThresholds(undefined, { attentionCount: 2, criticalCount: 3 }, true)).toMatchObject({ available: false, transition: "unavailable" });
    expect(persistReplayRefreshSeverityThresholds(transitionStorage, { attentionCount: 2, criticalCount: 3 }, false)).toMatchObject({ available: true, transition: "recovered" });
    expect(shouldApplyReplayRefreshPersistenceUpdate({ isMounted: true, persisted: { attentionCount: 2, criticalCount: 3 }, current: { attentionCount: 2, criticalCount: 3 } })).toBe(true);
    expect(shouldApplyReplayRefreshPersistenceUpdate({ isMounted: false, persisted: { attentionCount: 2, criticalCount: 3 }, current: { attentionCount: 2, criticalCount: 3 } })).toBe(false);
    expect(shouldApplyReplayRefreshPersistenceUpdate({ isMounted: true, persisted: { attentionCount: 1, criticalCount: 2 }, current: { attentionCount: 2, criticalCount: 3 } })).toBe(false);
  });

  it("normalizes severity thresholds into a safe bounded ordering", () => {
    expect(normalizeReplayRefreshSeverityThresholds({ attentionCount: 2, criticalCount: 3 })).toEqual({ attentionCount: 2, criticalCount: 3 });
    expect(normalizeReplayRefreshSeverityThresholds({ attentionCount: -5, criticalCount: 0 })).toEqual({ attentionCount: 1, criticalCount: 2 });
    expect(normalizeReplayRefreshSeverityThresholds({ attentionCount: 3, criticalCount: 1 })).toEqual({ attentionCount: 2, criticalCount: 3 });
    expect(normalizeReplayRefreshSeverityThresholds({ attentionCount: Number.NaN, criticalCount: Number.POSITIVE_INFINITY })).toEqual({ attentionCount: 1, criticalCount: 2 });
  });

  it("marks a rising category with two recent events as critical", () => {
    const event = (id: number, category: "unavailable" | "malformed" | "request_error") => ({ id, occurredAt: `2026-08-24T00:0${id}:00.000Z`, outcome: "error" as const, category });
    expect(getReplayRefreshCategoryTrends([event(1, "malformed"), event(2, "malformed"), event(3, "unavailable"), event(4, "unavailable"), event(5, "unavailable"), event(6, "unavailable")]).find(trend => trend.category === "unavailable")).toMatchObject({ direction: "rising", severity: "critical" });
  });

  it("counts only the six newest failures in a stable category order", () => {
    const events = [
      { id: 1, occurredAt: "2026-08-24T00:00:00.000Z", outcome: "error" as const, category: "unavailable" as const },
      { id: 2, occurredAt: "2026-08-24T00:01:00.000Z", outcome: "error" as const, category: "malformed" as const },
      { id: 3, occurredAt: "2026-08-24T00:02:00.000Z", outcome: "success" as const },
    ];
    expect(getReplayRefreshCategoryCounts(events)).toEqual([
      { category: "unavailable", label: "Service unavailable", count: 1 },
      { category: "malformed", label: "Invalid response", count: 1 },
      { category: "request_error", label: "Request error", count: 0 },
    ]);
  });

  it("summarizes bounded failure rates without exposing event details", () => {
    const events = [
      { id: 1, occurredAt: "2026-08-24T00:00:00.000Z", outcome: "error" as const, category: "unavailable" as const },
      { id: 2, occurredAt: "2026-08-24T00:01:00.000Z", outcome: "success" as const },
      { id: 3, occurredAt: "2026-08-24T00:02:00.000Z", outcome: "error" as const, category: "malformed" as const },
    ];
    expect(getReplayRefreshTimelineSummary(events)).toEqual({ attempts: 3, failures: 2, failureRatePercent: 67, status: "critical" });
    expect(getReplayRefreshTimelineSummary([])).toEqual({ attempts: 0, failures: 0, failureRatePercent: 0, status: "clear" });
  });

  it("maps raw failures to coarse categories without retaining raw text", () => {
    expect(categorizeReplayRefreshFailure(new Error("database unavailable for wallet 0xabc"))).toBe("unavailable");
    expect(categorizeReplayRefreshFailure(new Error("invalid payload: secret"))).toBe("malformed");
    expect(categorizeReplayRefreshFailure(new Error("unexpected upstream detail"))).toBe("request_error");
  });

  it("keeps only the six newest privacy-safe timeline events", () => {
    const events = Array.from({ length: 7 }, (_, index) => ({ id: index, occurredAt: `2026-08-24T00:0${index}:00.000Z`, outcome: "error" as const }));
    const next = appendReplayRefreshTimelineEvent(events, "success", "2026-08-24T00:07:00.000Z", 7);
    expect(next).toHaveLength(6);
    expect(next[0].id).toBe(2);
    expect(next.at(-1)).toEqual({ id: 7, occurredAt: "2026-08-24T00:07:00.000Z", outcome: "success" });
    expect(appendReplayRefreshTimelineEvent([], "error", "2026-08-24T00:08:00.000Z", 8, "unavailable")).toEqual([{ id: 8, occurredAt: "2026-08-24T00:08:00.000Z", outcome: "error", category: "unavailable" }]);
    expect(JSON.stringify(next)).not.toContain("wallet");
  });

  it("ignores outcomes from superseded or unmounted refresh requests", () => {
    expect(shouldApplyReplayRefreshOutcome({ requestId: 1, currentRequestId: 2, isMounted: true })).toBe(false);
    expect(shouldApplyReplayRefreshOutcome({ requestId: 1, currentRequestId: 1, isMounted: false })).toBe(false);
    expect(shouldApplyReplayRefreshOutcome({ requestId: 2, currentRequestId: 2, isMounted: true })).toBe(true);
  });

  it("describes refresh outcomes without hiding the last snapshot", () => {
    expect(getReplayDiagnosticsRefreshFeedback("idle").label).toBe("");
    expect(getReplayDiagnosticsRefreshFeedback("refreshing").label).toContain("Refreshing");
    expect(getReplayDiagnosticsRefreshFeedback("success")).toEqual({ label: "Refresh completed", tone: "positive" });
    expect(getReplayDiagnosticsRefreshFeedback("error")).toEqual({ label: "Refresh failed; showing last snapshot", tone: "negative" });
  });

  it("handles invalid timestamps without throwing", () => {
    expect(formatReplayDiagnosticsTimestamp("not-a-date")).toBe("Unavailable");
  });

  it("rejects malformed or negative runtime payloads", () => {
    expect(normalizeReplayDiagnostics({ generatedAt: "not-a-date", acceptance: { pending: 1, stale: 0 }, proofRequest: { pending: 1, stale: 0 } })).toBeNull();
    expect(normalizeReplayDiagnostics({ generatedAt: "2026-08-24T00:00:00.000Z", acceptance: { pending: -1, stale: 0 }, proofRequest: { pending: 1, stale: 0 } })).toBeNull();
  });

  it("bounds valid runtime counts", () => {
    expect(normalizeReplayDiagnostics({ generatedAt: "2026-08-24T00:00:00.000Z", acceptance: { pending: 1_000_001, stale: 2 }, proofRequest: { pending: 3, stale: 4 } })?.acceptance.pending).toBe(1_000_000);
  });

  it("normalizes only known privacy-safe persistence failure rules", () => {
    const normalized = normalizeReplayDiagnostics({ generatedAt: "2026-08-24T00:00:00.000Z", acceptance: { pending: 1, stale: 0 }, proofRequest: { pending: 1, stale: 0 }, persistence: { rule: "APPLICATION_IDENTITY", observedAt: "2026-08-24T00:00:00.000Z", history: [{ rule: "APPLICATION_IDENTITY", observedAt: "2026-08-24T00:00:00.000Z" }], walletAddress: "secret-wallet" } });
    expect(normalized?.persistence).toEqual({ rule: "APPLICATION_IDENTITY", observedAt: "2026-08-24T00:00:00.000Z", history: [{ rule: "APPLICATION_IDENTITY", observedAt: "2026-08-24T00:00:00.000Z" }] });
    expect(JSON.stringify(normalized)).not.toContain("secret-wallet");
    expect(normalizeReplayDiagnostics({ generatedAt: "2026-08-24T00:00:00.000Z", acceptance: { pending: 1, stale: 0 }, proofRequest: { pending: 1, stale: 0 }, persistence: { rule: "UNKNOWN", observedAt: "2026-08-24T00:00:00.000Z", history: [] } })).toBeNull();
  });
});
