type ProofRequestIdempotencyRef = {
  fingerprint: string;
  key: string;
};

type IdFactory = () => string;

function defaultIdFactory(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") return globalThis.crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export function getProofRequestIdempotencyKey(current: ProofRequestIdempotencyRef | null, walletAddress: string, sourceChain: string, idFactory: IdFactory = defaultIdFactory, sourceTransactionHash = ""): { fingerprint: string; key: string } {
  const normalizedTransactionHash = sourceTransactionHash.trim();
  const fingerprint = normalizedTransactionHash ? `${walletAddress.trim()}::${normalizedTransactionHash}::${sourceChain}` : `${walletAddress.trim()}::${sourceChain}`;
  if (current?.fingerprint === fingerprint) return current;
  return { fingerprint, key: `proof-${idFactory()}` };
}
