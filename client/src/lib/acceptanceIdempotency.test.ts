import { describe, expect, it } from "vitest";
import { createAcceptanceIdempotencyKey, getAcceptanceIdempotencyRef, isAcceptanceIdempotencyKeyValid } from "./acceptanceIdempotency";

describe("acceptance idempotency helpers", () => {
  it("creates a bounded key with the application identity", () => {
    const key = createAcceptanceIdempotencyKey("PL-APPTEST1", () => "stable-request-id");
    expect(key).toBe("accept-PL-APPTEST1-stable-request-id");
    expect(isAcceptanceIdempotencyKeyValid(key)).toBe(true);
  });

  it("reuses the key for retries of the same application", () => {
    const current = { applicationId: "PL-APPTEST1", key: "accept-PL-APPTEST1-existing" };
    expect(getAcceptanceIdempotencyRef(current, "PL-APPTEST1", () => "unused")).toBe(current);
  });

  it("rotates the key when the active application changes", () => {
    const next = getAcceptanceIdempotencyRef({ applicationId: "PL-OLD", key: "accept-PL-OLD-existing" }, "PL-NEW", () => "new-request-id");
    expect(next).toEqual({ applicationId: "PL-NEW", key: "accept-PL-NEW-new-request-id" });
    expect(next.applicationId).not.toBe("PL-OLD");
  });

  it("rejects keys outside the server contract", () => {
    expect(isAcceptanceIdempotencyKeyValid("short")).toBe(false);
    expect(isAcceptanceIdempotencyKeyValid("a".repeat(128))).toBe(true);
    expect(isAcceptanceIdempotencyKeyValid("a".repeat(129))).toBe(false);
  });
});
