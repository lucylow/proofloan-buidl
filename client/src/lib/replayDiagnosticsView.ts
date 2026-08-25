import { getPersistenceRuleGuidance } from "./persistenceDiagnostics";

export type ReplayDiagnosticsInput = {
  generatedAt: string;
  acceptance: { pending: number; stale: number };
  proofRequest: { pending: number; stale: number };
  persistence?: { rule: string; observedAt: string; history: Array<{ rule: string; observedAt: string }> };
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
export type ReplayRefreshSeverityThresholds = { attentionCount: number; criticalCount: number };
export type ReplayRefreshTimelineFilter = "all" | "failures" | ReplayRefreshFailureCategory;
export type ReplayRefreshThresholdAuditEvent = { id: number; occurredAt: string; attentionCount: number; criticalCount: number; kind: "saved" | "restored" };

const replayRefreshFilterStorageKey = "proofloan.replay-refresh-filter";
const replayRefreshThresholdStorageKey = "proofloan.replay-refresh-thresholds";

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
  const persistence = candidate.persistence;
  if (persistence !== undefined && (!persistence || typeof persistence.rule !== "string" || !getPersistenceRuleGuidance(persistence.rule) || typeof persistence.observedAt !== "string" || !Number.isFinite(new Date(persistence.observedAt).getTime()) || !Array.isArray(persistence.history))) return null;
  const history = persistence?.history.filter(entry => !!entry && typeof entry.rule === "string" && !!getPersistenceRuleGuidance(entry.rule) && typeof entry.observedAt === "string" && Number.isFinite(new Date(entry.observedAt).getTime())).slice(-6).map(entry => ({ rule: entry.rule, observedAt: entry.observedAt })) ?? [];
  return { generatedAt: candidate.generatedAt, acceptance: { pending: acceptancePending, stale: acceptanceStale }, proofRequest: { pending: proofPending, stale: proofStale }, ...(persistence ? { persistence: { rule: persistence.rule, observedAt: persistence.observedAt, history } } : {}) };
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

export function normalizeReplayRefreshTimeline(events: unknown): ReplayRefreshTimelineEvent[] {
  if (!Array.isArray(events)) return [];
  return events.filter((event): event is Record<string, unknown> => !!event && typeof event === "object").map((event, index) => {
    const outcome: ReplayRefreshTimelineOutcome = event.outcome === "success" ? "success" : "error";
    const category: ReplayRefreshFailureCategory | undefined = event.category === "unavailable" || event.category === "malformed" || event.category === "request_error" ? event.category as ReplayRefreshFailureCategory : outcome === "error" ? "request_error" : undefined;
    const id = typeof event.id === "number" && Number.isFinite(event.id) && event.id >= 0 ? Math.floor(event.id) : index;
    const occurredAt = typeof event.occurredAt === "string" && Number.isFinite(new Date(event.occurredAt).getTime()) ? event.occurredAt : new Date(0).toISOString();
    return { id, occurredAt, outcome, ...(outcome === "error" ? { category } : {}) };
  }).slice(-6);
}

export function filterReplayRefreshTimeline(events: ReplayRefreshTimelineEvent[], filter: ReplayRefreshTimelineFilter): ReplayRefreshTimelineEvent[] {
  const recent = normalizeReplayRefreshTimeline(events).slice(-6);
  if (filter === "all") return recent;
  if (filter === "failures") return recent.filter(event => event.outcome === "error");
  return recent.filter(event => event.outcome === "error" && event.category === filter);
}

export function getReplayRefreshSeverityExplanation(input?: Partial<ReplayRefreshSeverityThresholds>): string {
  const thresholds = normalizeReplayRefreshSeverityThresholds(input);
  return `Attention at ${thresholds.attentionCount} recent event${thresholds.attentionCount === 1 ? "" : "s"}; critical at ${thresholds.criticalCount}. Based on the bounded six-event window.`;
}

export function appendReplayRefreshThresholdAuditEvent(events: ReplayRefreshThresholdAuditEvent[], input: Partial<ReplayRefreshThresholdAuditEvent> = {}): ReplayRefreshThresholdAuditEvent[] {
  const thresholds = normalizeReplayRefreshSeverityThresholds(input);
  const kind = input.kind === "restored" ? "restored" : "saved";
  const previous = events.at(-1);
  if (previous && previous.kind === kind && previous.attentionCount === thresholds.attentionCount && previous.criticalCount === thresholds.criticalCount) return events.slice(-6);
  const event: ReplayRefreshThresholdAuditEvent = {
    id: Number.isFinite(input.id) && Number(input.id) >= 0 ? Math.floor(Number(input.id)) : Date.now(),
    occurredAt: typeof input.occurredAt === "string" && Number.isFinite(new Date(input.occurredAt).getTime()) ? input.occurredAt : new Date().toISOString(),
    attentionCount: thresholds.attentionCount,
    criticalCount: thresholds.criticalCount,
    kind,
  };
  return [...events, event].slice(-6);
}

export function getReplayRefreshThresholdAuditLabel(event: ReplayRefreshThresholdAuditEvent): string {
  return event.kind === "restored" ? "Default severity thresholds restored" : "Severity thresholds saved";
}

export function getReplayRefreshThresholdAuditAriaLabel(event: ReplayRefreshThresholdAuditEvent): string {
  const thresholds = normalizeReplayRefreshSeverityThresholds(event);
  return `${getReplayRefreshThresholdAuditLabel(event)}. Attention ${thresholds.attentionCount}; Critical ${thresholds.criticalCount}.`;
}

export function areReplayRefreshSeverityThresholdsEqual(left?: Partial<ReplayRefreshSeverityThresholds>, right?: Partial<ReplayRefreshSeverityThresholds>): boolean {
  const normalizedLeft = normalizeReplayRefreshSeverityThresholds(left);
  const normalizedRight = normalizeReplayRefreshSeverityThresholds(right);
  return normalizedLeft.attentionCount === normalizedRight.attentionCount && normalizedLeft.criticalCount === normalizedRight.criticalCount;
}

export function getReplayRefreshSeverityStatusSummary(input?: Partial<ReplayRefreshSeverityThresholds>): string {
  const thresholds = normalizeReplayRefreshSeverityThresholds(input);
  return `Attention threshold: ${thresholds.attentionCount} recent event${thresholds.attentionCount === 1 ? "" : "s"}. Critical threshold: ${thresholds.criticalCount} recent events.`;
}

export function getReplayRefreshSeverityNotice(kind: "saved" | "restored"): string {
  return kind === "restored" ? "Default thresholds restored" : "Thresholds saved for this session";
}

export function normalizeReplayRefreshSeverityThresholds(input?: Partial<ReplayRefreshSeverityThresholds>): ReplayRefreshSeverityThresholds {
  const attentionCount = Number.isFinite(input?.attentionCount) ? Math.max(1, Math.min(2, Math.floor(input!.attentionCount!))) : 1;
  const criticalCount = Number.isFinite(input?.criticalCount) ? Math.max(attentionCount + 1, Math.min(3, Math.floor(input!.criticalCount!))) : 2;
  return { attentionCount, criticalCount };
}

export function readReplayRefreshSeverityThresholds(storage?: Pick<Storage, "getItem">): ReplayRefreshSeverityThresholds {
  try {
    const raw = storage?.getItem(replayRefreshThresholdStorageKey);
    if (!raw) return normalizeReplayRefreshSeverityThresholds();
    const parsed = JSON.parse(raw) as Partial<ReplayRefreshSeverityThresholds>;
    return normalizeReplayRefreshSeverityThresholds(parsed);
  } catch {
    return normalizeReplayRefreshSeverityThresholds();
  }
}

export function writeReplayRefreshSeverityThresholds(storage: Pick<Storage, "setItem"> | undefined, input?: Partial<ReplayRefreshSeverityThresholds>): boolean {
  if (!storage) return false;
  try {
    storage.setItem(replayRefreshThresholdStorageKey, JSON.stringify(normalizeReplayRefreshSeverityThresholds(input)));
    return true;
  } catch {
    // Session storage is an optional operator convenience; diagnostics remain functional without it.
    return false;
  }
}

export function getReplayRefreshSeverityPersistenceNotice(available: boolean): string | null {
  return available ? null : "Session persistence is unavailable; current thresholds remain active in memory.";
}

export type ReplayRefreshSeverityPersistenceState = "ready" | "unavailable" | "recovered";

export function getReplayRefreshSeverityPersistenceTransition(previousAvailable: boolean | null, available: boolean): ReplayRefreshSeverityPersistenceState {
  if (!available) return "unavailable";
  return previousAvailable === false ? "recovered" : "ready";
}

export function getReplayRefreshSeverityPersistenceStatus(state: ReplayRefreshSeverityPersistenceState): string {
  if (state === "unavailable") return "Session persistence is unavailable; current thresholds remain active in memory.";
  if (state === "recovered") return "Session persistence restored for this browser session.";
  return "Session persistence ready for this browser session.";
}

export function persistReplayRefreshSeverityThresholds(storage: Pick<Storage, "setItem"> | undefined, input: Partial<ReplayRefreshSeverityThresholds> | undefined, previousAvailable: boolean | null): { available: boolean; transition: ReplayRefreshSeverityPersistenceState; warning: string | null; status: string } {
  const available = writeReplayRefreshSeverityThresholds(storage, input);
  const transition = getReplayRefreshSeverityPersistenceTransition(previousAvailable, available);
  return { available, transition, warning: getReplayRefreshSeverityPersistenceNotice(available), status: getReplayRefreshSeverityPersistenceStatus(transition) };
}

export function shouldApplyReplayRefreshPersistenceUpdate(input: { isMounted: boolean; persisted: Partial<ReplayRefreshSeverityThresholds>; current: Partial<ReplayRefreshSeverityThresholds> }): boolean {
  return input.isMounted && areReplayRefreshSeverityThresholdsEqual(input.persisted, input.current);
}

export function getReplayRefreshCategoryTrends(events: ReplayRefreshTimelineEvent[], input?: Partial<ReplayRefreshSeverityThresholds>): ReplayRefreshCategoryTrend[] {
  const categories: ReplayRefreshFailureCategory[] = ["unavailable", "malformed", "request_error"];
  const thresholds = normalizeReplayRefreshSeverityThresholds(input);
  const bounded = normalizeReplayRefreshTimeline(events).slice(-6);
  const midpoint = Math.floor(bounded.length / 2);
  const prior = bounded.slice(0, midpoint);
  const recent = bounded.slice(midpoint);
  return categories.map((category: ReplayRefreshFailureCategory) => {
    const recentCount = recent.filter(event => event.outcome === "error" && event.category === category).length;
    const priorCount = prior.filter(event => event.outcome === "error" && event.category === category).length;
    const direction: ReplayRefreshCategoryTrend["direction"] = recent.length < 2 || prior.length < 2 ? "insufficient" : recentCount > priorCount ? "rising" : recentCount < priorCount ? "falling" : "flat";
    const severity: ReplayRefreshCategoryTrend["severity"] = direction !== "rising" ? "neutral" : recentCount >= thresholds.criticalCount && recentCount > priorCount ? "critical" : recentCount >= thresholds.attentionCount ? "attention" : "neutral";
    return { category, direction, severity, recentCount, priorCount };
  }).filter((trend: ReplayRefreshCategoryTrend) => trend.recentCount > 0 || trend.priorCount > 0);
}

export function getReplayRefreshCategoryCounts(events: ReplayRefreshTimelineEvent[]): ReplayRefreshCategoryCount[] {
  const recent = normalizeReplayRefreshTimeline(events).slice(-6);
  return (["unavailable", "malformed", "request_error"] as const).map(category => ({
    category,
    label: getReplayRefreshFailureLabel(category),
    count: recent.filter(event => event.outcome === "error" && event.category === category).length,
  }));
}

export function getReplayRefreshTrend(events: ReplayRefreshTimelineEvent[]): ReplayRefreshTrend {
  const recent = normalizeReplayRefreshTimeline(events).slice(-6);
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
