import { describe, expect, it } from "vitest";
import { getMobileErrorNoticeModel, isRetryableMobileError } from "./mobileErrorNotice";

describe("mobile error notice model", () => {
  it("strips the structured prefix while preserving the proof-worker code", () => {
    expect(getMobileErrorNoticeModel("[PROOFLOAN_PROOF_WORKER_ERROR] Source transaction is not mined yet.", true)).toEqual({
      code: "PROOFLOAN_PROOF_WORKER_ERROR",
      message: "Source transaction is not mined yet.",
      canRetry: true,
    });
  });

  it("only exposes retry when the caller provides a retry action", () => {
    expect(getMobileErrorNoticeModel("[PROOFLOAN_STATE_CONFLICT] Offer is already accepted.")).toEqual({
      code: "PROOFLOAN_STATE_CONFLICT",
      message: "Offer is already accepted.",
      canRetry: false,
    });
    expect(isRetryableMobileError(true)).toBe(true);
    expect(isRetryableMobileError(false)).toBe(false);
    expect(isRetryableMobileError(undefined)).toBe(false);
  });
});
