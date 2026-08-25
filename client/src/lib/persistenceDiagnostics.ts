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
