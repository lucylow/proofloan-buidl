export const PROOFLOAN_STATES = [
  "Intake",
  "EvidencePending",
  "EvidenceVerified",
  "Scored",
  "OfferPrepared",
  "AwaitingAcceptance",
  "Executed",
  "Rejected",
] as const;

export type ProofLoanState = (typeof PROOFLOAN_STATES)[number];

export const REASON_CODES = [
  "STRONG_REPAYMENT_HISTORY",
  "RECENT_LATE_PAYMENT",
  "HIGH_LEVERAGE",
  "SPARSE_EVIDENCE",
] as const;

export type ReasonCode = (typeof REASON_CODES)[number];
export type SourceChain = "Ethereum Sepolia" | "Polygon Amoy";

export function isLiveTxHash(value: string): boolean {
  return /^0x[a-fA-F0-9]{64}$/.test(value);
}

export type VerifiedFact = {
  id: string;
  chain: SourceChain;
  sourceBlock: number;
  txHash: string;
  eventType: "REPAYMENT" | "COLLATERAL_DEPOSIT" | "LATE_PAYMENT";
  amount: string;
  asset: string;
  verificationBlock: number;
  verifiedAt: string;
  observedAt: string;
  freshness: "Fresh" | "Aging" | "Stale";
  proofRoot: string;
  proofWorker: "Attestcoin proof worker";
};

export type FeatureVector = {
  repaymentCount: number;
  latePayments: number;
  leverageRatio: number;
  walletAgeDays: number;
  volume7d: number;
  volume30d: number;
  volume180d: number;
  evidenceCount: number;
  freshnessScore: number;
};

export type Decision = {
  pd30: number;
  pd90: number;
  confidence: number;
  freshnessScore: number;
  riskTier: "A" | "B" | "C" | "D";
  reasonCodes: ReasonCode[];
  modelVersion: string;
  featureVersion: string;
  evidenceRoot: string;
  policyHash: string;
  decisionHash: string;
};

export type Offer = {
  amount: number;
  apr: number;
  ltv: number;
  termDays: number;
  expiresAt: string;
  poolLiquidity: number;
  status: "Ready" | "Blocked" | "Accepted" | "Executed";
  rejectionReason?: string;
};

export type AuditEvent = {
  state: ProofLoanState;
  label: string;
  timestamp: string;
  detail: string;
  hash: string;
};

export type LoanSnapshot = {
  applicationId: string;
  walletAddress: string;
  sourceChain: SourceChain;
  state: ProofLoanState;
  facts: VerifiedFact[];
  features: FeatureVector;
  decision?: Decision;
  offer?: Offer;
  audit: AuditEvent[];
};
