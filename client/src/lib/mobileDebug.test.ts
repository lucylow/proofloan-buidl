import { describe, expect, it } from "vitest";
import { isDashboardFailureDebugEnabled } from "./mobileDebug";

describe("mobile dashboard debug switch", () => {
  it("is disabled outside development", () => {
    expect(isDashboardFailureDebugEnabled(false, "?debugDashboardError=1")).toBe(false);
  });

  it("requires the explicit development query flag", () => {
    expect(isDashboardFailureDebugEnabled(true, "")).toBe(false);
    expect(isDashboardFailureDebugEnabled(true, "?debugDashboardError=0")).toBe(false);
    expect(isDashboardFailureDebugEnabled(true, "?debugDashboardError=1")).toBe(true);
  });

  it("handles unrelated query values without enabling the failure state", () => {
    expect(isDashboardFailureDebugEnabled(true, "?foo=1&debugDashboardError=true")).toBe(false);
  });
});
