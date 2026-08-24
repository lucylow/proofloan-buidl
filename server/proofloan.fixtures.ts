import type { LoanSnapshot, ProofLoanState } from "@shared/proofloan";

export type LoanFixtureKind = "accepted" | "blocked" | "expired" | "executed";
export type MalformedLoanFixtureKind = "missing-offer" | "partial-offer";

const baseFeatures = { repaymentCount: 2, latePayments: 0, leverageRatio: 0.54, walletAgeDays: 90, volume7d: 1250, volume30d: 1250, volume180d: 2100, evidenceCount: 3, freshnessScore: 0.93 };

function fixtureState(kind: LoanFixtureKind): ProofLoanState {
  if (kind === "blocked") return "Rejected";
  if (kind === "executed") return "Executed";
  return "AwaitingAcceptance";
}

export function createMalformedLoanFixture(applicationId: string, kind: MalformedLoanFixtureKind): LoanSnapshot {
  const base = createLoanFixture(applicationId, "accepted");
  const malformed = kind === "missing-offer" ? { ...base, offer: undefined } : { ...base, offer: { status: "Ready", expiresAt: base.offer?.expiresAt } };
  return malformed as unknown as LoanSnapshot;
}

export function createLoanFixture(applicationId: string, kind: LoanFixtureKind): LoanSnapshot {
  const state = fixtureState(kind);
  const expiresAt = new Date(Date.now() + (kind === "expired" ? -86_400_000 : 86_400_000)).toISOString();
  return {
    applicationId,
    walletAddress: `0xfixture-${kind}`,
    sourceChain: "Ethereum Sepolia",
    state,
    facts: [],
    features: baseFeatures,
    offer: {
      amount: 1500,
      apr: 11.5,
      ltv: 0.54,
      termDays: 90,
      expiresAt,
      poolLiquidity: 250_000,
      status: kind === "blocked" ? "Blocked" : kind === "executed" ? "Executed" : "Ready",
      ...(kind === "blocked" ? { rejectionReason: "Fixture policy rejection." } : {}),
    },
    audit: [],
  };
}
