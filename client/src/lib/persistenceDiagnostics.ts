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

export type PersistenceFailureTrend = { direction: "rising" | "falling" | "flat" | "insufficient"; priorCount: number; recentCount: number };

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
