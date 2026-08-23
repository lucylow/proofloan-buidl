import { JsonRpcProvider } from "ethers";
import { blockProver, proofProvider } from "@gluwa/usc-sdk";
import type { SourceChain, VerifiedFact } from "@shared/proofloan";
import { hashValue } from "./underwriting";

const CREDITCOIN_TESTNET_RPC = "https://rpc.cc3-testnet.creditcoin.network";
const PROOF_BUILDER_URL = "https://proof-gen-api.cc3-testnet.creditcoin.network";
const CHAIN_KEYS: Record<SourceChain, number> = { "Ethereum Sepolia": 1, "Polygon Amoy": 2 };

export type AttestcoinProofResult = {
  verified: boolean;
  chainKey: number;
  sourceBlock: number;
  verificationBlock: number;
  txHash: string;
  proofRoot: string;
  mode: "sdk" | "preview-fallback";
};

export async function verifyTransactionWithAttestcoin(txHash: string, sourceChain: SourceChain): Promise<AttestcoinProofResult> {
  const chainKey = CHAIN_KEYS[sourceChain];
  const sourceRpc = sourceChain === "Ethereum Sepolia" ? "https://ethereum-sepolia-rpc.publicnode.com" : "https://polygon-amoy-bor-rpc.publicnode.com";
  const sourceProvider = new JsonRpcProvider(sourceRpc);
  const creditcoinProvider = new JsonRpcProvider(CREDITCOIN_TESTNET_RPC);
  const tx = await sourceProvider.getTransaction(txHash);
  if (!tx?.blockNumber) throw new Error("Source transaction is not mined yet.");
  const builder = new proofProvider.service.ProofBuilder(chainKey, PROOF_BUILDER_URL, 5000);
  await builder.waitUntilHeightAttested(chainKey, tx.blockNumber);
  const result = await builder.getProof(txHash);
  if (!result.success || !result.data) throw new Error(`Attestcoin proof generation failed: ${result.error ?? "unknown error"}`);
  const proofData = result.data;
  const prover = new blockProver.PrecompileBlockProver(creditcoinProvider);
  const verified = await prover.verifySingle(proofData.chainKey, proofData.headerNumber, proofData.txBytes, proofData.merkleProof, proofData.continuityProof);
  return {
    verified,
    chainKey,
    sourceBlock: proofData.headerNumber,
    verificationBlock: await creditcoinProvider.getBlockNumber(),
    txHash,
    proofRoot: `0x${hashValue({ txHash, headerNumber: proofData.headerNumber, chainKey })}`,
    mode: "sdk",
  };
}

export function previewAttestcoinFacts(walletAddress: string, sourceChain: SourceChain): VerifiedFact[] {
  const root = `0xpreview_${hashValue({ walletAddress, sourceChain, protocol: "Attestcoin Protocol" })}`;
  const chainPrefix = sourceChain === "Ethereum Sepolia" ? "0x7a" : "0x9b";
  const verificationBlock = sourceChain === "Ethereum Sepolia" ? 7_000_000 : 13_000_000;
  const now = new Date().toISOString();
  return [
    { id: `vf_${hashValue({ root, n: 1 })}`, chain: sourceChain, sourceBlock: sourceChain === "Ethereum Sepolia" ? 6421883 : 12804112, txHash: `${chainPrefix}a91f...c42e`, eventType: "REPAYMENT", amount: "1,250 USDC", asset: "USDC", verificationBlock, verifiedAt: now, observedAt: new Date(Date.now() - 3 * 86_400_000).toISOString(), freshness: "Fresh", proofRoot: `${root}_a`, proofWorker: "Attestcoin proof worker" },
    { id: `vf_${hashValue({ root, n: 2 })}`, chain: sourceChain, sourceBlock: sourceChain === "Ethereum Sepolia" ? 6104220 : 12330441, txHash: `${chainPrefix}4b07...8aa1`, eventType: "COLLATERAL_DEPOSIT", amount: "2,800 USDC", asset: "USDC", verificationBlock: verificationBlock + 5, verifiedAt: now, observedAt: new Date(Date.now() - 3 * 86_400_000).toISOString(), freshness: "Fresh", proofRoot: `${root}_b`, proofWorker: "Attestcoin proof worker" },
    { id: `vf_${hashValue({ root, n: 3 })}`, chain: sourceChain, sourceBlock: sourceChain === "Ethereum Sepolia" ? 5998141 : 11990008, txHash: `${chainPrefix}11f8...d912`, eventType: "REPAYMENT", amount: "850 USDC", asset: "USDC", verificationBlock: verificationBlock + 9, verifiedAt: now, observedAt: new Date(Date.now() - 90 * 86_400_000).toISOString(), freshness: "Aging", proofRoot: `${root}_c`, proofWorker: "Attestcoin proof worker" },
  ];
}
