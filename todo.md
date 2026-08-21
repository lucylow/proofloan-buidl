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
- [x] Make Drizzle/database state the source of truth and persist audit events; application reads now prefer reconstructed Drizzle state with an explicit preview fallback when the database is unavailable
- [x] Add event-time fields to verified facts and compute wallet age plus 7/30/180-day windows from actual verified history
- [x] Implement explicit freshness enforcement inside RiskGuard and add tests for blocked stale evidence
- [x] Add Vitest cases for end-to-end state transitions and single-use offer acceptance / replay blocking
- [x] Visually verify the full happy path through the API-backed offer acceptance contract, rendered dashboard states, and inline UI error-state surfaces

## Verification corrections

- [ ] Refactor createApplication and acceptOffer so all state transitions are database-authoritative; keep the Map only for explicit preview-only mode
- [ ] Complete a successful browser verification pass through proof request, offer acceptance, Executed UI state, and inline proof/acceptance error states

## Mobile refinement

- [x] Improve narrow-screen navigation, hero sizing, and section spacing for ProofLoan
- [x] Make borrower intake controls and dashboard tabs touch-friendly and mobile-safe
- [x] Prevent horizontal overflow in state tracker, evidence cards, audit trail, and technical documentation
- [x] Validate mobile viewport rendering and preserve desktop layout behavior

## Mobile review corrections

- [x] Add a compact mobile navigation pattern for How it works, Evidence, and Docs
- [x] Make full transaction hashes truncate or wrap safely inside VerifiedFact cards

## Mobile refinement pass 2

- [x] Improve mobile header hierarchy and compact navigation affordances
- [x] Improve mobile form readability, input ergonomics, and loading/error feedback
- [x] Improve mobile dashboard card density, evidence readability, and decision actions
- [x] Revalidate narrow and desktop viewports after the second mobile pass

- [x] Add safe-area padding and reduced-motion handling for mobile navigation and page interactions

## Mobile refinement pass 3

- [x] Improve mobile loading, success, and error feedback around proof requests and offer acceptance
- [x] Improve mobile empty-state guidance and dashboard tab affordances, including explicit success states and a visible mobile swipe cue
- [x] Revalidate mobile and desktop rendering after the focused polish

## Mobile refinement pass 4

- [x] Improve mobile input behavior and keyboard-friendly form ergonomics
- [x] Improve mobile dashboard evidence and offer readability with clearer grouping
- [x] Improve touch feedback and responsive spacing in the mobile borrower flow
- [x] Revalidate narrow and desktop viewports after the fourth mobile pass

## Mobile refinement pass 5

- [x] Improve compact mobile controls and visual hierarchy in the borrower dashboard
- [x] Improve mobile evidence and audit content scanning without increasing overflow risk
- [x] Improve responsive spacing and interaction feedback for repeated mobile actions
- [x] Revalidate narrow and desktop viewports after the fifth mobile pass

## Mobile refinement pass 6

- [x] Improve mobile touch ergonomics for dashboard actions and repeated controls
- [x] Improve mobile decision and audit content hierarchy at narrow widths
- [x] Improve responsive spacing and focus visibility in the borrower flow
- [x] Revalidate narrow and desktop viewports after the sixth mobile pass

## Mobile refinement pass 7

- [x] Improve mobile borrower-dashboard section discoverability and scan order
- [x] Improve touch feedback for mobile navigation and dashboard interactions
- [x] Improve narrow-screen readability for compact evidence and decision summaries
- [x] Revalidate narrow and desktop viewports after the seventh mobile pass
