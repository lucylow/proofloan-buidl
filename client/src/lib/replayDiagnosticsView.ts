export type ReplayDiagnosticsInput = {
  generatedAt: string;
  acceptance: { pending: number; stale: number };
  proofRequest: { pending: number; stale: number };
};

export type ReplayDiagnosticsFreshness = "fresh" | "stale" | "future" | "invalid";
export type ReplayDiagnosticsRefreshOutcome = "idle" | "refreshing" | "success" | "error";
export type ReplayRefreshTimelineOutcome = "success" | "error";
export type ReplayRefreshFailureCategory = "unavailable" | "malformed" | "request_error";
export type ReplayRefreshTimelineEvent = { id: number; occurredAt: string; outcome: ReplayRefreshTimelineOutcome; category?: ReplayRefreshFailureCategory };
export type ReplayRefreshTimelineSummary = { attempts: number; failures: number; failureRatePercent: number; status: "clear" | "watch" | "critical" };
export type ReplayRefreshCategoryCount = { category: ReplayRefreshFailureCategory; label: string; count: number };
export type ReplayRefreshTrend = { direction: "rising" | "falling" | "flat" | "insufficient"; confidence: "low" | "medium" | "high"; recentSampleSize: number; priorSampleSize: number; recentFailureRatePercent: number; priorFailureRatePercent: number };
export type ReplayRefreshCategoryTrend = { category: ReplayRefreshFailureCategory; direction: "rising" | "falling" | "flat" | "insufficient"; severity: "neutral" | "attention" | "critical"; recentCount: number; priorCount: number };
export type ReplayRefreshTimelineFilter = "all" | "failures" | ReplayRefreshFailureCategory;

const replayRefreshFilterStorageKey = "proofloan.replay-refresh-filter";

export function readReplayRefreshTimelineFilter(storage: Pick<Storage, "getItem"> | undefined): ReplayRefreshTimelineFilter {
  try {
    const value = storage?.getItem(replayRefreshFilterStorageKey);
    return value === "all" || value === "failures" || value === "unavailable" || value === "malformed" || value === "request_error" ? value : "all";
  } catch {
    return "all";
  }
}

export function writeReplayRefreshTimelineFilter(storage: Pick<Storage, "setItem"> | undefined, filter: ReplayRefreshTimelineFilter): void {
  try {
    storage?.setItem(replayRefreshFilterStorageKey, filter);
  } catch {
    // Session storage may be blocked; the in-memory selection remains authoritative.
  }
}

export function getReplayRefreshFilterLabel(filter: ReplayRefreshTimelineFilter): string {
  if (filter === "all") return "All attempts";
  if (filter === "failures") return "Failures only";
  return getReplayRefreshFailureLabel(filter);
}

export function getReplayRefreshFilterChangeNotice(previous: ReplayRefreshTimelineFilter, next: ReplayRefreshTimelineFilter): string | null {
  if (previous === next) return null;
  return `Filter changed to ${getReplayRefreshFilterLabel(next).toLowerCase()}`;
}

export function getReplayRefreshFilterChangeScopeNotice(previous: ReplayRefreshTimelineFilter, next: ReplayRefreshTimelineFilter, matchingCount: number): string | null {
  if (previous === next) return null;
  return `Filter changed to ${getReplayRefreshFilterScopeLabel(next, matchingCount).toLowerCase()}`;
}

export function getReplayRefreshFilterScopeLabel(filter: ReplayRefreshTimelineFilter, matchingCount: number): string {
  const safeCount = Number.isFinite(matchingCount) && matchingCount >= 0 ? Math.min(6, Math.floor(matchingCount)) : 0;
  return `${getReplayRefreshFilterLabel(filter)} · ${safeCount}`;
}

export function getReplayRefreshFilterRestorationNotice(filter: ReplayRefreshTimelineFilter, restored: boolean): string | null {
  if (!restored) return null;
  if (filter === "all") return "Restored the full refresh timeline";
  if (filter === "failures") return "Restored the failures view";
  return `Restored the ${getReplayRefreshFailureLabel(filter).toLowerCase()} view`;
}

export function shouldShowReplayRefreshFilterReset(input: { filter: ReplayRefreshTimelineFilter; visibleCount: number }): boolean {
  return input.filter !== "all" && input.visibleCount === 0;
}

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

export function getReplayDiagnosticsFreshness(timestamp: string, now = Date.now(), maxAgeMs = 90_000): ReplayDiagnosticsFreshness {
  const parsed = new Date(timestamp).getTime();
  if (!Number.isFinite(parsed)) return "invalid";
  if (parsed > now + 120_000) return "future";
  return now - parsed > maxAgeMs ? "stale" : "fresh";
}

export function getReplayDiagnosticsRows(input: ReplayDiagnosticsInput, freshness: ReplayDiagnosticsFreshness = "fresh"): ReplayDiagnosticsRow[] {
  return [
    { label: "Acceptance", pending: input.acceptance.pending, stale: input.acceptance.stale, tone: input.acceptance.stale > 0 || freshness !== "fresh" ? "attention" : "clear" },
    { label: "Proof requests", pending: input.proofRequest.pending, stale: input.proofRequest.stale, tone: input.proofRequest.stale > 0 || freshness !== "fresh" ? "attention" : "clear" },
  ];
}

export function categorizeReplayRefreshFailure(error: unknown): ReplayRefreshFailureCategory {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error ?? "").toLowerCase();
  if (message.includes("invalid") || message.includes("malformed") || message.includes("payload")) return "malformed";
  if (message.includes("unavailable") || message.includes("network") || message.includes("timeout")) return "unavailable";
  return "request_error";
}

export function filterReplayRefreshTimeline(events: ReplayRefreshTimelineEvent[], filter: ReplayRefreshTimelineFilter): ReplayRefreshTimelineEvent[] {
  const recent = events.slice(-6);
  if (filter === "all") return recent;
  if (filter === "failures") return recent.filter(event => event.outcome === "error");
  return recent.filter(event => event.outcome === "error" && event.category === filter);
}

export function getReplayRefreshCategoryTrends(events: ReplayRefreshTimelineEvent[]): ReplayRefreshCategoryTrend[] {
  const categories: ReplayRefreshFailureCategory[] = ["unavailable", "malformed", "request_error"];
  const bounded = events.slice(-6);
  const midpoint = Math.floor(bounded.length / 2);
  const prior = bounded.slice(0, midpoint);
  const recent = bounded.slice(midpoint);
  return categories.map((category: ReplayRefreshFailureCategory) => {
    const recentCount = recent.filter(event => event.outcome === "error" && event.category === category).length;
    const priorCount = prior.filter(event => event.outcome === "error" && event.category === category).length;
    const direction: ReplayRefreshCategoryTrend["direction"] = recent.length < 2 || prior.length < 2 ? "insufficient" : recentCount > priorCount ? "rising" : recentCount < priorCount ? "falling" : "flat";
    const severity: ReplayRefreshCategoryTrend["severity"] = direction !== "rising" ? "neutral" : recentCount >= 2 && recentCount > priorCount ? "critical" : "attention";
    return { category, direction, severity, recentCount, priorCount };
  }).filter((trend: ReplayRefreshCategoryTrend) => trend.recentCount > 0 || trend.priorCount > 0);
}

export function getReplayRefreshCategoryCounts(events: ReplayRefreshTimelineEvent[]): ReplayRefreshCategoryCount[] {
  const recent = events.slice(-6);
  return (["unavailable", "malformed", "request_error"] as const).map(category => ({
    category,
    label: getReplayRefreshFailureLabel(category),
    count: recent.filter(event => event.outcome === "error" && event.category === category).length,
  }));
}

export function getReplayRefreshTrend(events: ReplayRefreshTimelineEvent[]): ReplayRefreshTrend {
  const recent = events.slice(-6);
  if (recent.length < 4) return { direction: "insufficient", confidence: "low", recentSampleSize: 0, priorSampleSize: 0, recentFailureRatePercent: 0, priorFailureRatePercent: 0 };
  const split = Math.ceil(recent.length / 2);
  const prior = recent.slice(0, split);
  const latest = recent.slice(split);
  const rate = (window: ReplayRefreshTimelineEvent[]) => Math.round((window.filter(event => event.outcome === "error").length / window.length) * 100);
  const priorFailureRatePercent = rate(prior);
  const recentFailureRatePercent = rate(latest);
  const delta = recentFailureRatePercent - priorFailureRatePercent;
  return { direction: delta > 0 ? "rising" : delta < 0 ? "falling" : "flat", confidence: recent.length >= 6 ? "high" : "medium", recentSampleSize: latest.length, priorSampleSize: prior.length, recentFailureRatePercent, priorFailureRatePercent };
}

export function getReplayRefreshTimelineSummary(events: ReplayRefreshTimelineEvent[]): ReplayRefreshTimelineSummary {
  const attempts = Math.min(events.length, 6);
  const failures = Math.min(events.slice(-6).filter(event => event.outcome === "error").length, attempts);
  const failureRatePercent = attempts === 0 ? 0 : Math.round((failures / attempts) * 100);
  return { attempts, failures, failureRatePercent, status: failures === 0 ? "clear" : failures >= 3 || failureRatePercent >= 67 ? "critical" : "watch" };
}

export function getReplayRefreshFailureLabel(category: ReplayRefreshFailureCategory | undefined): string {
  if (category === "unavailable") return "Service unavailable";
  if (category === "malformed") return "Invalid response";
  return "Request error";
}

export function appendReplayRefreshTimelineEvent(events: ReplayRefreshTimelineEvent[], outcome: ReplayRefreshTimelineOutcome, occurredAt = new Date().toISOString(), id = Date.now(), category?: ReplayRefreshFailureCategory): ReplayRefreshTimelineEvent[] {
  const next = [...events, { id, occurredAt, outcome, ...(outcome === "error" ? { category: category ?? "request_error" } : {}) }];
  return next.slice(-6);
}

export function shouldApplyReplayRefreshOutcome(input: { requestId: number; currentRequestId: number; isMounted: boolean }): boolean {
  return input.isMounted && input.requestId === input.currentRequestId;
}

export function getReplayDiagnosticsRefreshFeedback(outcome: ReplayDiagnosticsRefreshOutcome): { label: string; tone: "muted" | "positive" | "negative" } {
  if (outcome === "refreshing") return { label: "Refreshing protected diagnostics…", tone: "muted" };
  if (outcome === "success") return { label: "Refresh completed", tone: "positive" };
  if (outcome === "error") return { label: "Refresh failed; showing last snapshot", tone: "negative" };
  return { label: "", tone: "muted" };
}

export function getReplayDiagnosticsRefreshState(input: { isFetching: boolean; isOnline: boolean }): { enabled: boolean; label: string } {
  if (!input.isOnline) return { enabled: false, label: "Offline" };
  if (input.isFetching) return { enabled: false, label: "Refreshing" };
  return { enabled: true, label: "Refresh now" };
}

export function formatReplayDiagnosticsTimestamp(timestamp: string): string {
  const parsed = new Date(timestamp);
  return Number.isNaN(parsed.getTime()) ? "Unavailable" : parsed.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
