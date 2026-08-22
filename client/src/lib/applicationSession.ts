export const PROOFLOAN_APPLICATION_ID_KEY = "proofloan.applicationId";

export type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function getSafeSessionStorage(getter: () => StorageLike): StorageLike | undefined {
  try {
    return getter();
  } catch {
    return undefined;
  }
}

export function readStoredApplicationId(storage: StorageLike | undefined): string | null {
  try {
    const value = storage?.getItem(PROOFLOAN_APPLICATION_ID_KEY)?.trim();
    return value || null;
  } catch {
    return null;
  }
}

export function persistApplicationId(storage: StorageLike | undefined, applicationId: string): boolean {
  if (!storage) return false;
  try {
    storage.setItem(PROOFLOAN_APPLICATION_ID_KEY, applicationId);
    return true;
  } catch {
    return false;
  }
}

export function clearStoredApplicationId(storage: StorageLike | undefined): boolean {
  if (!storage) return false;
  try {
    storage.removeItem(PROOFLOAN_APPLICATION_ID_KEY);
    return true;
  } catch {
    return false;
  }
}
