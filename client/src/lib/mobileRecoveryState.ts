export type MobileActionAvailabilityInput = {
  isOnline: boolean;
  proofPending: boolean;
  refreshPending: boolean;
  acceptPending: boolean;
};

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
