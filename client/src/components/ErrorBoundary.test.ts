import { describe, expect, it } from "vitest";
import { getNextRetryKey, getRuntimeErrorMessage } from "./ErrorBoundary";

describe("runtime error boundary message", () => {
  it("advances the retry key so a failed subtree can remount", () => {
    expect(getNextRetryKey(0)).toBe(1);
    expect(getNextRetryKey(41)).toBe(42);
  });

  it("wraps the retry key safely at the maximum integer", () => {
    expect(getNextRetryKey(Number.MAX_SAFE_INTEGER)).toBe(0);
    expect(getNextRetryKey(Number.NaN)).toBe(0);
  });

  it("preserves a short user-safe error message", () => {
    expect(getRuntimeErrorMessage(new Error("Chunk failed to load."))).toBe("Chunk failed to load.");
  });

  it("does not expose long internal stack-like messages", () => {
    expect(getRuntimeErrorMessage(new Error("x".repeat(181)))).toBe("The application encountered an unexpected problem.");
  });

  it("uses a safe fallback when the error has no message", () => {
    expect(getRuntimeErrorMessage(new Error())).toBe("The application encountered an unexpected problem.");
  });
});
