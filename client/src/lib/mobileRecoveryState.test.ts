import { describe, expect, it } from "vitest";
import { getMobileActionAvailability, shouldPollCreditFile, shouldShowAcceptanceError } from "./mobileRecoveryState";

describe("mobile action availability", () => {
  it("disables every network action while offline", () => {
    expect(getMobileActionAvailability({ isOnline: false, proofPending: false, refreshPending: false, acceptPending: false })).toEqual({
      canSubmitProof: false,
      canRefresh: false,
      canAccept: false,
    });
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
