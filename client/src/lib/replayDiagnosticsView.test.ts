import { describe, expect, it } from "vitest";
import { formatReplayDiagnosticsTimestamp, getReplayDiagnosticsFreshness, getReplayDiagnosticsRows, normalizeReplayDiagnostics } from "./replayDiagnosticsView";

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
