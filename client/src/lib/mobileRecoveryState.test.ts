import { describe, expect, it } from "vitest";
import { getMobileActionAvailability } from "./mobileRecoveryState";

describe("mobile action availability", () => {
  it("disables every network action while offline", () => {
    expect(getMobileActionAvailability({ isOnline: false, proofPending: false, refreshPending: false, acceptPending: false })).toEqual({
      canSubmitProof: false,
      canRefresh: false,
      canAccept: false,
    });
  });

  it("suppresses duplicate taps independently for each pending action", () => {
    expect(getMobileActionAvailability({ isOnline: true, proofPending: true, refreshPending: false, acceptPending: true })).toEqual({
      canSubmitProof: false,
      canRefresh: true,
      canAccept: false,
    });
  });
});
