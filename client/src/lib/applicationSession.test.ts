import { describe, expect, it } from "vitest";
import { PROOFLOAN_APPLICATION_ID_KEY, clearStoredApplicationId, getSafeSessionStorage, normalizeStoredApplicationId, persistApplicationId, readStoredApplicationId } from "./applicationSession";

function createStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
  };
}

describe("application session storage", () => {
  it("restores a trimmed application ID and treats blank values as absent", () => {
    const validId = `PL-${"A".repeat(64)}`;
    const storage = createStorage({ [PROOFLOAN_APPLICATION_ID_KEY]: `  ${validId}  ` });
    expect(readStoredApplicationId(storage)).toBe(validId);
    storage.setItem(PROOFLOAN_APPLICATION_ID_KEY, "   ");
    expect(readStoredApplicationId(storage)).toBeNull();
  });

  it("rejects malformed or oversized IDs before they reach the query", () => {
    expect(normalizeStoredApplicationId("PL/123")).toBeNull();
    expect(normalizeStoredApplicationId("x".repeat(129))).toBeNull();
    const validId = `PL-${"B".repeat(32)}_ABC`;
    expect(normalizeStoredApplicationId(` ${validId} `)).toBe(validId);
    const storage = createStorage({ [PROOFLOAN_APPLICATION_ID_KEY]: "<script>" });
    expect(readStoredApplicationId(storage)).toBeNull();
  });

  it("persists and clears the active application ID", () => {
    const storage = createStorage();
    const validId = `PL-${"C".repeat(64)}`;
    expect(persistApplicationId(storage, ` ${validId} `)).toBe(true);
    expect(readStoredApplicationId(storage)).toBe(validId);
    expect(persistApplicationId(storage, "PL/invalid")).toBe(false);
    expect(clearStoredApplicationId(storage)).toBe(true);
    expect(readStoredApplicationId(storage)).toBeNull();
  });

  it("returns no storage when the browser blocks sessionStorage access", () => {
    expect(getSafeSessionStorage(() => { throw new Error("blocked"); })).toBeUndefined();
    expect(persistApplicationId(undefined, "PL-000")).toBe(false);
    expect(clearStoredApplicationId(undefined)).toBe(false);
  });

  it("fails closed when browser storage throws", () => {
    const brokenStorage = {
      getItem: () => { throw new Error("blocked"); },
      setItem: () => { throw new Error("blocked"); },
      removeItem: () => { throw new Error("blocked"); },
    };
    expect(readStoredApplicationId(brokenStorage)).toBeNull();
    expect(persistApplicationId(brokenStorage, `PL-${"D".repeat(64)}`)).toBe(false);
    expect(clearStoredApplicationId(brokenStorage)).toBe(false);
  });
});
