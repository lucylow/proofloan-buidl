import { describe, expect, it } from "vitest";
import { getAcceptanceFailureRecovery, getMobileActionAvailability, getMobileCreditFileViewState, shouldClearMissingApplication, shouldInvokeMobileAction, shouldPollCreditFile, shouldRetryCreditFileQuery, shouldShowAcceptanceError } from "./mobileRecoveryState";

describe("mobile action availability", () => {
  it("disables every network action while offline", () => {
    expect(getMobileActionAvailability({ isOnline: false, proofPending: false, refreshPending: false, acceptPending: false })).toEqual({
      canSubmitProof: false,
      canRefresh: false,
      canAccept: false,
    });
  });

  it("resumes a paused credit-file query only for online acceptance recovery", () => {
    expect(getAcceptanceFailureRecovery({ hasApplication: true, isOnline: true, pollingPaused: true })).toEqual({ shouldResumePolling: true, shouldInvalidateCreditFile: true });
    expect(getAcceptanceFailureRecovery({ hasApplication: true, isOnline: true, pollingPaused: false })).toEqual({ shouldResumePolling: false, shouldInvalidateCreditFile: true });
    expect(getAcceptanceFailureRecovery({ hasApplication: true, isOnline: false, pollingPaused: true })).toEqual({ shouldResumePolling: false, shouldInvalidateCreditFile: false });
    expect(getAcceptanceFailureRecovery({ hasApplication: false, isOnline: true, pollingPaused: true })).toEqual({ shouldResumePolling: false, shouldInvalidateCreditFile: false });
  });

  it("blocks delayed or programmatic actions while offline or pending", () => {
    expect(shouldInvokeMobileAction({ action: "proof", isOnline: false, pending: false, hasApplication: false })).toBe(false);
    expect(shouldInvokeMobileAction({ action: "proof", isOnline: true, pending: true, hasApplication: false })).toBe(false);
    expect(shouldInvokeMobileAction({ action: "refresh", isOnline: true, pending: false, hasApplication: false })).toBe(false);
    expect(shouldInvokeMobileAction({ action: "accept", isOnline: true, pending: false, hasApplication: false })).toBe(false);
    expect(shouldInvokeMobileAction({ action: "accept", isOnline: true, pending: false, hasApplication: true })).toBe(true);
  });

  it("allows at most one automatic retry only while online and unpaused", () => {
    expect(shouldRetryCreditFileQuery({ isOnline: true, pollingPaused: false, failureCount: 0 })).toBe(true);
    expect(shouldRetryCreditFileQuery({ isOnline: true, pollingPaused: false, failureCount: 1 })).toBe(false);
    expect(shouldRetryCreditFileQuery({ isOnline: false, pollingPaused: false, failureCount: 0 })).toBe(false);
    expect(shouldRetryCreditFileQuery({ isOnline: true, pollingPaused: true, failureCount: 0 })).toBe(false);
  });

  it("classifies credit-file loading, error, empty, and ready states safely", () => {
    expect(getMobileCreditFileViewState({ hasApplication: false, isLoading: true, hasError: false })).toBe("loading");
    expect(getMobileCreditFileViewState({ hasApplication: true, isLoading: true, hasError: true })).toBe("error");
    expect(getMobileCreditFileViewState({ hasApplication: false, isLoading: false, hasError: false })).toBe("empty");
    expect(getMobileCreditFileViewState({ hasApplication: true, isLoading: false, hasError: false })).toBe("ready");
  });

  it("clears only a completed, error-free missing application result", () => {
    expect(shouldClearMissingApplication({ hasApplicationId: true, hasData: true, isLoading: false, isFetching: false, hasError: false })).toBe(true);
    expect(shouldClearMissingApplication({ hasApplicationId: true, hasData: false, isLoading: true, isFetching: true, hasError: false })).toBe(false);
    expect(shouldClearMissingApplication({ hasApplicationId: true, hasData: true, isLoading: false, isFetching: true, hasError: false })).toBe(false);
    expect(shouldClearMissingApplication({ hasApplicationId: true, hasData: true, isLoading: false, isFetching: false, hasError: true })).toBe(false);
    expect(shouldClearMissingApplication({ hasApplicationId: false, hasData: true, isLoading: false, isFetching: false, hasError: false })).toBe(false);
  });

  it("stops background polling for missing, offline, or paused credit files", () => {
    expect(shouldPollCreditFile({ hasApplication: false, isOnline: true, pollingPaused: false })).toBe(false);
    expect(shouldPollCreditFile({ hasApplication: true, isOnline: false, pollingPaused: false })).toBe(false);
    expect(shouldPollCreditFile({ hasApplication: true, isOnline: true, pollingPaused: true })).toBe(false);
    expect(shouldPollCreditFile({ hasApplication: true, isOnline: true, pollingPaused: false })).toBe(true);
  });

  it("shows acceptance failures only while the offer can still be acted on", () => {
    expect(shouldShowAcceptanceError({ state: "AwaitingAcceptance", hasError: true })).toBe(true);
    expect(shouldShowAcceptanceError({ state: "Executed", hasError: true })).toBe(false);
    expect(shouldShowAcceptanceError({ state: "Rejected", hasError: true })).toBe(false);
    expect(shouldShowAcceptanceError({ state: "Executed", hasError: false })).toBe(false);
  });

  it("suppresses duplicate taps independently for each pending action", () => {
    expect(getMobileActionAvailability({ isOnline: true, proofPending: true, refreshPending: false, acceptPending: true })).toEqual({
      canSubmitProof: false,
      canRefresh: true,
      canAccept: false,
    });
  });
});
