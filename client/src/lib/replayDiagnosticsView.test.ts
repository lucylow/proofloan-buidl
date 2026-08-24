import { describe, expect, it } from "vitest";
import { appendReplayRefreshTimelineEvent, categorizeReplayRefreshFailure, formatReplayDiagnosticsTimestamp, getReplayDiagnosticsFreshness, getReplayDiagnosticsRefreshFeedback, getReplayDiagnosticsRefreshState, getReplayDiagnosticsRows, getReplayRefreshCategoryCounts, getReplayRefreshTimelineSummary, normalizeReplayDiagnostics, shouldApplyReplayRefreshOutcome } from "./replayDiagnosticsView";

describe("replay diagnostics view model", () => {
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
});
