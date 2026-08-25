import { isAddressShapedIdentity, isLiveChainWalletAddress, isLiveTxHash, type SourceChain } from "@shared/proofloan";

export function getProofIdentityValidationError(value: string, sourceChain: SourceChain): string | undefined {
  const normalized = value.trim();
  if (normalized.length < 8) return "Enter a preview identifier or source transaction hash before requesting verification.";
  if (isAddressShapedIdentity(normalized) && !isLiveChainWalletAddress(normalized, sourceChain)) {
    return "This address-shaped value is not a valid EVM wallet for the selected chain.";
  }
  if (normalized.startsWith("0x") && normalized.length >= 18 && !isLiveChainWalletAddress(normalized, sourceChain) && !isLiveTxHash(normalized)) {
    return "Source transaction hashes must be 0x-prefixed 32-byte hexadecimal values.";
  }
  return undefined;
}
