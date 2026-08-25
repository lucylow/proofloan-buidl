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

export type PersistenceRuleRecurrence = { rule: string; count: number };

export function getPersistenceRuleRecurrence(history: ReadonlyArray<{ rule: string }> | undefined): PersistenceRuleRecurrence[] {
  const counts = new Map<string, number>();
  for (const entry of history ?? []) {
    if (!entry || !getPersistenceRuleGuidance(entry.rule)) continue;
    counts.set(entry.rule, Math.min(6, (counts.get(entry.rule) ?? 0) + 1));
  }
  return Array.from(counts.entries()).sort(([left], [right]) => left.localeCompare(right)).map(([rule, count]) => ({ rule, count }));
}
