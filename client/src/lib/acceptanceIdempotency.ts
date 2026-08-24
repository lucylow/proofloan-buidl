export type AcceptanceIdempotencyRef = {
  applicationId: string;
  key: string;
};

type IdFactory = () => string;

function defaultIdFactory(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") return globalThis.crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export function createAcceptanceIdempotencyKey(applicationId: string, idFactory: IdFactory = defaultIdFactory): string {
  return `accept-${applicationId}-${idFactory()}`;
}

export function getAcceptanceIdempotencyRef(current: AcceptanceIdempotencyRef | null, applicationId: string, idFactory: IdFactory = defaultIdFactory): AcceptanceIdempotencyRef {
  if (current?.applicationId === applicationId) return current;
  return { applicationId, key: createAcceptanceIdempotencyKey(applicationId, idFactory) };
}

export function clearAcceptanceIdempotencyRef(): null {
  return null;
}

export function isAcceptanceIdempotencyKeyValid(key: string): boolean {
  return key.trim().length >= 16 && key.length <= 128;
}
