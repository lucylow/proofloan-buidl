export const PERSISTENCE_RULE_GUIDANCE = [
  { rule: "CLOCK_INVALID", label: "Clock validation", guidance: "Verify server time and retry after clock synchronization." },
  { rule: "EXPECTED_APPLICATION_MISMATCH", label: "Application binding", guidance: "Reload the application record and retry with the current application context." },
  { rule: "COLLECTION_SHAPE", label: "Collection shape", guidance: "Treat the snapshot as unavailable and investigate the persistence response contract." },
  { rule: "APPLICATION_SHAPE", label: "Application shape", guidance: "Check the application row contract before allowing reconstruction." },
  { rule: "COLLECTION_BOUNDS", label: "Collection bounds", guidance: "Inspect event volume and reject oversized snapshots without exposing row contents." },
  { rule: "APPLICATION_IDENTITY", label: "Application identity", guidance: "Verify canonical application, wallet, chain, and amount fields." },
  { rule: "VERIFIED_FACT_METADATA", label: "Verified fact metadata", guidance: "Recheck fact provenance, identity, enums, and chronology at the write boundary." },
  { rule: "AUDIT_METADATA", label: "Audit metadata", guidance: "Recheck audit state labels, hashes, details, and timestamps." },
  { rule: "SNAPSHOT_INTEGRITY", label: "Snapshot integrity", guidance: "Keep the snapshot withheld and investigate cross-record consistency and timing." },
] as const;

export function getPersistenceRuleGuidance(rule: string): (typeof PERSISTENCE_RULE_GUIDANCE)[number] | undefined {
  return PERSISTENCE_RULE_GUIDANCE.find(entry => entry.rule === rule);
}

export type PersistenceFailureFreshness = "fresh" | "stale" | "future" | "invalid";

export function getPersistenceFailureFreshness(observedAt: string, now = Date.now(), maxAgeMs = 300_000): PersistenceFailureFreshness {
  const timestamp = new Date(observedAt).getTime();
  if (!Number.isFinite(timestamp) || !Number.isFinite(now)) return "invalid";
  if (timestamp > now + 120_000) return "future";
  return now - timestamp > maxAgeMs ? "stale" : "fresh";
}

export type PersistenceFailureHistoryFilter = "all" | "current" | "stale";

const persistenceHistoryFilterStorageKey = "proofloan.persistence-history-filter";
const persistenceAlertThresholdsStorageKey = "proofloan.persistence-alert-thresholds";
const persistenceAlertAcknowledgmentStorageKey = "proofloan.persistence-alert-acknowledgment";
const persistenceAlertUnacknowledgmentStorageKey = "proofloan.persistence-alert-unacknowledgment";

export function readPersistenceFailureHistoryFilter(storage: Pick<Storage, "getItem"> | undefined): PersistenceFailureHistoryFilter {
  try {
    const value = storage?.getItem(persistenceHistoryFilterStorageKey);
    return value === "all" || value === "current" || value === "stale" ? value : "all";
  } catch {
    return "all";
  }
}

export function writePersistenceFailureHistoryFilter(storage: Pick<Storage, "setItem"> | undefined, filter: PersistenceFailureHistoryFilter): boolean {
  try {
    storage?.setItem(persistenceHistoryFilterStorageKey, filter);
    return !!storage;
  } catch {
    return false;
  }
}

export function getPersistenceFilterRestorationNotice(filter: PersistenceFailureHistoryFilter, restored: boolean): string | null {
  if (!restored || filter === "all") return null;
  return `Restored the ${filter} persistence failures view for this session.`;
}

export function filterPersistenceFailureHistory(history: ReadonlyArray<{ rule: string; observedAt: string }> | undefined, filter: PersistenceFailureHistoryFilter, now = Date.now()): Array<{ rule: string; observedAt: string }> {
  return (history ?? []).filter(entry => {
    if (!entry || !getPersistenceRuleGuidance(entry.rule)) return false;
    const freshness = getPersistenceFailureFreshness(entry.observedAt, now);
    return filter === "all" || (filter === "current" ? freshness === "fresh" : freshness !== "fresh");
  }).slice(-6).map(entry => ({ rule: entry.rule, observedAt: entry.observedAt }));
}

export type PersistenceFailureAlertThresholds = { watchCount: number; criticalCount: number };
export type PersistenceFailureAlertLevel = "clear" | "watch" | "critical";

export const DEFAULT_PERSISTENCE_FAILURE_ALERT_THRESHOLDS: PersistenceFailureAlertThresholds = { watchCount: 2, criticalCount: 4 };

export function normalizePersistenceFailureAlertThresholds(value: Partial<PersistenceFailureAlertThresholds> | null | undefined): PersistenceFailureAlertThresholds {
  const watchValue = value?.watchCount;
  const criticalValue = value?.criticalCount;
  const watchCount = typeof watchValue === "number" && Number.isFinite(watchValue) ? Math.min(5, Math.max(1, Math.floor(watchValue))) : DEFAULT_PERSISTENCE_FAILURE_ALERT_THRESHOLDS.watchCount;
  const criticalCount = typeof criticalValue === "number" && Number.isFinite(criticalValue) ? Math.min(6, Math.max(watchCount + 1, Math.floor(criticalValue))) : DEFAULT_PERSISTENCE_FAILURE_ALERT_THRESHOLDS.criticalCount;
  return { watchCount, criticalCount };
}

export function readPersistenceFailureAlertThresholds(storage: Pick<Storage, "getItem"> | undefined): PersistenceFailureAlertThresholds {
  try {
    const raw = storage?.getItem(persistenceAlertThresholdsStorageKey);
    if (!raw) return DEFAULT_PERSISTENCE_FAILURE_ALERT_THRESHOLDS;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return DEFAULT_PERSISTENCE_FAILURE_ALERT_THRESHOLDS;
    const candidate = parsed as Partial<PersistenceFailureAlertThresholds>;
    return normalizePersistenceFailureAlertThresholds(candidate);
  } catch {
    return DEFAULT_PERSISTENCE_FAILURE_ALERT_THRESHOLDS;
  }
}

export function writePersistenceFailureAlertThresholds(storage: Pick<Storage, "setItem"> | undefined, thresholds: PersistenceFailureAlertThresholds): boolean {
  try {
    storage?.setItem(persistenceAlertThresholdsStorageKey, JSON.stringify(normalizePersistenceFailureAlertThresholds(thresholds)));
    return !!storage;
  } catch {
    return false;
  }
}

export type PersistenceFailureAlertAcknowledgment = { filter: PersistenceFailureHistoryFilter; level: "critical"; recentCount: number; acknowledgedAt: string };

function normalizePersistenceFailureAlertAcknowledgment(value: unknown): PersistenceFailureAlertAcknowledgment | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<PersistenceFailureAlertAcknowledgment>;
  if ((candidate.filter !== "all" && candidate.filter !== "current" && candidate.filter !== "stale") || candidate.level !== "critical" || typeof candidate.recentCount !== "number" || !Number.isFinite(candidate.recentCount) || candidate.recentCount < 0 || typeof candidate.acknowledgedAt !== "string") return null;
  const timestamp = Date.parse(candidate.acknowledgedAt);
  if (!Number.isFinite(timestamp)) return null;
  return { filter: candidate.filter, level: "critical", recentCount: Math.min(6, Math.floor(candidate.recentCount)), acknowledgedAt: new Date(timestamp).toISOString() };
}

export function readPersistenceFailureAlertAcknowledgment(storage: Pick<Storage, "getItem"> | undefined): PersistenceFailureAlertAcknowledgment | null {
  try {
    const raw = storage?.getItem(persistenceAlertAcknowledgmentStorageKey);
    return raw ? normalizePersistenceFailureAlertAcknowledgment(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

export function writePersistenceFailureAlertAcknowledgment(storage: Pick<Storage, "setItem"> | undefined, acknowledgment: PersistenceFailureAlertAcknowledgment): boolean {
  try {
    const normalized = normalizePersistenceFailureAlertAcknowledgment(acknowledgment);
    if (!normalized || !storage) return false;
    storage.setItem(persistenceAlertAcknowledgmentStorageKey, JSON.stringify(normalized));
    return true;
  } catch {
    return false;
  }
}

export function clearPersistenceFailureAlertAcknowledgment(storage: Pick<Storage, "removeItem"> | undefined): boolean {
  try {
    storage?.removeItem(persistenceAlertAcknowledgmentStorageKey);
    return !!storage;
  } catch {
    return false;
  }
}

export function getPersistenceFailureAlertAcknowledgmentKey(filter: PersistenceFailureHistoryFilter, level: PersistenceFailureAlertLevel, recentCount: number): string | null {
  if (level !== "critical") return null;
  const safeRecentCount = Number.isFinite(recentCount) && recentCount >= 0 ? Math.min(6, Math.floor(recentCount)) : 0;
  return `${filter}:critical:${safeRecentCount}`;
}

export function isPersistenceFailureAlertAcknowledged(acknowledgment: PersistenceFailureAlertAcknowledgment | null | undefined, key: string | null): boolean {
  if (!acknowledgment || !key) return false;
  return getPersistenceFailureAlertAcknowledgmentKey(acknowledgment.filter, acknowledgment.level, acknowledgment.recentCount) === key;
}

export type PersistenceFailureAlertUnacknowledgment = { filter: PersistenceFailureHistoryFilter; level: "critical"; recentCount: number; unacknowledgedAt: string };

function normalizePersistenceFailureAlertUnacknowledgment(value: unknown): PersistenceFailureAlertUnacknowledgment | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<PersistenceFailureAlertUnacknowledgment>;
  if ((candidate.filter !== "all" && candidate.filter !== "current" && candidate.filter !== "stale") || candidate.level !== "critical" || typeof candidate.recentCount !== "number" || !Number.isFinite(candidate.recentCount) || candidate.recentCount < 0 || typeof candidate.unacknowledgedAt !== "string") return null;
  const timestamp = Date.parse(candidate.unacknowledgedAt);
  if (!Number.isFinite(timestamp)) return null;
  return { filter: candidate.filter, level: "critical", recentCount: Math.min(6, Math.floor(candidate.recentCount)), unacknowledgedAt: new Date(timestamp).toISOString() };
}

export function readPersistenceFailureAlertUnacknowledgment(storage: Pick<Storage, "getItem"> | undefined): PersistenceFailureAlertUnacknowledgment | null {
  try {
    const raw = storage?.getItem(persistenceAlertUnacknowledgmentStorageKey);
    return raw ? normalizePersistenceFailureAlertUnacknowledgment(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

export function writePersistenceFailureAlertUnacknowledgment(storage: Pick<Storage, "setItem"> | undefined, unacknowledgment: PersistenceFailureAlertUnacknowledgment): boolean {
  try {
    const normalized = normalizePersistenceFailureAlertUnacknowledgment(unacknowledgment);
    if (!normalized || !storage) return false;
    storage.setItem(persistenceAlertUnacknowledgmentStorageKey, JSON.stringify(normalized));
    return true;
  } catch {
    return false;
  }
}

export function clearPersistenceFailureAlertUnacknowledgment(storage: Pick<Storage, "removeItem"> | undefined): boolean {
  try {
    storage?.removeItem(persistenceAlertUnacknowledgmentStorageKey);
    return !!storage;
  } catch {
    return false;
  }
}

export function isPersistenceFailureAlertUnacknowledged(unacknowledgment: PersistenceFailureAlertUnacknowledgment | null | undefined, key: string | null): boolean {
  if (!unacknowledgment || !key) return false;
  return getPersistenceFailureAlertAcknowledgmentKey(unacknowledgment.filter, unacknowledgment.level, unacknowledgment.recentCount) === key;
}

export function getPersistenceFailureAlertUnacknowledgmentNotice(filter: PersistenceFailureHistoryFilter, recentCount: number, unacknowledgedAt?: string): string {
  const safeRecentCount = Number.isFinite(recentCount) && recentCount >= 0 ? Math.min(6, Math.floor(recentCount)) : 0;
  const timestamp = typeof unacknowledgedAt === "string" ? Date.parse(unacknowledgedAt) : Number.NaN;
  const timestampNotice = Number.isFinite(timestamp) ? ` at ${new Date(timestamp).toISOString()}` : "";
  return `Critical persistence recurrence unacknowledged for the ${filter} scope (${safeRecentCount} recent safe failure${safeRecentCount === 1 ? "" : "s"})${timestampNotice}; the escalation remains visible for this session.`;
}

export function getPersistenceFailureAlertAcknowledgmentNotice(filter: PersistenceFailureHistoryFilter, recentCount: number, acknowledgedAt?: string): string {
  const safeRecentCount = Number.isFinite(recentCount) && recentCount >= 0 ? Math.min(6, Math.floor(recentCount)) : 0;
  const timestamp = typeof acknowledgedAt === "string" ? Date.parse(acknowledgedAt) : Number.NaN;
  const timestampNotice = Number.isFinite(timestamp) ? ` at ${new Date(timestamp).toISOString()}` : "";
  return `Critical persistence recurrence acknowledged for the ${filter} scope (${safeRecentCount} recent safe failure${safeRecentCount === 1 ? "" : "s"})${timestampNotice} for this session.`;
}

export function getPersistenceFailureAlertLevel(recentCount: number, thresholds: PersistenceFailureAlertThresholds = DEFAULT_PERSISTENCE_FAILURE_ALERT_THRESHOLDS): PersistenceFailureAlertLevel {
  const safeRecentCount = Number.isFinite(recentCount) && recentCount >= 0 ? Math.min(6, Math.floor(recentCount)) : 0;
  const safeThresholds = normalizePersistenceFailureAlertThresholds(thresholds);
  return safeRecentCount >= safeThresholds.criticalCount ? "critical" : safeRecentCount >= safeThresholds.watchCount ? "watch" : "clear";
}

export function getPersistenceFailureAlertEscalationNotice(previous: PersistenceFailureAlertLevel, current: PersistenceFailureAlertLevel): string | null {
  if (previous !== "watch" || current !== "critical") return null;
  return "Persistence recurrence escalated from watch to critical. Pause automated review and inspect the rule guide.";
}

export function getPersistenceFailureAlertExplanation(level: PersistenceFailureAlertLevel, recentCount: number, thresholds: PersistenceFailureAlertThresholds = DEFAULT_PERSISTENCE_FAILURE_ALERT_THRESHOLDS): string {
  const safeThresholds = normalizePersistenceFailureAlertThresholds(thresholds);
  const safeRecentCount = Number.isFinite(recentCount) && recentCount >= 0 ? Math.min(6, Math.floor(recentCount)) : 0;
  if (level === "critical") return `${safeRecentCount} recent safe failures meet the critical threshold of ${safeThresholds.criticalCount}. Pause automated review and inspect the rule guide.`;
  if (level === "watch") return `${safeRecentCount} recent safe failures meet the watch threshold of ${safeThresholds.watchCount}. Review the bounded history before proceeding.`;
  return "Recent persistence failures are below the configured watch threshold.";
}

export function getPersistenceAlertThresholdRestorationNotice(thresholds: PersistenceFailureAlertThresholds, restored: boolean): string | null {
  if (!restored) return null;
  return `Restored alert thresholds: watch ${thresholds.watchCount}, critical ${thresholds.criticalCount}.`;
}

export function getPersistenceFailureAlertLabel(level: PersistenceFailureAlertLevel): string {
  return level === "critical" ? "Critical recurrence" : level === "watch" ? "Watch recurrence" : "Clear recurrence";
}

export type PersistenceFailureTrend = { direction: "rising" | "falling" | "flat" | "insufficient"; priorCount: number; recentCount: number };

export function getPersistenceHistoryFilterSummary(filter: PersistenceFailureHistoryFilter, visibleCount: number): string {
  const safeCount = Number.isFinite(visibleCount) && visibleCount >= 0 ? Math.min(6, Math.floor(visibleCount)) : 0;
  const label = filter === "current" ? "current" : filter === "stale" ? "stale" : "all";
  return `${label[0].toUpperCase()}${label.slice(1)} persistence history: ${safeCount} safe entr${safeCount === 1 ? "y" : "ies"}.`;
}

export function getPersistenceFailureTrend(history: ReadonlyArray<{ rule: string; observedAt: string }> | undefined): PersistenceFailureTrend {
  const safeHistory = (history ?? []).filter(entry => !!entry && !!getPersistenceRuleGuidance(entry.rule) && Number.isFinite(new Date(entry.observedAt).getTime())).slice(-6);
  if (safeHistory.length < 4) return { direction: "insufficient", priorCount: 0, recentCount: 0 };
  const midpoint = Math.floor(safeHistory.length / 2);
  const priorCount = safeHistory.slice(0, midpoint).length;
  const recentCount = safeHistory.slice(midpoint).length;
  return { direction: recentCount > priorCount ? "rising" : recentCount < priorCount ? "falling" : "flat", priorCount, recentCount };
}

export type PersistenceRuleRecurrence = { rule: string; count: number };

export function getPersistenceRuleRecurrence(history: ReadonlyArray<{ rule: string }> | undefined): PersistenceRuleRecurrence[] {
  const counts = new Map<string, number>();
  for (const entry of history ?? []) {
    if (!entry || !getPersistenceRuleGuidance(entry.rule)) continue;
    counts.set(entry.rule, Math.min(6, (counts.get(entry.rule) ?? 0) + 1));
  }
  return Array.from(counts.entries()).sort(([left], [right]) => left.localeCompare(right)).map(([rule, count]) => ({ rule, count }));
}

export type PersistenceDiagnosticsExportInput = {
  exportedAt: string;
  filter: PersistenceFailureHistoryFilter;
  history: ReadonlyArray<{ rule: string; observedAt: string }> | undefined;
  trend: PersistenceFailureTrend;
  alert: PersistenceFailureAlertLevel;
  thresholds: PersistenceFailureAlertThresholds;
};

function normalizeExportTimestamp(value: string): string {
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : "invalid";
}

export function buildPersistenceDiagnosticsExport(input: PersistenceDiagnosticsExportInput): string {
  const filter = input.filter === "current" || input.filter === "stale" ? input.filter : "all";
  const history = filterPersistenceFailureHistory(input.history, filter);
  const safeTrend = input.trend.direction === "rising" || input.trend.direction === "falling" || input.trend.direction === "flat" || input.trend.direction === "insufficient" ? input.trend : { direction: "insufficient" as const, priorCount: 0, recentCount: 0 };
  const boundedCount = (value: number) => Number.isFinite(value) && value >= 0 ? Math.min(6, Math.floor(value)) : 0;
  return JSON.stringify({
    schemaVersion: 1,
    exportedAt: normalizeExportTimestamp(input.exportedAt),
    scope: filter,
    alert: input.alert === "critical" || input.alert === "watch" ? input.alert : "clear",
    thresholds: normalizePersistenceFailureAlertThresholds(input.thresholds),
    trend: { direction: safeTrend.direction, priorCount: boundedCount(safeTrend.priorCount), recentCount: boundedCount(safeTrend.recentCount) },
    recurrence: getPersistenceRuleRecurrence(history),
    history,
  }, null, 2);
}
