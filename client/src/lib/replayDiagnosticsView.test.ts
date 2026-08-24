import { describe, expect, it } from "vitest";
import { formatReplayDiagnosticsTimestamp, getReplayDiagnosticsRows, normalizeReplayDiagnostics } from "./replayDiagnosticsView";

describe("replay diagnostics view model", () => {
  it("marks stale records for operator attention", () => {
    expect(getReplayDiagnosticsRows({ acceptance: { pending: 3, stale: 1 }, proofRequest: { pending: 2, stale: 0 } })).toEqual([
      { label: "Acceptance", pending: 3, stale: 1, tone: "attention" },
      { label: "Proof requests", pending: 2, stale: 0, tone: "clear" },
    ]);
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
