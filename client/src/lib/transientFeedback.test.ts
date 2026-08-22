import { describe, expect, it, vi } from "vitest";
import { scheduleFeedbackReset, type FeedbackTimer } from "./transientFeedback";

describe("transient feedback scheduling", () => {
  it("cancels the previous timer before scheduling the latest reset", () => {
    const cancelled: FeedbackTimer[] = [];
    const reset = vi.fn();
    const schedule = vi.fn((callback: () => void) => callback as unknown as FeedbackTimer);
    const cancel = vi.fn((timer: FeedbackTimer) => cancelled.push(timer));
    const previous = {} as FeedbackTimer;

    scheduleFeedbackReset(schedule, cancel, previous, reset, 1200);

    expect(cancel).toHaveBeenCalledWith(previous);
    expect(schedule).toHaveBeenCalledWith(reset, 1200);
    expect(reset).not.toHaveBeenCalled();
    expect(cancelled).toEqual([previous]);
  });

  it("does not cancel anything on the first feedback event", () => {
    const cancel = vi.fn();
    const reset = vi.fn();
    scheduleFeedbackReset((callback) => {
      callback();
      return {} as FeedbackTimer;
    }, cancel, null, reset, 1200);

    expect(cancel).not.toHaveBeenCalled();
    expect(reset).toHaveBeenCalledTimes(1);
  });
});
