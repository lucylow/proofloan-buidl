# Project TODO

- [x] Establish the ProofLoan dark fintech / Creditcoin visual system and landing page
- [x] Build the borrower dashboard with wallet address, source-chain selection, and proof request controls
- [x] Implement the Attestcoin Protocol USC SDK integration boundary and Attestcoin proof worker adapter
- [x] Define and persist loan applications, verified facts, decisions, and offers with audit fields
- [x] Render VerifiedFact evidence with provenance, verification block, and freshness status
- [x] Implement typed FeatureVector construction for repayment count, late payments, leverage, wallet age, and 7/30/180-day windows
- [x] Implement server-side AI underwriting output with calibrated PD, confidence, and exact reason codes
- [x] Implement deterministic RiskGuard checks for amount, LTV, rate, freshness, confidence, and pool liquidity
- [x] Build the exact ProofLoan state machine tracker: Intake, EvidencePending, EvidenceVerified, Scored, OfferPrepared, AwaitingAcceptance, Executed, Rejected
- [x] Implement offer detail, borrower acceptance, and simulated Creditcoin testnet transaction submission
- [x] Build the evidence-to-execution audit trail and hash-linked provenance view
- [x] Add in-app technical documentation, architecture diagram, Attestcoin Protocol integration summary, and hackathon metadata
- [x] Add Vitest coverage for proof validation, FeatureVector construction, RiskGuard policy decisions, state transitions, and acceptance uniqueness
- [x] Run typecheck, tests, build, and visual verification; fix surfaced issues
- [x] Add README content for setup, architecture, Attestcoin integration, demo flow, and submission requirements

## Hardening follow-ups

- [ ] Replace hardcoded preview facts in the default borrower flow with a live Attestcoin Protocol USC SDK proof request
- [ ] Make Drizzle/database state the source of truth and persist audit events; current snapshot persistence is wired but the preview still reads from an in-memory Map
- [x] Add event-time fields to verified facts and compute wallet age plus 7/30/180-day windows from actual verified history
- [x] Implement explicit freshness enforcement inside RiskGuard and add tests for blocked stale evidence
- [x] Add Vitest cases for end-to-end state transitions and single-use offer acceptance / replay blocking
- [ ] Visually verify the full happy path through offer acceptance plus UI error states
