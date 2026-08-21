import { cleanProofLoanErrorMessage, getProofLoanErrorCode } from "@shared/proofloan";

export type MobileErrorNoticeModel = {
  code: string;
  message: string;
  canRetry: boolean;
};

export function getMobileErrorNoticeModel(message: string, canRetry = false): MobileErrorNoticeModel {
  return {
    code: getProofLoanErrorCode(message) ?? "UNCLASSIFIED_ERROR",
    message: cleanProofLoanErrorMessage(message),
    canRetry,
  };
}

export function isRetryableMobileError(canRetry: boolean | undefined): boolean {
  return canRetry === true;
}
