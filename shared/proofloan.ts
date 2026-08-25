export const PROOFLOAN_ERROR_CODES = {
  VALIDATION: "PROOFLOAN_VALIDATION_ERROR",
  DATABASE: "PROOFLOAN_DATABASE_ERROR",
  PROOF_WORKER: "PROOFLOAN_PROOF_WORKER_ERROR",
  POLICY: "PROOFLOAN_POLICY_ERROR",
  STATE_CONFLICT: "PROOFLOAN_STATE_CONFLICT",
  RATE_LIMITED: "PROOFLOAN_RATE_LIMITED",
} as const;

export type ProofLoanErrorCode = (typeof PROOFLOAN_ERROR_CODES)[keyof typeof PROOFLOAN_ERROR_CODES];

export function getProofLoanErrorCode(message: string): ProofLoanErrorCode | undefined {
  return Object.values(PROOFLOAN_ERROR_CODES).find(code => message.includes(`[${code}]`));
}

export function cleanProofLoanErrorMessage(message: string): string {
  return message.replace(/^\[[^\]]+\]\s*/, "");
}

export function isExpectedProofLoanError(error: unknown): boolean {
  return error instanceof Error && getProofLoanErrorCode(error.message) !== undefined;
}

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
export type VerifiedEventType = VerifiedFact["eventType"];
export type Freshness = VerifiedFact["freshness"];
export type RiskTier = Decision["riskTier"];
export type OfferStatus = Offer["status"];

export function isProofLoanState(value: string): value is ProofLoanState {
  return (PROOFLOAN_STATES as readonly string[]).includes(value);
}

export function isSourceChain(value: string): value is SourceChain {
  return value === "Ethereum Sepolia" || value === "Polygon Amoy";
}

export function isReasonCode(value: string): value is ReasonCode {
  return (REASON_CODES as readonly string[]).includes(value);
}

export function isVerifiedEventType(value: string): value is VerifiedEventType {
  return value === "REPAYMENT" || value === "COLLATERAL_DEPOSIT" || value === "LATE_PAYMENT";
}

export function isFreshness(value: string): value is Freshness {
  return value === "Fresh" || value === "Aging" || value === "Stale";
}

export function isRiskTier(value: string): value is RiskTier {
  return value === "A" || value === "B" || value === "C" || value === "D";
}

export function isOfferStatus(value: string): value is OfferStatus {
  return value === "Ready" || value === "Blocked" || value === "Accepted" || value === "Executed";
}

export function isLiveTxHash(value: string): boolean {
  return /^0x[a-fA-F0-9]{64}$/.test(value.trim());
}

export function isLiveChainTransactionHash(value: string, sourceChain: string): boolean {
  return isSourceChain(sourceChain) && isLiveTxHash(value);
}

export function isLiveChainWalletAddress(value: string, sourceChain: string): boolean {
  return isSourceChain(sourceChain) && /^0x[a-fA-F0-9]{40}$/.test(value.trim());
}

export function isAddressShapedIdentity(value: string): boolean {
  const normalized = value.trim();
  return normalized.startsWith("0x") && normalized.length >= 42;
}

export function isProofLoanApplicationId(value: string): boolean {
  return /^PL-[A-Z0-9_-]{8,128}$/.test(value.trim());
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
  featureFingerprint?: string;
};

export type Offer = {
  amount: number;
  apr: number;
  ltv: number;
  collateralValue?: number;
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
