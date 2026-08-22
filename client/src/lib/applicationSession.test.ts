import { describe, expect, it } from "vitest";
import { PROOFLOAN_APPLICATION_ID_KEY, clearStoredApplicationId, getSafeSessionStorage, persistApplicationId, readStoredApplicationId } from "./applicationSession";

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
    const storage = createStorage({ [PROOFLOAN_APPLICATION_ID_KEY]: "  PL-123  " });
    expect(readStoredApplicationId(storage)).toBe("PL-123");
    storage.setItem(PROOFLOAN_APPLICATION_ID_KEY, "   ");
    expect(readStoredApplicationId(storage)).toBeNull();
  });

  it("persists and clears the active application ID", () => {
    const storage = createStorage();
    expect(persistApplicationId(storage, "PL-456")).toBe(true);
    expect(readStoredApplicationId(storage)).toBe("PL-456");
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
    expect(persistApplicationId(brokenStorage, "PL-789")).toBe(false);
    expect(clearStoredApplicationId(brokenStorage)).toBe(false);
  });
});
