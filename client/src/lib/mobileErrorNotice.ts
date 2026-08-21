import { cleanProofLoanErrorMessage, getProofLoanErrorCode, PROOFLOAN_ERROR_CODES, type ProofLoanErrorCode } from "@shared/proofloan";

export type MobileErrorNoticeModel = {
  code: string;
  message: string;
  guidance: string;
  actionLabel: string;
  canRetry: boolean;
};

const RECOVERY_BY_CODE: Record<ProofLoanErrorCode, { guidance: string; actionLabel: string }> = {
  [PROOFLOAN_ERROR_CODES.VALIDATION]: { guidance: "Check the source value and selected chain, then submit again.", actionLabel: "Review input" },
  [PROOFLOAN_ERROR_CODES.DATABASE]: { guidance: "Your evidence is unchanged. Refresh the credit file or try again shortly.", actionLabel: "Refresh credit file" },
  [PROOFLOAN_ERROR_CODES.PROOF_WORKER]: { guidance: "Confirm the transaction is mined on the selected testnet, then retry verification.", actionLabel: "Retry verification" },
  [PROOFLOAN_ERROR_CODES.POLICY]: { guidance: "RiskGuard blocked this offer. Review the decision details and contact support if you believe the policy result is incorrect.", actionLabel: "Review decision" },
  [PROOFLOAN_ERROR_CODES.STATE_CONFLICT]: { guidance: "This action is no longer available because the offer state changed. Refresh status before trying another action.", actionLabel: "Refresh status" },
};

export function getMobileErrorNoticeModel(message: string, canRetry = false): MobileErrorNoticeModel {
  const code = getProofLoanErrorCode(message);
  const recovery = code ? RECOVERY_BY_CODE[code] : { guidance: "Try again, and contact support if the problem continues.", actionLabel: "Try again" };
  return {
    code: code ?? "UNCLASSIFIED_ERROR",
    message: cleanProofLoanErrorMessage(message),
    guidance: recovery.guidance,
    actionLabel: recovery.actionLabel,
    canRetry,
  };
}

export function isRetryableMobileError(canRetry: boolean | undefined): boolean {
  return canRetry === true;
}
