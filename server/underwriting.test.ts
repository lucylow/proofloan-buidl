import { describe, expect, it } from "vitest";
import { buildFeatureVector, buildVerifiedFacts, evaluateRiskGuard } from "./underwriting";
import { PROOFLOAN_STATES, REASON_CODES } from "@shared/proofloan";

describe("ProofLoan underwriting primitives", () => {
  it("returns typed facts from the Attestcoin proof worker boundary", () => {
    const facts = buildVerifiedFacts("0x71C7...9A2F", "Ethereum Sepolia");
    expect(facts).toHaveLength(3);
    expect(facts.every(fact => fact.proofWorker === "Attestcoin proof worker")).toBe(true);
    expect(facts[0]).toMatchObject({ chain: "Ethereum Sepolia", eventType: "REPAYMENT", freshness: "Fresh" });
    expect(facts[0]?.proofRoot).toMatch(/^0xproof_/);
  });

  it("builds a deterministic FeatureVector with fixed time windows", () => {
    const features = buildFeatureVector(buildVerifiedFacts("0x71C7...9A2F", "Polygon Amoy"));
    expect(features).toMatchObject({ repaymentCount: 2, latePayments: 0, walletAgeDays: 418, volume7d: 1250, volume30d: 2100, volume180d: 4900, evidenceCount: 3 });
    expect(features.leverageRatio).toBeGreaterThan(0);
    expect(features.freshnessScore).toBeLessThan(1);
  });

  it("keeps RiskGuard deterministic and rejects out-of-bounds terms", () => {
    const facts = buildVerifiedFacts("0x71C7...9A2F", "Ethereum Sepolia");
    const features = buildFeatureVector(facts);
    const decision = { pd30: 0.08, pd90: 0.16, confidence: 0.92, freshnessScore: 1, riskTier: "B" as const, reasonCodes: ["STRONG_REPAYMENT_HISTORY" as const], modelVersion: "test", featureVersion: "test", evidenceRoot: "root", policyHash: "policy", decisionHash: "decision" };
    expect(evaluateRiskGuard(decision, 1500).status).toBe("Ready");
    expect(evaluateRiskGuard(decision, 3000).status).toBe("Blocked");
    expect(evaluateRiskGuard({ ...decision, freshnessScore: 0.5 }, 1500).status).toBe("Blocked");
    expect(features.evidenceCount).toBe(3);
  });

  it("freezes the exact hackathon state and reason-code contracts", () => {
    expect(PROOFLOAN_STATES).toEqual(["Intake", "EvidencePending", "EvidenceVerified", "Scored", "OfferPrepared", "AwaitingAcceptance", "Executed", "Rejected"]);
    expect(REASON_CODES).toEqual(["STRONG_REPAYMENT_HISTORY", "RECENT_LATE_PAYMENT", "HIGH_LEVERAGE", "SPARSE_EVIDENCE"]);
  });
});
