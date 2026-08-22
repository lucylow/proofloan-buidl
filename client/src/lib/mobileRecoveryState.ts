export type MobileActionAvailabilityInput = {
  isOnline: boolean;
  proofPending: boolean;
  refreshPending: boolean;
  acceptPending: boolean;
};

export type MobileActionKind = "proof" | "refresh" | "accept";

export function shouldPollCreditFile({ hasApplication, isOnline, pollingPaused }: { hasApplication: boolean; isOnline: boolean; pollingPaused: boolean }): boolean {
  return hasApplication && isOnline && !pollingPaused;
}

export function shouldRetryCreditFileQuery({ isOnline, pollingPaused, failureCount }: { isOnline: boolean; pollingPaused: boolean; failureCount: number }): boolean {
  return isOnline && !pollingPaused && failureCount < 1;
}

export type MobileCreditFileViewState = "loading" | "error" | "empty" | "ready";

export function getMobileCreditFileViewState({ hasApplication, isLoading, hasError }: { hasApplication: boolean; isLoading: boolean; hasError: boolean }): MobileCreditFileViewState {
  if (hasError) return "error";
  if (isLoading) return "loading";
  return hasApplication ? "ready" : "empty";
}

export function shouldShowAcceptanceError({ state, hasError }: { state: string; hasError: boolean }): boolean {
  return hasError && state !== "Executed" && state !== "Rejected";
}

export function getMobileActionAvailability({ isOnline, proofPending, refreshPending, acceptPending }: MobileActionAvailabilityInput) {
  return {
    canSubmitProof: isOnline && !proofPending,
    canRefresh: isOnline && !refreshPending,
    canAccept: isOnline && !acceptPending,
  };
}

export function shouldInvokeMobileAction({ action, isOnline, pending, hasApplication }: { action: MobileActionKind; isOnline: boolean; pending: boolean; hasApplication: boolean }): boolean {
  if (!isOnline || pending) return false;
  if (action === "refresh" || action === "accept") return hasApplication;
  return true;
}

export type AcceptanceFailureRecovery = {
  shouldResumePolling: boolean;
  shouldInvalidateCreditFile: boolean;
};

export function getAcceptanceFailureRecovery({ hasApplication, isOnline, pollingPaused }: { hasApplication: boolean; isOnline: boolean; pollingPaused: boolean }): AcceptanceFailureRecovery {
  const shouldRecover = hasApplication && isOnline;
  return {
    shouldResumePolling: shouldRecover && pollingPaused,
    shouldInvalidateCreditFile: shouldRecover,
  };
}

export function shouldRefreshAfterAcceptanceFailure({ hasApplication, isOnline }: { hasApplication: boolean; isOnline: boolean }): boolean {
  return getAcceptanceFailureRecovery({ hasApplication, isOnline, pollingPaused: false }).shouldInvalidateCreditFile;
}

export function shouldClearMissingApplication({ hasApplicationId, hasData, isLoading, isFetching, hasError }: { hasApplicationId: boolean; hasData: boolean; isLoading: boolean; isFetching: boolean; hasError: boolean }): boolean {
  return hasApplicationId && hasData && !isLoading && !isFetching && !hasError;
}
