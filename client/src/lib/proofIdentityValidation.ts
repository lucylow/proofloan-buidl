import { isAddressShapedIdentity, isLiveChainWalletAddress, isLiveTxHash, type SourceChain } from "@shared/proofloan";

export function getProofIdentityValidationError(value: string, sourceChain: SourceChain): string | undefined;
export function getProofIdentityValidationError(walletAddress: string, sourceTransactionHash: string, sourceChain: SourceChain): string | undefined;
export function getProofIdentityValidationError(first: string, second: string, third?: SourceChain): string | undefined {
  const walletAddress = third === undefined ? first : first;
  const legacySingleField = third === undefined;
  const sourceChain = legacySingleField ? (second as SourceChain) : third as SourceChain;
  const sourceTransactionHash = legacySingleField ? (!isLiveChainWalletAddress(first, sourceChain) && first.trim().startsWith("0x") && first.trim().length >= 18 ? first.trim() : "") : second.trim();
  if (walletAddress.trim().length < 8) return "Enter a wallet address or preview identifier before requesting verification.";
  if (isAddressShapedIdentity(walletAddress) && !isLiveChainWalletAddress(walletAddress, sourceChain)) return "This wallet address is not a valid EVM address for the selected chain.";
  if (sourceTransactionHash && !isLiveTxHash(sourceTransactionHash)) return "Source transaction hashes must be 0x-prefixed 32-byte hexadecimal values.";
  if (sourceTransactionHash && !legacySingleField && !isLiveChainWalletAddress(walletAddress, sourceChain)) return "Live proof requests require a valid EVM wallet address for the selected chain.";
  return undefined;
}

export function hasLiveProofIdentity(sourceTransactionHash: string): boolean {
  return isLiveTxHash(sourceTransactionHash.trim());
}
