export type FeedbackTimer = ReturnType<typeof setTimeout>;

export function scheduleFeedbackReset(
  schedule: (callback: () => void, delayMs: number) => FeedbackTimer,
  cancel: (timer: FeedbackTimer) => void,
  previousTimer: FeedbackTimer | null,
  reset: () => void,
  delayMs: number,
): FeedbackTimer {
  if (previousTimer !== null) cancel(previousTimer);
  return schedule(reset, delayMs);
}
