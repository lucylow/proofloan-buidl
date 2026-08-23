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

- [x] Replace hardcoded preview facts in the default borrower flow with a live Attestcoin Protocol USC SDK proof request
- [x] Make Drizzle/database state the source of truth and persist audit events; application reads now prefer reconstructed Drizzle state with an explicit preview fallback when the database is unavailable
- [x] Add event-time fields to verified facts and compute wallet age plus 7/30/180-day windows from actual verified history
- [x] Implement explicit freshness enforcement inside RiskGuard and add tests for blocked stale evidence
- [x] Add Vitest cases for end-to-end state transitions and single-use offer acceptance / replay blocking
- [x] Visually verify the full happy path through the API-backed offer acceptance contract, rendered dashboard states, and inline UI error-state surfaces

## Verification corrections

- [x] Refactor createApplication and acceptOffer so all state transitions are database-authoritative; keep the Map only for explicit preview-only mode
- [x] Complete a successful browser verification pass through proof request, offer acceptance, Executed UI state, and inline proof/acceptance error states

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

## Mobile refinement pass 8

- [x] Improve mobile section navigation affordances and active context
- [x] Improve dashboard tab interaction clarity and touch feedback
- [x] Improve narrow-screen text wrapping in decision and audit surfaces
- [x] Revalidate narrow and desktop viewports after the eighth mobile pass

## Mobile refinement pass 9

- [x] Improve mobile navigation state visibility after section jumps
- [x] Improve dashboard action feedback and compact status readability
- [x] Improve narrow-screen spacing around mobile section controls
- [x] Revalidate narrow and desktop viewports after the ninth mobile pass

- [x] Add explicit mobile section-rail spacing, snap behavior, and edge-safe padding; revalidate at narrow width

## Mobile refinement pass 10

- [x] Improve mobile navigation label clarity and active-state accessibility
- [x] Improve touch-safe dashboard tab and status affordances
- [x] Improve narrow-screen accessibility cues without adding visual clutter
- [x] Revalidate narrow and desktop viewports after the tenth mobile pass

- [x] Link the mobile swipe hint to the credit-file tabs with aria-describedby and revalidate responsive behavior

## Mobile refinement pass 11

- [x] Improve compact dashboard navigation clarity and current-view feedback
- [x] Improve mobile state tracker and status announcement readability
- [x] Improve touch-safe spacing around repeated dashboard controls
- [x] Revalidate narrow and desktop viewports after the eleventh mobile pass

- [x] Improve the mobile state tracker rail spacing, labels, and step hit-area readability; revalidate at 390px
- [x] Add explicit spacing refinements for repeated dashboard controls and revalidate narrow plus desktop screenshots

- [x] Add concrete CSS spacing for mobile dashboard tabs, copy action, and acceptance CTA; revalidate narrow and desktop screenshots

- [x] Add a dedicated mobile spacing rule for the acceptance CTA and revalidate narrow plus desktop screenshots

## Mobile refinement pass 12

- [x] Improve mobile dashboard density and section separation
- [x] Improve mobile state and decision summary clarity
- [x] Improve accessibility cues for compact mobile evidence surfaces
- [x] Revalidate narrow and desktop viewports after the twelfth mobile pass

- [x] Add concrete mobile layout CSS for dashboard density and section separation; revalidate 390px and desktop
- [x] Add a visible structural refinement for the state rail and decision summary; rerun screenshots
- [x] Add explicit accessibility semantics and cues to VerifiedFact evidence cards; verify wiring

- [x] Add concrete mobile CSS for fact cards, decision metrics, and reason-code grouping; rerun 390px and desktop screenshots
- [x] Add a new visible mobile state-rail refinement beyond the existing labels and markers; rerun screenshots

## Mobile refinement pass 13

- [x] Improve mobile evidence scanning with clearer fact metadata grouping
- [x] Improve mobile decision-action hierarchy and offer status visibility
- [x] Improve accessibility cues for mobile action and evidence regions
- [x] Revalidate narrow and desktop viewports after the thirteenth mobile pass

- [x] Add concrete mobile CSS/layout for VerifiedFact metadata grouping; rerun 390px and desktop validation
- [x] Add concrete mobile offer-panel CSS and explicit visible offer-status treatment; rerun 390px and desktop validation

- [x] Make live state transitions truly database-authoritative with explicit DB-backed transition writes/read-backs and eliminate duplicate decision rows
- [x] Exercise proof-request and acceptance failure paths in the browser and confirm inline error alerts render

- [x] Refactor live createApplication and acceptOffer so each state change uses explicit conditional database transitions and read-backs

## Mobile refinement pass 14

- [x] Improve the next highest-impact narrow-screen borrower interaction and revalidate responsive behavior

## Mobile refinement pass 15

- [x] Improve narrow-screen borrower-dashboard context and scan order while preserving touch-safe tabs

## Code improvement pass

- [x] Improve the highest-impact reliability or maintainability issue found during code inspection and revalidate the project

## Code improvement pass 2

- [x] Improve the next highest-impact reliability or maintainability issue and add targeted validation

## Code improvement pass 3

- [x] Improve the next highest-impact reliability or maintainability issue and add targeted validation

- [x] Add targeted Vitest coverage for persisted snapshot reconstruction failing closed on invalid state, source chain, and malformed reason codes
- [x] Validate persisted event type, freshness, risk tier, offer status, and audit state instead of unchecked casts

- [x] Exercise the persisted snapshot reconstruction validation boundary directly for invalid application state, source chain, and malformed reason-code JSON

## Code improvement pass 4

- [x] Improve the next highest-impact reliability or maintainability issue and add targeted validation

## Code improvement pass 5

- [x] Improve the next highest-impact reliability or maintainability issue and add targeted validation

## Code improvement pass 6

- [x] Improve the next highest-impact reliability or maintainability issue and add targeted validation

## Code improvement pass 7

- [x] Improve the next highest-impact reliability or maintainability issue and add targeted validation

## Code improvement pass 8

- [x] Improve the next highest-impact reliability or maintainability issue and add targeted validation

- [x] Add targeted Vitest coverage for transactional snapshot persistence failure and rollback behavior
- [x] Add targeted audit-upsert coverage for synchronized label, state, detail, and timestamp fields

- [x] Add a mid-bundle transaction test where early application writes succeed and a later audit write fails, proving no partial success is reported

## Mobile error-handling hardening

- [x] Fix active mobile-flow errors and add resilient, readable handling for proof, persistence, and acceptance failures

- [x] Reproduce a concrete mobile-flow failure and document the specific fix
- [x] Exercise proof-request, dashboard refresh, and acceptance failure notices plus retry actions at 390px
- [x] Add targeted frontend coverage for mobile error-code stripping and retry visibility

- [x] Fix live transition error classification so database unavailability renders a database error instead of a misleading state-conflict error

- [x] Exercise an actual borrower-dashboard query or refresh failure in-browser at 390px and confirm mobile recovery behavior
- [x] Add frontend-level coverage for mobile error-code stripping and conditional retry visibility

- [x] Add a development-only dashboard query-failure hook and verify the mobile notice plus recovery path in-browser at 390px

## Mobile error-handling hardening pass 2

- [x] Fix the next active mobile error and strengthen borrower-flow recovery handling with targeted validation

- [x] Add differentiated mobile recovery guidance and actions for proof-worker, database, validation, policy, and state-conflict errors
- [x] Add targeted frontend coverage for differentiated mobile recovery guidance and action visibility

## Mobile error-handling hardening pass 3

- [x] Fix the next reported mobile-flow errors and add stronger recovery handling with targeted validation
- [x] Inspect and harden mobile proof-request, dashboard refresh, acceptance, and unexpected-runtime error surfaces
- [x] Add or update Vitest coverage for the new mobile recovery behavior
- [x] Revalidate 390px and desktop rendering plus production build

## Mobile error-handling hardening pass 4

- [x] Fix the next concrete mobile-flow failure and add resilient recovery handling
- [x] Harden offline, unexpected-runtime, and repeated-action behavior without hiding real failures
- [x] Add targeted tests for the new mobile recovery behavior
- [x] Revalidate 390px and desktop rendering plus the exact production build

## Mobile error-handling hardening pass 5

- [x] Fix the next concrete mobile-flow failure and add resilient recovery handling
- [x] Harden stale-query and recovery-state behavior without hiding real failures
- [x] Add targeted tests for the new mobile recovery behavior
- [x] Revalidate 390px and desktop rendering plus the exact production build

## Mobile error-handling hardening pass 6

- [x] Fix the next concrete mobile-flow failure and add resilient recovery handling
- [x] Harden recovery messaging, stale-state transitions, and user action feedback
- [x] Add targeted tests for the new mobile recovery behavior
- [x] Revalidate 390px and desktop rendering plus the exact production build

## Mobile error-handling hardening pass 7

- [x] Fix the next concrete mobile-flow failure and add resilient recovery handling
- [x] Harden mobile credit-file loading-state feedback without misrepresenting empty or failed states
- [x] Add targeted tests for the new mobile credit-file view-state behavior
- [x] Revalidate 390px and desktop rendering plus the exact production build

## Code improvement pass 9

- [x] Improve the highest-impact reliability or maintainability issue found during inspection
- [x] Add targeted validation for the improvement
- [x] Revalidate typecheck, tests, production build, and responsive rendering

## Code improvement pass 10

- [x] Improve the highest-impact reliability or maintainability issue found during inspection
- [x] Add targeted validation for the improvement
- [x] Revalidate typecheck, tests, production build, and responsive rendering

## Code improvement pass 11

- [x] Improve the highest-impact reliability or maintainability issue found during inspection
- [x] Add targeted validation for the improvement
- [x] Revalidate typecheck, tests, production build, and responsive rendering

## Code improvement pass 12

- [x] Improve the highest-impact reliability or maintainability issue found during inspection
- [x] Add targeted validation for the improvement
- [x] Revalidate typecheck, tests, production build, and responsive rendering

## Code improvement pass 13

- [x] Improve the highest-impact reliability or maintainability issue found during inspection
- [x] Add targeted validation for the improvement
- [x] Revalidate typecheck, tests, production build, and responsive rendering

## Code improvement pass 14

- [x] Improve the highest-impact reliability or maintainability issue found during inspection
- [x] Add targeted validation for the improvement
- [x] Revalidate typecheck, tests, production build, and responsive rendering

## Code improvement pass 15

- [x] Improve the highest-impact reliability or maintainability issue found during inspection
- [x] Add targeted validation for the improvement
- [x] Revalidate typecheck, tests, production build, and responsive rendering

## Code improvement pass 16

- [x] Improve the highest-impact reliability or maintainability issue found during inspection
- [x] Add targeted validation for the improvement
- [x] Revalidate typecheck, tests, production build, and responsive rendering

## Code improvement pass 17

- [x] Improve the highest-impact reliability or maintainability issue found during inspection
- [x] Add targeted validation for the improvement
- [x] Revalidate typecheck, tests, production build, and responsive rendering

## Code improvement pass 18

- [x] Improve the highest-impact reliability or maintainability issue found during inspection
- [x] Add targeted validation for the improvement
- [x] Revalidate typecheck, tests, production build, and responsive rendering

## Code improvement pass 19

- [x] Improve the highest-impact reliability or maintainability issue found during inspection
- [x] Add targeted validation for the improvement
- [x] Revalidate typecheck, tests, production build, and responsive rendering

## Code improvement pass 20

- [x] Improve the highest-impact reliability or maintainability issue found during inspection
- [x] Add targeted validation for the improvement
- [x] Revalidate typecheck, tests, production build, and responsive rendering

## Code improvement pass 21

- [x] Improve the highest-impact reliability or maintainability issue found during inspection
- [x] Add targeted validation for the improvement
- [x] Revalidate typecheck, tests, production build, and responsive rendering

## Code improvement pass 22

- [x] Improve the highest-impact reliability or maintainability issue found during inspection
- [x] Add targeted validation for the improvement
- [x] Revalidate typecheck, tests, production build, and responsive rendering

## Code improvement pass 23
- [x] Improve the highest-impact reliability or maintainability issue found during inspection
- [x] Add targeted validation for the improvement
- [x] Revalidate typecheck, tests, production build, and responsive rendering

## Code improvement pass 24
- [x] Identify and fix the next high-impact reliability or maintainability issue
- [x] Add targeted validation for the improvement
- [x] Revalidate typecheck, tests, production build, and responsive rendering

## Code improvement pass 25
- [x] Identify and fix the next high-impact reliability or maintainability issue
- [x] Add targeted validation for the improvement
- [x] Revalidate typecheck, tests, production build, and responsive rendering

## Code improvement pass 26
- [x] Identify and fix the next high-impact reliability or maintainability issue
- [x] Add targeted validation for the improvement
- [x] Revalidate typecheck, tests, production build, and responsive rendering

## Code improvement pass 27
- [x] Identify and fix the next high-impact reliability or maintainability issue
- [x] Add targeted validation for the improvement
- [x] Revalidate typecheck, tests, production build, and responsive rendering

## Code improvement pass 28
- [x] Identify and fix the next high-impact reliability or maintainability issue
- [x] Add targeted validation for the improvement
- [x] Revalidate typecheck, tests, production build, and responsive rendering

## Code improvement pass 29
- [x] Identify and fix the next high-impact reliability or maintainability issue
- [x] Add targeted validation for the improvement
- [x] Revalidate typecheck, tests, production build, and responsive rendering

## Code improvement pass 30
- [x] Identify and fix the next high-impact reliability or maintainability issue
- [x] Add targeted validation for the improvement
- [x] Revalidate typecheck, tests, production build, and responsive rendering

## Code improvement pass 31
- [x] Identify and fix the next high-impact reliability or maintainability issue
- [x] Add targeted validation for the improvement
- [x] Revalidate typecheck, tests, production build, and responsive rendering

## Code improvement pass 32
- [x] Identify and fix the next high-impact reliability or maintainability issue
- [x] Add targeted validation for the improvement
- [x] Revalidate typecheck, tests, production build, and responsive rendering

## Code improvement pass 33
- [x] Identify and fix the next high-impact reliability or maintainability issue
- [x] Add targeted validation for the improvement
- [x] Revalidate typecheck, tests, production build, and responsive rendering

## Code improvement pass 34
- [x] Identify and fix the next high-impact reliability or maintainability issue
- [x] Add targeted validation for the improvement
- [x] Revalidate typecheck, tests, production build, and responsive rendering

## Code improvement pass 35
- [x] Identify and fix the next high-impact reliability or maintainability issue
- [x] Add targeted validation for the improvement
- [x] Revalidate typecheck, tests, production build, and responsive rendering

## Code improvement pass 36
- [x] Identify and fix the next high-impact reliability or maintainability issue
- [x] Add targeted validation for the improvement
- [x] Revalidate typecheck, tests, production build, and responsive rendering

## Code improvement pass 37
- [x] Identify and fix the next high-impact reliability or maintainability issue
- [x] Add targeted validation for the improvement
- [x] Revalidate typecheck, tests, production build, and responsive rendering

## Code improvement pass 38
- [x] Identify and fix the next high-impact reliability or maintainability issue
- [x] Add targeted validation for the improvement
- [x] Revalidate typecheck, tests, production build, and responsive rendering

## Code improvement pass 39
- [x] Identify and fix the next high-impact reliability or maintainability issue
- [x] Add targeted validation for the improvement
- [x] Revalidate typecheck, tests, production build, and responsive rendering

## Code improvement pass 40
- [x] Identify and fix the next high-impact reliability or maintainability issue
- [x] Add targeted validation for the improvement
- [x] Revalidate typecheck, tests, production build, and responsive rendering

## Code improvement pass 41
- [x] Identify and fix the next high-impact reliability or maintainability issue
- [x] Add targeted validation for the improvement
- [x] Revalidate typecheck, tests, production build, and responsive rendering

## Code improvement pass 42
- [x] Identify and fix the next high-impact reliability or maintainability issue
- [x] Add targeted validation for the improvement
- [x] Revalidate typecheck, tests, production build, and responsive rendering

## Code improvement pass 43
- [x] Identify and fix the next high-impact reliability or maintainability issue
- [x] Add targeted validation for the improvement
- [x] Revalidate typecheck, tests, production build, and responsive rendering

## Code improvement pass 44
- [x] Identify and fix the next high-impact reliability or maintainability issue
- [x] Add targeted validation for the improvement
- [x] Revalidate typecheck, tests, production build, and responsive rendering

## Code improvement pass 45
- [x] Identify and fix the next high-impact reliability or maintainability issue
- [x] Add targeted validation for the improvement
- [x] Revalidate typecheck, tests, production build, and responsive rendering

## Code improvement pass 46
- [x] Identify and fix the next high-impact reliability or maintainability issue
- [x] Add targeted validation for the improvement
- [x] Revalidate typecheck, tests, production build, and responsive rendering

## Code improvement pass 47
- [x] Identify and fix the next high-impact reliability or maintainability issue
- [x] Add targeted validation for the improvement
- [x] Revalidate typecheck, tests, production build, and responsive rendering

## Code improvement pass 48
- [x] Identify and fix the next high-impact reliability or maintainability issue
- [x] Add targeted validation for the improvement
- [x] Revalidate typecheck, tests, production build, and responsive rendering

## Code improvement pass 49
- [x] Reject malformed or oversized audit details before database writes
- [x] Add focused write-boundary coverage
- [x] Revalidate typecheck, tests, production build, and responsive rendering

## Code improvement pass 50
- [x] Identify and fix the next high-impact reliability or abuse-resistance issue
- [x] Add focused coverage for the improvement
- [x] Revalidate typecheck, tests, production build, and responsive rendering

## Code improvement pass 51
- [x] Identify and fix the next high-impact reliability or abuse-resistance issue
- [x] Add focused coverage for the improvement
- [x] Revalidate typecheck, tests, production build, and responsive rendering

## Code improvement pass 52
- [x] Identify and fix the next high-impact reliability or abuse-resistance issue
- [x] Add focused coverage for the improvement
- [x] Revalidate typecheck, tests, production build, and responsive rendering

## Code improvement pass 53
- [x] Identify and fix the next high-impact reliability or abuse-resistance issue
- [x] Add focused coverage for the improvement
- [x] Revalidate typecheck, tests, production build, and responsive rendering

## Code improvement pass 54
- [x] Identify and fix the next high-impact reliability or abuse-resistance issue
- [x] Add focused coverage for the improvement
- [x] Revalidate typecheck, tests, production build, and responsive rendering

## Code improvement pass 55
- [x] Identify and fix the next high-impact reliability or abuse-resistance issue
- [x] Add focused coverage for the improvement
- [x] Revalidate typecheck, tests, production build, and responsive rendering

## Code improvement pass 56
- [x] Identify and fix the next high-impact reliability or abuse-resistance issue
- [x] Add focused coverage for the improvement
- [x] Revalidate typecheck, tests, production build, and responsive rendering

## Code improvement pass 57
- [x] Identify and fix the next high-impact reliability or abuse-resistance issue
- [x] Add focused coverage for the improvement
- [x] Revalidate typecheck, tests, production build, and responsive rendering

## Code improvement pass 58
- [x] Identify and fix the next high-impact reliability or abuse-resistance issue
- [x] Add focused coverage for the improvement
- [x] Revalidate typecheck, tests, production build, and responsive rendering

## Code improvement pass 59
- [x] Identify and fix the next high-impact reliability or abuse-resistance issue
- [x] Add focused coverage for the improvement
- [x] Revalidate typecheck, tests, production build, and responsive rendering

## Code improvement pass 60
- [x] Identify and fix the next high-impact reliability or abuse-resistance issue
- [x] Add focused coverage for the improvement
- [x] Revalidate typecheck, tests, production build, and responsive rendering

## Code improvement pass 61
- [x] Identify and fix the next high-impact reliability or abuse-resistance issue
- [x] Add focused coverage for the improvement
- [x] Revalidate typecheck, tests, production build, and responsive rendering

## Code improvement pass 62
- [x] Identify and fix the next high-impact reliability or abuse-resistance issue
- [x] Add focused coverage for the improvement
- [x] Revalidate typecheck, tests, production build, and responsive rendering

## Code improvement pass 63
- [x] Identify and fix the next high-impact reliability or abuse-resistance issue
- [x] Add focused coverage for the improvement
- [x] Revalidate typecheck, tests, production build, and responsive rendering

## Code improvement pass 64
- [x] Identify and fix the next high-impact reliability or abuse-resistance issue
- [x] Add focused coverage for the improvement
- [x] Revalidate typecheck, tests, production build, and responsive rendering

## Code improvement pass 65
- [x] Identify and fix the next high-impact reliability or abuse-resistance issue
- [x] Add focused coverage for the improvement
- [x] Revalidate typecheck, tests, production build, and responsive rendering

## Code improvement pass 66
- [x] Identify and fix the next high-impact reliability or abuse-resistance issue
- [x] Add focused coverage for the improvement
- [x] Revalidate typecheck, tests, production build, and responsive rendering

