export const ATTESTCOIN_INTEGRATION_VERSION = "attestcoin-integration-v1.1.0" as const;

export type AttestcoinIntegrationMode = "LIVE" | "PREVIEW";

export type AttestcoinLifecycleStage =
  | "SOURCE_LOOKUP"
  | "WAITING_ATTESTATION"
  | "PROOF_BUILDING"
  | "CREDITCOIN_VERIFYING"
  | "VERIFIED"
  | "FAIL_CLOSED";

export type AttestcoinIntegrationStage = {
  stage: AttestcoinLifecycleStage;
  label: string;
  action: string;
  authority: string;
  failClosed: string;
};

export const ATTESTCOIN_INTEGRATION_STAGES: readonly AttestcoinIntegrationStage[] = [
  {
    stage: "SOURCE_LOOKUP",
    label: "Locate the source transaction",
    action: "ProofLoan resolves the submitted transaction on the selected source chain and requires a mined block.",
    authority: "Source-chain RPC",
    failClosed: "Unmined or unavailable source data never becomes evidence.",
  },
  {
    stage: "WAITING_ATTESTATION",
    label: "Wait for Attestcoin attestation",
    action: "The USC SDK waits until the source block is attested on the Creditcoin-side proof service.",
    authority: "Attestcoin Protocol",
    failClosed: "A missing or delayed attestation stops the live request.",
  },
  {
    stage: "PROOF_BUILDING",
    label: "Build the cryptographic proof",
    action: "ProofBuilder retrieves the transaction proof bundle for the requested source transaction.",
    authority: "@gluwa/usc-sdk ProofBuilder",
    failClosed: "An empty or unsuccessful proof response cannot produce VerifiedFact records.",
  },
  {
    stage: "CREDITCOIN_VERIFYING",
    label: "Verify at the Creditcoin boundary",
    action: "PrecompileBlockProver.verifySingle checks the proof against the Creditcoin testnet provider.",
    authority: "Creditcoin testnet verifier",
    failClosed: "A false verification result blocks underwriting and execution.",
  },
  {
    stage: "VERIFIED",
    label: "Admit typed evidence",
    action: "Only a successful result becomes a bounded VerifiedFact with source block, verification block, transaction hash, and proof root.",
    authority: "ProofLoan evidence contract",
    failClosed: "Typed evidence is the only input admitted to deterministic feature construction.",
  },
] as const;

export function getAttestcoinIntegrationSummary(mode: AttestcoinIntegrationMode) {
  return {
    version: ATTESTCOIN_INTEGRATION_VERSION,
    mode,
    headline: mode === "LIVE" ? "Live Attestcoin proof path" : "Preview adapter path",
    description: mode === "LIVE"
      ? "A mined source transaction is proven with the USC SDK and verified at the Creditcoin boundary before it can influence a loan decision."
      : "The labeled preview adapter preserves the same typed evidence contract without presenting mock history as a live Attestcoin proof.",
    stages: ATTESTCOIN_INTEGRATION_STAGES,
  } as const;
}

export function isAttestcoinLifecycleStage(value: unknown): value is AttestcoinLifecycleStage {
  return typeof value === "string" && ATTESTCOIN_INTEGRATION_STAGES.some(stage => stage.stage === value) || value === "FAIL_CLOSED";
}
