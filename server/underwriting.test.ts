import { describe, expect, it } from "vitest";
import { buildFeatureVector, buildVerifiedFacts, canonicalEvidenceRoot, evaluateRiskGuard, fingerprintDecision, fingerprintFeatureVector, isFeatureVectorConsistentWithFacts, isFeatureVectorFiniteAndBounded, isOfferAcceptable, sanitizeAiCandidate } from "./underwriting";
import { EVIDENCE_ROOT_ALGORITHM, EVIDENCE_ROOT_SCHEMA_VERSION } from "@shared/proofloan";
import { PROOFLOAN_STATES, REASON_CODES } from "@shared/proofloan";

describe("ProofLoan underwriting primitives", () => {
  it("returns typed facts from the Attestcoin proof worker boundary", () => {
    const facts = buildVerifiedFacts("0x71C7...9A2F", "Ethereum Sepolia");
    expect(facts).toHaveLength(3);
    expect(facts.every(fact => fact.proofWorker === "Attestcoin proof worker")).toBe(true);
    expect(facts[0]).toMatchObject({ chain: "Ethereum Sepolia", eventType: "REPAYMENT", freshness: "Fresh" });
    expect(facts[0]?.proofRoot).toMatch(/^0xproof_/);
    expect(facts.every(fact => fact.verificationBlock >= fact.sourceBlock)).toBe(true);
    expect(facts.every(fact => fact.evidenceMode === "preview")).toBe(true);
    expect(buildVerifiedFacts("0x71C7...9A2F", "Polygon Amoy").every(fact => fact.verificationBlock >= fact.sourceBlock)).toBe(true);
  });

  it("builds a deterministic FeatureVector with fixed time windows", () => {
    const features = buildFeatureVector(buildVerifiedFacts("0x71C7...9A2F", "Polygon Amoy"));
    expect(features).toMatchObject({ repaymentCount: 2, latePayments: 0, walletAgeDays: 90, volume7d: 4050, volume30d: 4050, volume180d: 4900, evidenceCount: 3 });
    expect(features.leverageRatio).toBeGreaterThan(0);
    expect(features.freshnessScore).toBeLessThan(1);
  });

  it("canonicalizes evidence roots independently of fact ordering", () => {
    const facts = buildVerifiedFacts("0x71C7...9A2F", "Ethereum Sepolia");
    expect(canonicalEvidenceRoot(facts)).toMatch(/^[a-f0-9]{18}$/);
    expect(canonicalEvidenceRoot([...facts].reverse())).toBe(canonicalEvidenceRoot(facts));
    expect(canonicalEvidenceRoot(facts.map((fact, index) => index === 0 ? { ...fact, proofRoot: `${fact.proofRoot}-tampered` } : fact))).not.toBe(canonicalEvidenceRoot(facts));
  });

  it("binds evidence-root version metadata into the decision fingerprint", () => {
    const decision = { pd30: 0.12, pd90: 0.16, confidence: 0.8, freshnessScore: 0.9, riskTier: "B" as const, reasonCodes: ["SPARSE_EVIDENCE" as const], modelVersion: "model", featureVersion: "features", evidenceRoot: "root", policyHash: "policy", decisionHash: "ignored" };
    expect(fingerprintDecision(decision)).toBe(fingerprintDecision({ ...decision, evidenceRootVersion: EVIDENCE_ROOT_SCHEMA_VERSION, evidenceRootAlgorithm: EVIDENCE_ROOT_ALGORITHM }));
    expect(fingerprintDecision({ ...decision, evidenceRootAlgorithm: "sha256-future-v2" as never })).not.toBe(fingerprintDecision(decision));
  });

  it("fingerprints feature vectors canonically and detects drift", () => {
    const features = buildFeatureVector(buildVerifiedFacts("0x71C7...9A2F", "Ethereum Sepolia"), Date.parse("2026-08-24T20:00:00.000Z"));
    expect(fingerprintFeatureVector(features)).toMatch(/^[a-f0-9]{18}$/);
    expect(fingerprintFeatureVector({ ...features })).toBe(fingerprintFeatureVector(features));
    expect(fingerprintFeatureVector({ ...features, volume30d: features.volume30d + 1 })).not.toBe(fingerprintFeatureVector(features));
  });

  it("caps advisory confidence at the evidence freshness score", () => {
    const baseline = { pd30: 0.12, pd90: 0.16, confidence: 0.4, freshnessScore: 0.6, riskTier: "B" as const, reasonCodes: ["SPARSE_EVIDENCE" as const], featureVersion: "features-v1", modelVersion: "model-v1", policyHash: "policy-1", evidenceRoot: "evidence-1", decisionHash: "decision-1", featureFingerprint: "a".repeat(18) };
    expect(sanitizeAiCandidate({ confidence: 0.99 }, baseline).confidence).toBe(0.6);
  });

  it("accepts only feature vectors consistent with the same evidence and clock", () => {
    const facts = buildVerifiedFacts("0x71C7...9A2F", "Ethereum Sepolia");
    const nowMs = Date.parse("2026-08-24T20:00:00.000Z");
    const features = buildFeatureVector(facts, nowMs);
    expect(isFeatureVectorConsistentWithFacts(features, facts, nowMs)).toBe(true);
    expect(isFeatureVectorConsistentWithFacts({ ...features, volume30d: features.volume30d + 1 }, facts, nowMs)).toBe(false);
    expect(isFeatureVectorConsistentWithFacts(features, facts, nowMs + 86_400_000)).toBe(false);
    expect(isFeatureVectorConsistentWithFacts({ ...features, volume30d: { toJSON: () => features.volume30d } } as never, facts, nowMs)).toBe(false);
  });

  it("accepts finite bounded feature vectors and rejects malformed derivation output", () => {
    const valid = buildFeatureVector(buildVerifiedFacts("0x71C7...9A2F", "Ethereum Sepolia"));
    expect(isFeatureVectorFiniteAndBounded(valid)).toBe(true);
    expect(isFeatureVectorFiniteAndBounded({ ...valid, volume180d: Number.POSITIVE_INFINITY })).toBe(false);
    expect(isFeatureVectorFiniteAndBounded({ ...valid, evidenceCount: 65 })).toBe(false);
    expect(isFeatureVectorFiniteAndBounded({ ...valid, walletAgeDays: -1 })).toBe(false);
  });

  it("sanitizes malformed AI advisory output before policy evaluation", () => {
    const baseline = { pd30: 0.12, pd90: 0.2, confidence: 0.8, freshnessScore: 0.9, riskTier: "B" as const, reasonCodes: ["SPARSE_EVIDENCE"] as const, modelVersion: "test", featureVersion: "test", evidenceRoot: "root", policyHash: "policy", decisionHash: "decision" };
    const sanitized = sanitizeAiCandidate({ pd30: Number.NaN, pd90: -4, confidence: 9, reasonCodes: ["HIGH_LEVERAGE", "UNTRUSTED_CODE"] as never[] }, baseline);
    expect(sanitized.pd30).toBe(baseline.pd30);
    expect(sanitized.pd90).toBe(baseline.pd30);
    expect(sanitized.confidence).toBe(0.9);
    expect(sanitized.reasonCodes).toEqual(["HIGH_LEVERAGE"]);
    expect(Number.isFinite(sanitized.pd30)).toBe(true);
  });

  it("keeps RiskGuard deterministic and rejects out-of-bounds terms", () => {
    const facts = buildVerifiedFacts("0x71C7...9A2F", "Ethereum Sepolia");
    const features = buildFeatureVector(facts);
    const decision = { pd30: 0.12, pd90: 0.16, confidence: 0.92, freshnessScore: 1, riskTier: "B" as const, reasonCodes: ["STRONG_REPAYMENT_HISTORY" as const], modelVersion: "test", featureVersion: "test", evidenceRoot: "root", policyHash: "policy", decisionHash: "decision" };
    expect(evaluateRiskGuard(decision, 1500).status).toBe("Ready");
    expect(evaluateRiskGuard(decision, 3000).status).toBe("Blocked");
    expect(evaluateRiskGuard({ ...decision, freshnessScore: 0.5 }, 1500).status).toBe("Blocked");
    expect(features.evidenceCount).toBe(3);
  });

  it("blocks replay after the offer transitions to Executed", () => {
    expect(isOfferAcceptable("AwaitingAcceptance", "Ready")).toBe(true);
    expect(isOfferAcceptable("Executed", "Executed")).toBe(false);
    expect(isOfferAcceptable("AwaitingAcceptance", "Executed")).toBe(false);
  });

  it("freezes the exact hackathon state and reason-code contracts", () => {
    expect(PROOFLOAN_STATES).toEqual(["Intake", "EvidencePending", "EvidenceVerified", "Scored", "OfferPrepared", "AwaitingAcceptance", "Executed", "Rejected"]);
    expect(REASON_CODES).toEqual(["STRONG_REPAYMENT_HISTORY", "RECENT_LATE_PAYMENT", "HIGH_LEVERAGE", "SPARSE_EVIDENCE"]);
  });
});
