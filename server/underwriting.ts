import { createHash } from "node:crypto";
import { invokeLLM } from "./_core/llm";
import {
  type Decision,
  type FeatureVector,
  type Offer,
  type ReasonCode,
  type SourceChain,
  type VerifiedFact,
} from "@shared/proofloan";

const MODEL_VERSION = "proofloan-underwriter-v0.1.0";
const FEATURE_VERSION = "feature-vector-v0.1.0";
const POLICY_HASH = "riskguard-policy-v0.1.0:amount-ltv-rate-freshness-confidence-liquidity";

export const hashValue = (value: unknown) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 18);

export function buildVerifiedFacts(walletAddress: string, sourceChain: SourceChain): VerifiedFact[] {
  const chainPrefix = sourceChain === "Ethereum Sepolia" ? "0x7a" : "0x9b";
  const now = new Date().toISOString();
  return [
    {
      id: `vf_${hashValue({ walletAddress, sourceChain, n: 1 })}`,
      chain: sourceChain,
      sourceBlock: sourceChain === "Ethereum Sepolia" ? 6_421_883 : 12_804_112,
      txHash: `${chainPrefix}a91f...c42e`,
      eventType: "REPAYMENT",
      amount: "1,250 USDC",
      asset: "USDC",
      verificationBlock: 3_204_118,
      verifiedAt: now,
      observedAt: new Date(Date.now() - 3 * 86_400_000).toISOString(),
      freshness: "Fresh",
      proofRoot: `0xproof_${hashValue({ walletAddress, sourceChain, root: 1 })}`,
      proofWorker: "Attestcoin proof worker",
    },
    {
      id: `vf_${hashValue({ walletAddress, sourceChain, n: 2 })}`,
      chain: sourceChain,
      sourceBlock: sourceChain === "Ethereum Sepolia" ? 6_104_220 : 12_330_441,
      txHash: `${chainPrefix}4b07...8aa1`,
      eventType: "COLLATERAL_DEPOSIT",
      amount: "2,800 USDC",
      asset: "USDC",
      verificationBlock: 3_204_123,
      verifiedAt: now,
      observedAt: new Date(Date.now() - 3 * 86_400_000).toISOString(),
      freshness: "Fresh",
      proofRoot: `0xproof_${hashValue({ walletAddress, sourceChain, root: 2 })}`,
      proofWorker: "Attestcoin proof worker",
    },
    {
      id: `vf_${hashValue({ walletAddress, sourceChain, n: 3 })}`,
      chain: sourceChain,
      sourceBlock: sourceChain === "Ethereum Sepolia" ? 5_998_141 : 11_990_008,
      txHash: `${chainPrefix}11f8...d912`,
      eventType: "REPAYMENT",
      amount: "850 USDC",
      asset: "USDC",
      verificationBlock: 3_204_127,
      verifiedAt: now,
      observedAt: new Date(Date.now() - 90 * 86_400_000).toISOString(),
      freshness: "Aging",
      proofRoot: `0xproof_${hashValue({ walletAddress, sourceChain, root: 3 })}`,
      proofWorker: "Attestcoin proof worker",
    },
  ];
}

export function buildFeatureVector(facts: VerifiedFact[]): FeatureVector {
  const nowMs = Date.now();
  const ageDays = (fact: VerifiedFact) => Math.max(0, (nowMs - new Date(fact.observedAt).getTime()) / 86_400_000);
  const amountValue = (fact: VerifiedFact) => Number.parseFloat(fact.amount.replace(/[^0-9.]/g, "")) || 0;
  const repaymentFacts = facts.filter(f => f.eventType === "REPAYMENT");
  const latePayments = facts.filter(f => f.eventType === "LATE_PAYMENT").length;
  const collateral = facts.filter(f => f.eventType === "COLLATERAL_DEPOSIT").reduce((sum, fact) => sum + amountValue(fact), 0);
  const repaymentVolume = repaymentFacts.reduce((sum, fact) => sum + amountValue(fact), 0);
  const volumeInWindow = (days: number) => facts.filter(f => ageDays(f) <= days).reduce((sum, fact) => sum + amountValue(fact), 0);
  const walletAgeDays = facts.length ? Math.round(Math.max(...facts.map(f => ageDays(f)))) : 0;
  return {
    repaymentCount: repaymentFacts.length,
    latePayments,
    leverageRatio: Number((repaymentVolume / Math.max(collateral, 1)).toFixed(2)),
    walletAgeDays,
    volume7d: volumeInWindow(7),
    volume30d: volumeInWindow(30),
    volume180d: volumeInWindow(180),
    evidenceCount: facts.length,
    freshnessScore: facts.length ? facts.reduce((sum, fact) => sum + (fact.freshness === "Fresh" ? 1 : fact.freshness === "Aging" ? 0.8 : 0.3), 0) / facts.length : 0,
  };
}

function deterministicDecision(features: FeatureVector, facts: VerifiedFact[]): Decision {
  const sparse = features.evidenceCount < 2;
  const pd30 = Math.min(0.42, Math.max(0.03, 0.12 + features.latePayments * 0.08 + features.leverageRatio * 0.08 - features.repaymentCount * 0.025));
  const pd90 = Math.min(0.58, pd30 + 0.08);
  const reasonCodes: ReasonCode[] = [];
  if (features.repaymentCount >= 2) reasonCodes.push("STRONG_REPAYMENT_HISTORY");
  if (features.latePayments > 0) reasonCodes.push("RECENT_LATE_PAYMENT");
  if (features.leverageRatio > 0.8) reasonCodes.push("HIGH_LEVERAGE");
  if (sparse) reasonCodes.push("SPARSE_EVIDENCE");
  if (reasonCodes.length === 0) reasonCodes.push("SPARSE_EVIDENCE");
  const riskTier: Decision["riskTier"] = pd30 < 0.1 ? "A" : pd30 < 0.18 ? "B" : pd30 < 0.3 ? "C" : "D";
  const evidenceRoot = hashValue(facts.map(f => f.proofRoot));
  const decisionBase = { pd30, pd90, confidence: features.freshnessScore * Math.min(0.98, 0.68 + features.evidenceCount * 0.08), freshnessScore: features.freshnessScore, riskTier, reasonCodes, evidenceRoot };
  return {
    ...decisionBase,
    modelVersion: MODEL_VERSION,
    featureVersion: FEATURE_VERSION,
    policyHash: POLICY_HASH,
    decisionHash: hashValue({ ...decisionBase, modelVersion: MODEL_VERSION, policyHash: POLICY_HASH }),
  };
}

export async function runAiUnderwriting(features: FeatureVector, facts: VerifiedFact[]): Promise<Decision> {
  const baseline = deterministicDecision(features, facts);
  try {
    const response = await invokeLLM({
      messages: [
        { role: "system", content: "You are ProofLoan's underwriting explainer. Return only typed JSON. The AI is advisory; never change arithmetic or policy constraints." },
        { role: "user", content: JSON.stringify({ task: "calibrate_pd_and_reasons", features, allowedReasonCodes: ["STRONG_REPAYMENT_HISTORY", "RECENT_LATE_PAYMENT", "HIGH_LEVERAGE", "SPARSE_EVIDENCE"] }) },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "proofloan_underwriting",
          strict: true,
          schema: {
            type: "object",
            properties: {
              pd30: { type: "number" }, pd90: { type: "number" }, confidence: { type: "number" },
              reasonCodes: { type: "array", items: { type: "string", enum: ["STRONG_REPAYMENT_HISTORY", "RECENT_LATE_PAYMENT", "HIGH_LEVERAGE", "SPARSE_EVIDENCE"] } },
            }, required: ["pd30", "pd90", "confidence", "reasonCodes"], additionalProperties: false,
          },
        },
      },
    });
    const content = response.choices?.[0]?.message?.content;
    const parsed = typeof content === "string" ? JSON.parse(content) as Partial<Decision> : {};
    const candidate = { ...baseline, pd30: Number(parsed.pd30 ?? baseline.pd30), pd90: Number(parsed.pd90 ?? baseline.pd90), confidence: Number(parsed.confidence ?? baseline.confidence), reasonCodes: (parsed.reasonCodes ?? baseline.reasonCodes) as ReasonCode[] };
    return { ...candidate, decisionHash: hashValue(candidate) };
  } catch {
    return baseline;
  }
}

export function isOfferAcceptable(state: string, status: Offer["status"]) {
  return state === "AwaitingAcceptance" && status === "Ready";
}

export function evaluateRiskGuard(decision: Decision, requestedAmount: number, collateralValue = 2800, poolLiquidity = 250_000): Offer {
  const ltv = requestedAmount / collateralValue;
  const apr = decision.riskTier === "A" ? 8.5 : decision.riskTier === "B" ? 11.5 : decision.riskTier === "C" ? 16.5 : 24;
  const checks = [
    requestedAmount > 0 && requestedAmount <= 2500,
    ltv <= 0.7,
    apr <= 24,
    decision.confidence >= 0.65,
    decision.freshnessScore >= 0.8,
    decision.pd30 <= 0.35,
    poolLiquidity >= requestedAmount,
  ];
  const blocked = checks.some(check => !check);
  return {
    amount: requestedAmount,
    apr,
    ltv: Number(ltv.toFixed(2)),
    termDays: 90,
    expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
    poolLiquidity,
    status: blocked ? "Blocked" : "Ready",
    rejectionReason: blocked ? "RiskGuard rejected terms outside amount, LTV, rate, freshness, confidence, or pool liquidity bounds." : undefined,
  };
}
