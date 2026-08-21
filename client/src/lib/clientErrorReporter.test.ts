import { describe, expect, it } from "vitest";
import { createClientErrorReport } from "./clientErrorReporter";

describe("client error reporter", () => {
  it("preserves stable ProofLoan codes while stripping protocol prefixes", () => {
    const report = createClientErrorReport("query", new Error("[PROOFLOAN_DATABASE_ERROR] Database unavailable."));
    expect(report.context).toBe("query");
    expect(report.code).toBe("PROOFLOAN_DATABASE_ERROR");
    expect(report.message).toBe("Database unavailable.");
    expect(report.name).toBe("Error");
  });

  it("bounds unexpected messages and component stacks", () => {
    const report = createClientErrorReport("runtime", new Error("x".repeat(300)), "\n".repeat(10) + "Component".repeat(100));
    expect(report.message.length).toBeLessThanOrEqual(180);
    expect(report.componentStack?.length).toBeLessThanOrEqual(240);
    expect(report.message).toContain("…");
  });

  it("handles non-Error values without throwing", () => {
    const report = createClientErrorReport("mutation", { secret: "should not be serialized" });
    expect(report.name).toBe("UnknownError");
    expect(report.message).toBe("Unknown client error");
    expect(report).not.toHaveProperty("secret");
  });
});
