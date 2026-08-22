import { isProofLoanApplicationId } from "@shared/proofloan";

export const PROOFLOAN_APPLICATION_ID_KEY = "proofloan.applicationId";

export type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function getSafeSessionStorage(getter: () => StorageLike): StorageLike | undefined {
  try {
    return getter();
  } catch {
    return undefined;
  }
}

export function normalizeStoredApplicationId(value: string | null | undefined): string | null {
  const normalized = value?.trim() ?? "";
  return isProofLoanApplicationId(normalized) ? normalized : null;
}

export function readStoredApplicationId(storage: StorageLike | undefined): string | null {
  try {
    return normalizeStoredApplicationId(storage?.getItem(PROOFLOAN_APPLICATION_ID_KEY));
  } catch {
    return null;
  }
}

export function persistApplicationId(storage: StorageLike | undefined, applicationId: string): boolean {
  const normalized = normalizeStoredApplicationId(applicationId);
  if (!storage || !normalized) return false;
  try {
    storage.setItem(PROOFLOAN_APPLICATION_ID_KEY, normalized);
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
