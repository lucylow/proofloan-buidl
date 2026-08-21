import { describe, expect, it } from "vitest";
import { getRuntimeErrorMessage } from "./ErrorBoundary";

describe("runtime error boundary message", () => {
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
