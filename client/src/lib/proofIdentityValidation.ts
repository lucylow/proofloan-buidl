import { isAddressShapedIdentity, isLiveChainWalletAddress, type SourceChain } from "@shared/proofloan";

export function getProofIdentityValidationError(value: string, sourceChain: SourceChain): string | undefined {
  const normalized = value.trim();
  if (normalized.length < 8) return "Enter a preview identifier or source transaction hash before requesting verification.";
  if (isAddressShapedIdentity(normalized) && !isLiveChainWalletAddress(normalized, sourceChain)) {
    return "This address-shaped value is not a valid EVM wallet for the selected chain.";
  }
  return undefined;
}
