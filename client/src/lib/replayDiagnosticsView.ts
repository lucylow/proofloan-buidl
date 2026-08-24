export type ReplayDiagnosticsInput = {
  generatedAt: string;
  acceptance: { pending: number; stale: number };
  proofRequest: { pending: number; stale: number };
};

export type ReplayDiagnosticsRow = {
  label: string;
  pending: number;
  stale: number;
  tone: "clear" | "attention";
};

function boundedCount(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return null;
  return Math.min(1_000_000, Math.floor(value));
}

export function normalizeReplayDiagnostics(value: unknown): ReplayDiagnosticsInput | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<ReplayDiagnosticsInput>;
  if (typeof candidate.generatedAt !== "string" || Number.isNaN(new Date(candidate.generatedAt).getTime())) return null;
  const acceptance = candidate.acceptance;
  const proofRequest = candidate.proofRequest;
  if (!acceptance || !proofRequest) return null;
  const acceptancePending = boundedCount(acceptance.pending);
  const acceptanceStale = boundedCount(acceptance.stale);
  const proofPending = boundedCount(proofRequest.pending);
  const proofStale = boundedCount(proofRequest.stale);
  if (acceptancePending === null || acceptanceStale === null || proofPending === null || proofStale === null) return null;
  return { generatedAt: candidate.generatedAt, acceptance: { pending: acceptancePending, stale: acceptanceStale }, proofRequest: { pending: proofPending, stale: proofStale } };
}

export function getReplayDiagnosticsRows(input: ReplayDiagnosticsInput): ReplayDiagnosticsRow[] {
  return [
    { label: "Acceptance", pending: input.acceptance.pending, stale: input.acceptance.stale, tone: input.acceptance.stale > 0 ? "attention" : "clear" },
    { label: "Proof requests", pending: input.proofRequest.pending, stale: input.proofRequest.stale, tone: input.proofRequest.stale > 0 ? "attention" : "clear" },
  ];
}

export function formatReplayDiagnosticsTimestamp(timestamp: string): string {
  const parsed = new Date(timestamp);
  return Number.isNaN(parsed.getTime()) ? "Unavailable" : parsed.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
