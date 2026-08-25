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

## Code improvement pass 67
- [x] Identify and fix the next high-impact reliability or abuse-resistance issue
- [x] Add focused coverage for the improvement
- [x] Revalidate typecheck, tests, production build, and responsive rendering

## Code improvement pass 68
- [x] Identify and fix the next high-impact reliability or abuse-resistance issue
- [x] Add focused coverage for the improvement
- [x] Revalidate typecheck, tests, production build, and responsive rendering

## Code improvement pass 69
- [x] Identify and fix the next high-impact reliability or abuse-resistance issue
- [x] Add focused coverage for the improvement
- [x] Revalidate typecheck, tests, production build, and responsive rendering

## Code improvement pass 70
- [x] Identify and fix the next high-impact reliability or abuse-resistance issue
- [x] Add focused coverage for the improvement
- [x] Revalidate typecheck, tests, production build, and responsive rendering

## Code improvement pass 71
- [x] Identify and fix the next high-impact reliability or abuse-resistance issue
- [x] Add focused coverage for the improvement
- [x] Revalidate typecheck, tests, production build, and responsive rendering

## Code improvement pass 72
- [x] Identify and fix the next high-impact reliability or abuse-resistance issue
- [x] Add focused coverage for the improvement
- [x] Revalidate typecheck, tests, production build, and responsive rendering

## Code improvement pass 73
- [x] Identify and fix the next high-impact reliability or abuse-resistance issue
- [x] Add focused coverage for the improvement
- [x] Revalidate typecheck, tests, production build, and responsive rendering

## Code improvement pass 74
- [x] Identify and fix the next high-impact reliability or abuse-resistance issue
- [x] Add focused coverage for the improvement
- [x] Revalidate typecheck, tests, production build, and responsive rendering

## Code improvement pass 75
- [x] Identify and fix the next high-impact reliability or abuse-resistance issue
- [x] Add focused coverage for the improvement
- [x] Revalidate typecheck, tests, production build, and responsive rendering

## Code improvement pass 76
- [x] Identify and fix the next high-impact reliability or abuse-resistance issue
- [x] Add focused coverage for the improvement
- [x] Revalidate typecheck, tests, production build, and responsive rendering

## Code improvement pass 77
- [x] Identify and fix the next high-impact reliability or abuse-resistance issue
- [x] Add focused coverage for the improvement
- [x] Revalidate typecheck, tests, production build, and responsive rendering

## Code improvement pass 78
- [x] Identify and fix the next high-impact reliability or abuse-resistance issue
- [x] Add focused coverage for the improvement
- [x] Revalidate typecheck, tests, production build, and responsive rendering

## Code improvement pass 79
- [x] Identify and fix the next high-impact reliability or abuse-resistance issue
- [x] Add focused coverage for the improvement
- [x] Revalidate typecheck, tests, production build, and responsive rendering

## Code improvement pass 80
- [x] Identify and fix the next high-impact reliability or abuse-resistance issue
- [x] Add focused coverage for the improvement
- [x] Revalidate typecheck, tests, production build, and responsive rendering

## Code improvement pass 81
- [x] Identify and fix the next high-impact reliability or abuse-resistance issue
- [x] Add focused coverage for the improvement
- [x] Revalidate typecheck, tests, production build, and responsive rendering

## Code improvement pass 82
- [x] Identify and fix the next high-impact reliability or abuse-resistance issue
- [x] Add focused coverage for the improvement
- [x] Revalidate typecheck, tests, production build, and responsive rendering

## Code improvement pass 83
- [x] Identify and fix the next high-impact reliability or abuse-resistance issue
- [x] Add focused coverage for the improvement
- [x] Revalidate typecheck, tests, production build, and responsive rendering

## Code improvement pass 84
- [x] Identify and fix the next high-impact reliability or abuse-resistance issue
- [x] Add focused coverage for the improvement
- [x] Revalidate typecheck, tests, production build, and responsive rendering

## Code improvement pass 85
- [x] Identify and fix the next high-impact reliability or abuse-resistance issue
- [x] Add focused coverage for the improvement
- [x] Revalidate typecheck, tests, production build, and responsive rendering

## Code improvement pass 86
- [x] Identify and fix the next high-impact reliability or abuse-resistance issue
- [x] Add focused coverage for the improvement
- [x] Revalidate typecheck, tests, production build, and responsive rendering

## Code improvement pass 87
- [x] Identify and fix the next high-impact reliability or abuse-resistance issue
- [x] Add focused coverage for the improvement
- [x] Revalidate typecheck, tests, production build, and responsive rendering

## Code improvement pass 88
- [x] Identify and fix the next high-impact reliability or abuse-resistance issue
- [x] Add focused coverage for the improvement
- [x] Revalidate typecheck, tests, production build, and responsive rendering

## Code improvement pass 89
- [x] Identify and fix the next high-impact reliability or abuse-resistance issue
- [x] Add focused coverage for the improvement
- [x] Revalidate typecheck, tests, production build, and responsive rendering

## Code improvement pass 90
- [x] Identify and fix the next high-impact reliability or abuse-resistance issue
- [x] Add focused coverage for the improvement
- [x] Revalidate typecheck, tests, production build, and responsive rendering

## Code improvement pass 91
- [x] Identify and fix the next high-impact reliability or abuse-resistance issue
- [x] Add focused coverage for the improvement
- [x] Revalidate typecheck, tests, production build, and responsive rendering

## Code improvement pass 92
- [x] Identify and fix the next high-impact reliability or abuse-resistance issue
- [x] Add focused coverage for the improvement
- [x] Revalidate typecheck, tests, production build, and responsive rendering

## Code improvement pass 93
- [x] Identify and fix the next high-impact reliability or abuse-resistance issue
- [x] Add focused coverage for the improvement
- [x] Revalidate typecheck, tests, production build, and responsive rendering

## Code improvement pass 94
- [x] Identify and fix the next high-impact reliability or abuse-resistance issue
- [x] Add focused coverage for the improvement
- [x] Revalidate typecheck, tests, production build, and responsive rendering

## Code improvement pass 95
- [x] Identify and fix the next high-impact reliability or abuse-resistance issue
- [x] Add focused coverage for the improvement
- [x] Revalidate typecheck, tests, production build, and responsive rendering

## Code improvement pass 96
- [x] Identify and fix the next high-impact reliability or abuse-resistance issue
- [x] Add focused coverage for the improvement
- [x] Revalidate typecheck, tests, production build, and responsive rendering

## Code improvement pass 97
- [x] Identify and fix the next high-impact reliability or abuse-resistance issue
- [x] Add focused coverage for the improvement
- [x] Revalidate typecheck, tests, production build, and responsive rendering


## Code improvement pass 98
- [x] Identify and fix the next high-impact reliability or abuse-resistance issue
- [x] Add focused coverage for the improvement
- [x] Revalidate typecheck, tests, production build, and responsive rendering

## Code improvement pass 99
- [x] Identify and fix the next high-impact reliability or abuse-resistance issue
- [x] Add focused coverage for the improvement
- [x] Revalidate typecheck, tests, production build, and responsive rendering

## Code improvement pass 100
- [x] Add durable idempotency storage for acceptance retries across server instances
- [x] Add focused schema, persistence, and router coverage
- [x] Revalidate migrations, typecheck, tests, production build, and responsive rendering

## Code improvement pass 101
- [x] Add durable idempotency storage for live proof-request creation
- [x] Add focused persistence, router, and client retry coverage
- [x] Revalidate migration, typecheck, tests, production build, and responsive rendering

## Code improvement pass 102
- [x] Add bounded retention handling for durable replay-protection records
- [x] Harden stale proof-request and acceptance claim recovery
- [x] Add focused coverage and revalidate the full project

## Code improvement pass 103
- [x] Add privacy-safe structured events for replay-protection outcomes
- [x] Instrument claim, replay, conflict, cleanup, and stale-recovery branches
- [x] Add focused tests and revalidate the full project

## Code improvement pass 104
- [x] Classify replay storage failures separately from request conflicts
- [x] Preserve fail-closed execution and diagnostic behavior
- [x] Add focused tests and revalidate the full project

## Code improvement pass 105
- [x] Classify proof-request replay storage failures separately from conflicts
- [x] Preserve fail-closed proof-request recovery behavior
- [x] Add focused tests and revalidate the full project

## Code improvement pass 106
- [x] Verify affected-row counts for durable acceptance and proof-request commits
- [x] Fail closed when the intended replay record was not updated
- [x] Add focused tests and revalidate the full project

## Code improvement pass 107
- [x] Add direct mocked-database coverage for durable acceptance commits
- [x] Add direct mocked-database coverage for durable proof-request commits
- [x] Revalidate the full project and responsive rendering

## Code improvement pass 108
- [x] Add direct mocked-database tests for acceptance replay commits
- [x] Add direct mocked-database tests for proof-request replay commits
- [x] Revalidate the full project and responsive rendering

## Code improvement pass 109
- [x] Add direct exception-path tests for acceptance replay commits
- [x] Add direct exception-path tests for proof-request replay commits
- [x] Verify privacy-safe failure diagnostics and revalidate the full project

## Code improvement pass 110
- [x] Harden stale pending acceptance and proof-request claim recovery
- [x] Preserve exactly-once behavior during recovery races
- [x] Add focused tests and revalidate the full project

## Code improvement pass 111
- [x] Add deterministic tests for stale acceptance recovery races
- [x] Add deterministic tests for stale proof-request recovery races
- [x] Revalidate the full project and responsive rendering

## Code improvement pass 112
- [x] Add database-exception tests for stale acceptance recovery
- [x] Add database-exception tests for stale proof-request recovery
- [x] Verify privacy-safe failure diagnostics and revalidate the full project

## Code improvement pass 113
- [x] Classify missing acceptance replay records explicitly
- [x] Preserve fail-closed missing proof-request record behavior
- [x] Add focused tests and revalidate the full project

## Code improvement pass 114
- [x] Add a narrowly scoped recovery helper for stale orphaned replay claims
- [x] Prevent arbitrary result mutation or state bypass during recovery
- [x] Add focused tests and revalidate the full project

## Code improvement pass 115
- [x] Add an admin-only read-only replay diagnostics query
- [x] Expose bounded counts and stale status without raw identifiers
- [x] Add authorization/privacy tests and revalidate the full project

## Code improvement pass 116
- [x] Add an admin-only replay-protection health surface
- [x] Keep diagnostics read-only, bounded, and privacy-safe
- [x] Add UI tests and revalidate the full project

## Code improvement pass 117
- [x] Normalize malformed replay diagnostics safely
- [x] Show unavailable diagnostics as attention-required, not clear
- [x] Add focused tests and revalidate the full project

## Code improvement pass 118
- [x] Classify replay diagnostics freshness explicitly
- [x] Prevent stale or future timestamps from appearing healthy
- [x] Add focused freshness tests and revalidate the full project

## Code improvement pass 119
- [x] Add an explicit admin replay-diagnostics refresh action
- [x] Show request-level refreshing and refresh-failure feedback
- [x] Add focused interaction tests and revalidate the full project

## Code improvement pass 120
- [x] Track manual replay-diagnostics refresh outcomes explicitly
- [x] Preserve trustworthy snapshots while surfacing refresh failures
- [x] Add focused outcome tests and revalidate the full project

## Code improvement pass 121
- [x] Prevent stale refresh outcomes from updating the panel
- [x] Guard refresh feedback against component teardown
- [x] Add focused lifecycle tests and revalidate the full project

## Visual refresh-failure timeline
- [x] Add a bounded privacy-safe refresh event history model
- [x] Render a responsive operator timeline for recent refresh attempts
- [x] Add timeline regression tests and revalidate the full project

## Privacy-safe refresh failure categories
- [x] Categorize refresh errors without retaining raw messages
- [x] Render category labels in the operator timeline
- [x] Add category and redaction tests and revalidate the full project

## Refresh failure-rate summary
- [x] Calculate a bounded privacy-safe failure-rate summary
- [x] Render the summary beside the recent refresh timeline
- [x] Add summary math tests and revalidate the full project

## Refresh failure category breakdown
- [x] Calculate bounded counts for each coarse failure category
- [x] Render category counts beside the refresh-rate summary
- [x] Add breakdown tests and revalidate the full project

## Refresh failure trend indicator
- [x] Compare the newest and preceding bounded refresh windows
- [x] Render a privacy-safe trend direction for operators
- [x] Add trend boundary tests and revalidate the full project

## Refresh trend confidence cue
- [x] Add explicit trend sample-size confidence semantics
- [x] Render coverage guidance beside the trend indicator
- [x] Add boundary tests and revalidate the full project

## Failures-only replay timeline view
- [x] Add bounded failures-only filter state
- [x] Render accessible filter and empty states
- [x] Add filter tests and revalidate the full project

## Refresh failure category filter
- [x] Add bounded category-aware filter state
- [x] Render accessible category controls and empty states
- [x] Add category-filter tests and revalidate the full project

## Empty-filter recovery
- [x] Add an explicit reset to the full timeline
- [x] Make the empty state explain and recover from no matches
- [x] Add recovery tests and revalidate the full project

## Session-scoped timeline filter persistence
- [x] Persist and restore only validated filter values
- [x] Degrade safely when session storage is unavailable
- [x] Add persistence tests and revalidate the full project

## Restored-filter operator cue
- [x] Detect when a validated filter was restored from session storage
- [x] Render a transient accessible restoration cue
- [x] Add restoration-feedback tests and revalidate the full project

## Header-level filter reset
- [x] Add a visible reset-filter control to the timeline header
- [x] Keep reset behavior accessible and session-safe
- [x] Add reset-control tests and revalidate the full project

## Active-filter operator label
- [x] Add a safe label for the current timeline filter
- [x] Keep label and reset control responsive and accessible
- [x] Add label tests and revalidate the full project

## Active-filter matching count
- [x] Add a bounded matching-event count to the active-filter label
- [x] Keep count semantics accessible and privacy-safe
- [x] Add count tests and revalidate the full project

## Filter-change status cue
- [x] Add a safe transient status model for filter changes
- [x] Render the cue accessibly with timer cleanup
- [x] Add filter-change tests and revalidate the full project

## Count-aware filter-change cue
- [x] Include the bounded matching count in filter-change feedback
- [x] Keep count feedback accessible and privacy-safe
- [x] Add count-aware cue tests and revalidate the full project

## Per-category refresh trend comparison
- [x] Compare coarse failure categories across bounded timeline windows
- [x] Render privacy-safe category trend cues
- [x] Add category-trend tests and revalidate the full project

## Per-category trend severity
- [x] Classify bounded category trends into safe severity levels
- [x] Render accessible severity cues beside category trends
- [x] Add severity boundary tests and revalidate the full project

## Configurable severity thresholds
- [x] Add validated bounded attention and critical thresholds
- [x] Wire threshold configuration into category severity display
- [x] Add threshold-bound tests and revalidate the full project

## Admin threshold settings surface
- [x] Add admin-only threshold settings controls
- [x] Persist validated bounded settings safely for the session
- [x] Add settings tests and revalidate the full project

## Threshold save confirmation and defaults
- [x] Add a visible threshold-save confirmation
- [x] Add a one-click restore-defaults action
- [x] Add feedback tests and revalidate the full project

## Threshold explanation guidance
- [x] Add a safe explanation of Attention and Critical derivation
- [x] Render concise accessible guidance beside the threshold controls
- [x] Add explanation tests and revalidate the full project

## Threshold-change audit events
- [x] Add bounded coarse audit events for threshold changes
- [x] Render audit events without sensitive identifiers or raw diagnostics
- [x] Add audit-event tests and revalidate the full project

## Threshold audit lifecycle hardening
- [x] Deduplicate unchanged threshold audit events during rapid edits
- [x] Guard audit recording against updates after component teardown
- [x] Add lifecycle-boundary tests and revalidate the full project

## Operator accessibility hardening
- [x] Add explicit descriptions and grouped semantics for severity threshold controls
- [x] Improve keyboard-readable semantics for threshold audit entries
- [x] Add accessibility regression coverage and revalidate the full project

## Operator keyboard feedback hardening
- [x] Add stable status summaries for threshold changes and restored defaults
- [x] Improve keyboard guidance for threshold inputs and reset action
- [x] Add status-summary tests and revalidate the full project

## Threshold no-op update hardening
- [x] Detect unchanged normalized threshold values before updating state
- [x] Suppress redundant status notices and audit entries for no-op edits
- [x] Add no-op transition tests and revalidate the full project

## Threshold persistence recovery hardening
- [x] Add explicit safe persistence outcomes for threshold storage reads and writes
- [x] Keep operator state authoritative when session storage is malformed or unavailable
- [x] Add storage recovery tests and revalidate the full project

## Threshold persistence warning hardening
- [x] Deduplicate repeated persistence warning state updates
- [x] Preserve a clear recovery signal when storage becomes available again
- [x] Add persistence-warning transition tests and revalidate the full project

## Explicit persistence transition modeling
- [x] Model ready, unavailable, and recovered persistence states with fixed safe labels
- [x] Keep transition announcements bounded and free of storage details
- [x] Add transition tests and revalidate the full project

## Persistence lifecycle separation
- [x] Separate persistence result derivation from UI warning state updates
- [x] Keep lifecycle feedback bounded and recoverable without storage leakage
- [x] Add lifecycle helper tests and revalidate the full project

## Persistence effect lifecycle hardening
- [x] Prevent persistence feedback state updates after component unmount
- [x] Keep rapid threshold changes aligned with the latest persistence result
- [x] Add lifecycle persistence tests and revalidate the full project

## Full-suite reliability follow-up
- [x] Make the acceptance idempotency router test deterministic when underwriting blocks a preview offer
- [x] Preserve coverage for committed replay results and distinct-key conflicts
- [x] Re-run the full suite and build after the reliability fix

## Deterministic preview-offer test hardening
- [x] Add an explicit accepted preview snapshot fixture for router tests
- [x] Preserve committed replay and distinct-key conflict assertions
- [x] Re-run the full suite and build after fixture hardening

## Deterministic loan-state fixture factory
- [x] Centralize accepted, blocked, expired, and executed loan fixtures
- [x] Reuse fixtures across router state and replay tests
- [x] Add fixture-state regression coverage and revalidate the full project

## Malformed loan-state fixture hardening
- [x] Add malformed and partially populated snapshot fixtures
- [x] Verify acceptance fails closed without executing incomplete offers
- [x] Add malformed-state tests and revalidate the full project

## Audit-history robustness hardening
- [x] Normalize malformed audit entries into bounded coarse timeline events
- [x] Handle invalid timestamps without breaking newest-first ordering
- [x] Add audit-history regression tests and revalidate the full project

## Server snapshot audit-history hardening
- [x] Normalize persisted audit histories at the server snapshot boundary
- [x] Keep malformed audit records bounded and free of raw diagnostic details
- [x] Add server snapshot regression tests and revalidate the full project

## Persisted snapshot read-boundary coverage
- [x] Add a mocked database read harness for snapshot reconstruction
- [x] Verify valid snapshots reconstruct and malformed rows fail closed
- [x] Add read-path tests and revalidate the full project

## Persisted underwriting row hardening
- [x] Add malformed fact, decision, and offer database-row fixtures
- [x] Verify reconstruction fails closed for each malformed underwriting row
- [x] Add read-path regression tests and revalidate the full project

## Persisted metadata validation hardening
- [x] Add malformed application metadata and feature-vector read fixtures
- [x] Verify reconstruction fails closed for invalid persisted metadata
- [x] Add metadata regression tests and revalidate the full project

## Underwriting consistency hardening
- [x] Reject inconsistent fact chronology before feature derivation
- [x] Validate derived feature inputs remain finite and bounded
- [x] Add consistency regression tests and revalidate the full project

## Evidence-integrity hardening
- [x] Add deterministic fact-to-feature consistency validation
- [x] Reject reconstructed snapshots when derived metrics drift from evidence
- [x] Add feature-drift tests and revalidate the full project

## Feature-integrity fingerprint hardening
- [x] Add a canonical deterministic fingerprint for derived feature vectors
- [x] Verify fingerprint stability and reject drift at persistence boundaries
- [x] Add fingerprint regression tests and revalidate the full project

## Persisted feature fingerprint hardening
- [x] Add a nullable migration-safe feature fingerprint field to decision metadata
- [x] Write and verify the canonical fingerprint across persistence boundaries
- [x] Add schema, migration, and drift regression tests with full validation

## Code improvement pass 12
- [x] Reject ambiguous persisted snapshots when duplicate application or decision rows exist
- [x] Add regression coverage for duplicate-row fail-closed behavior
- [x] Revalidate typecheck, tests, production build, and responsive rendering

## Code improvement pass 13
- [x] Reject duplicate verified fact IDs and transaction references at the persistence boundary
- [x] Add regression coverage for duplicate evidence identity and fail-closed reconstruction
- [x] Revalidate typecheck, tests, production build, and responsive rendering

## Code improvement pass 14
- [x] Reject duplicate audit event hashes at the write boundary before persistence
- [x] Add regression coverage for duplicate audit identity and fail-closed writes
- [x] Revalidate typecheck, tests, production build, and responsive rendering

## Code improvement pass 15
- [x] Reject non-canonical audit timestamps before persistence
- [x] Add regression coverage for timestamp normalization and fail-closed writes
- [x] Revalidate typecheck, tests, production build, and responsive rendering

## Code improvement pass 16
- [x] Apply one canonical UTC timestamp validator across facts, audit events, and replay persistence
- [x] Add regression coverage for cross-boundary timestamp consistency
- [x] Revalidate typecheck, tests, production build, and responsive rendering

## Code improvement pass 17
- [x] Enforce canonical application decision metadata across all persistence write paths
- [x] Add regression coverage for metadata drift and fail-closed persistence
- [x] Revalidate typecheck, tests, production build, and responsive rendering

## Code improvement pass 18
- [x] Reject non-monotonic verified-fact chronology before persistence
- [x] Add regression coverage for chronology drift and fail-closed writes
- [x] Revalidate typecheck, tests, production build, and responsive rendering

## Code improvement pass 19
- [x] Enforce source-block and verification-block chronology at the write boundary
- [x] Add regression coverage for block-order drift and fail-closed writes
- [x] Revalidate typecheck, tests, production build, and responsive rendering

## Code improvement pass 20
- [x] Enforce evidence-root consistency between persisted facts and decision metadata
- [x] Add regression coverage for evidence-root drift and fail-closed persistence
- [x] Revalidate typecheck, tests, production build, and responsive rendering

## Code improvement pass 21
- [x] Enforce deterministic decision-hash consistency during persisted reconstruction
- [x] Add regression coverage for decision-hash drift and fail-closed reads
- [x] Revalidate typecheck, tests, production build, and responsive rendering

## Code improvement pass 22
- [x] Align persisted decision freshness with the canonical derived feature vector
- [x] Add regression coverage for reconstructed decision-feature freshness alignment
- [x] Revalidate typecheck, tests, production build, and responsive rendering

## Code improvement pass 23
- [x] Enforce consistency between persisted decision confidence and derived freshness metrics
- [x] Add regression coverage for confidence-freshness drift and fail-closed reconstruction
- [x] Revalidate typecheck, tests, production build, and responsive rendering

## Code improvement pass 24
- [x] Enforce decision risk-tier consistency with persisted probability thresholds
- [x] Add regression coverage for risk-tier drift and fail-closed reconstruction
- [x] Revalidate typecheck, tests, production build, and responsive rendering

## Code improvement pass 25
- [x] Enforce policy-hash consistency with the canonical underwriting policy
- [x] Add regression coverage for policy-hash drift and fail-closed persistence
- [x] Revalidate typecheck, tests, production build, and responsive rendering

## Code improvement pass 26
- [x] Enforce decision PD90 monotonicity and risk-tier consistency across all modern persistence paths
- [x] Add regression coverage for probability-order drift and fail-closed reconstruction
- [x] Revalidate typecheck, tests, production build, and responsive rendering

## Code improvement pass 27
- [x] Enforce canonical offer consistency with decision and requested-amount metadata
- [x] Add regression coverage for offer drift and fail-closed persistence
- [x] Revalidate typecheck, tests, production build, and responsive rendering

## Code improvement pass 28
- [x] Enforce canonical LTV consistency between offer amount and collateral basis
- [x] Add regression coverage for LTV drift and fail-closed persistence
- [x] Revalidate typecheck, tests, production build, and responsive rendering

## Code improvement pass 29
- [x] Enforce persisted collateral-basis provenance for canonical LTV reconstruction
- [x] Add regression coverage for collateral-basis drift and fail-closed persistence
- [x] Revalidate typecheck, tests, production build, and responsive rendering

## Code improvement pass 30
- [x] Enforce collateral provenance presence for modern offers and preserve legacy compatibility
- [x] Add regression coverage for missing modern collateral provenance and fail-closed reconstruction
- [x] Revalidate typecheck, tests, production build, and responsive rendering

## Code improvement pass 31
- [x] Persist pool-liquidity provenance and enforce offer liquidity consistency across reconstruction
- [x] Add regression coverage for pool-liquidity drift and fail-closed persistence
- [x] Revalidate typecheck, tests, production build, and responsive rendering

## Code improvement pass 32
- [x] Enforce offer expiry and state consistency at the execution boundary using one shared validator
- [x] Add regression coverage for stale or state-inconsistent execution attempts
- [x] Revalidate typecheck, tests, production build, and responsive rendering

## Code improvement pass 33
- [x] Bind the execution transaction receipt to the canonical final offer and audit event
- [x] Add regression coverage for transaction-receipt tampering and fail-closed acceptance results
- [x] Revalidate typecheck, tests, production build, and responsive rendering

## Code improvement pass 34
- [x] Enforce transaction-hash format and receipt binding at the durable replay boundary
- [x] Add regression coverage for malformed or mismatched execution receipts
- [x] Revalidate typecheck, tests, production build, and responsive rendering

## Code improvement pass 35
- [x] Enforce canonical execution receipt binding for modern durable replay records
- [x] Add regression coverage for missing and mismatched receipt bindings
- [x] Revalidate typecheck, tests, production build, and responsive rendering

## Code improvement pass 36
- [x] Strengthen modern acceptance replay read validation against incomplete execution records
- [x] Add focused regression coverage for incomplete committed replay payloads
- [x] Revalidate typecheck, tests, production build, and responsive rendering

## Code improvement pass 37
- [x] Strengthen modern acceptance replay validation for receipt and transaction consistency
- [x] Add focused regression coverage for malformed modern replay payloads
- [x] Revalidate typecheck, tests, production build, and responsive rendering

## Code improvement pass 38
- [x] Harden receipt-bearing replay validation against inconsistent decision metadata
- [x] Add focused regression coverage for decision-binding drift in replay payloads
- [x] Revalidate typecheck, tests, production build, and responsive rendering

## Code improvement pass 39
- [x] Harden modern acceptance replay validation against inconsistent execution state
- [x] Add focused regression coverage for replay state drift
- [x] Revalidate typecheck, tests, production build, and responsive rendering

## Code improvement pass 40
- [x] Harden receipt-bearing replay validation against inconsistent audit chronology
- [x] Add focused regression coverage for terminal audit drift
- [x] Revalidate typecheck, tests, production build, and responsive rendering

## Code improvement pass 41
- [x] Harden receipt-bearing replay validation against inconsistent audit identity
- [x] Add focused regression coverage for audit-hash drift
- [x] Revalidate typecheck, tests, production build, and responsive rendering

## Code improvement pass 42
- [x] Harden modern acceptance replay validation against inconsistent audit state progression
- [x] Add focused regression coverage for audit state drift
- [x] Revalidate typecheck, tests, production build, and responsive rendering

## Code improvement pass 43
- [x] Harden modern acceptance replay validation against incomplete audit state metadata
- [x] Add focused regression coverage for missing audit states
- [x] Revalidate typecheck, tests, production build, and responsive rendering

## Code improvement pass 44
- [x] Harden modern acceptance replay validation against inconsistent audit labels
- [x] Add focused regression coverage for audit label drift
- [x] Revalidate typecheck, tests, production build, and responsive rendering

## Code improvement pass 45
- [x] Harden modern acceptance replay validation against inconsistent audit details
- [x] Add focused regression coverage for audit detail drift
- [x] Revalidate typecheck, tests, production build, and responsive rendering

## Code improvement pass 46
- [x] Harden modern acceptance replay validation against inconsistent audit event details
- [x] Add focused regression coverage for audit detail drift
- [x] Revalidate typecheck, tests, production build, and responsive rendering

## Code improvement pass 47
- [x] Harden modern acceptance replay validation against inconsistent audit timestamps
- [x] Add focused regression coverage for audit timestamp drift
- [x] Revalidate typecheck, tests, production build, and responsive rendering

## Code improvement pass 48
- [x] Harden modern acceptance replay validation against inconsistent audit-event hash format
- [x] Add focused regression coverage for malformed audit hashes
- [x] Revalidate typecheck, tests, production build, and responsive rendering

## Code improvement pass 49
- [x] Harden modern acceptance replay validation against inconsistent offer metadata
- [x] Add focused regression coverage for offer metadata drift
- [x] Revalidate typecheck, tests, production build, and responsive rendering

## Code improvement pass 50
- [x] Harden modern acceptance replay validation against inconsistent offer expiry state
- [x] Add focused regression coverage for expired replay offers
- [x] Revalidate typecheck, tests, production build, and responsive rendering

## Code improvement pass 51
- [x] Harden modern acceptance replay validation against inconsistent offer collateral provenance
- [x] Add focused regression coverage for collateral-basis drift
- [x] Revalidate typecheck, tests, production build, and responsive rendering

## Code improvement pass 52
- [x] Harden modern acceptance replay validation against inconsistent pool-liquidity provenance
- [x] Add focused regression coverage for liquidity-basis drift
- [x] Revalidate typecheck, tests, production build, and responsive rendering

## Code improvement pass 53
- [x] Harden modern acceptance replay validation against inconsistent decision-to-offer amount binding
- [x] Add focused regression coverage for amount drift
- [x] Revalidate typecheck, tests, production build, and responsive rendering

## Code improvement pass 54
- [x] Harden modern acceptance replay validation against inconsistent decision confidence metadata
- [x] Add focused regression coverage for confidence drift
- [x] Revalidate typecheck, tests, production build, and responsive rendering

## Code improvement pass 55
- [x] Harden modern acceptance replay validation against inconsistent decision probability metadata
- [x] Add focused regression coverage for probability drift
- [x] Revalidate typecheck, tests, production build, and responsive rendering

## Code improvement pass 56
- [x] Harden modern acceptance replay validation against inconsistent decision metadata types
- [x] Add focused regression coverage for string-encoded decision probabilities
- [x] Revalidate typecheck, tests, production build, and responsive rendering

## Code improvement pass 57
- [x] Harden modern acceptance replay validation against inconsistent decision metadata strings
- [x] Add focused regression coverage for malformed decision metadata
- [x] Revalidate typecheck, tests, production build, and responsive rendering

## Code improvement pass 58
- [x] Harden modern acceptance replay validation against inconsistent reason-code metadata
- [x] Add focused regression coverage for invalid reason codes
- [x] Revalidate typecheck, tests, production build, and responsive rendering

## Code improvement pass 59
- [x] Harden modern acceptance replay validation against inconsistent execution receipt metadata
- [x] Add focused regression coverage for receipt metadata drift
- [x] Revalidate typecheck, tests, production build, and responsive rendering

## Code improvement pass 60
- [x] Harden modern acceptance replay validation against inconsistent execution receipt application binding
- [x] Add focused regression coverage for receipt application drift
- [x] Revalidate typecheck, tests, production build, and responsive rendering

## Code improvement pass 61
- [x] Harden replay-record expiry validation against invalid and future timestamps
- [x] Add focused regression coverage for malformed replay timestamps
- [x] Revalidate typecheck, tests, production build, and responsive rendering

## Code improvement pass 62
- [x] Harden replay cleanup against non-finite clock inputs
- [x] Add focused regression coverage for invalid cleanup timestamps
- [x] Revalidate typecheck, tests, production build, and responsive rendering

## Code improvement pass 63
- [x] Harden replay affected-row validation against coercible and malformed values
- [x] Add focused regression coverage for invalid affected-row metadata
- [x] Revalidate typecheck, tests, production build, and responsive rendering

## Code improvement pass 64
- [x] Harden replay request-key and application-ID validation at persistence boundaries
- [x] Add focused regression coverage for malformed replay identity inputs
- [x] Revalidate typecheck, tests, production build, and responsive rendering

## Code improvement pass 65
- [x] Harden persisted wallet-address validation against control characters and non-canonical text
- [x] Add focused regression coverage for malformed wallet addresses
- [x] Revalidate typecheck, tests, production build, and responsive rendering

## Code improvement pass 66
- [x] Reject non-canonical application IDs before persisted snapshot reconstruction queries
- [x] Add focused regression coverage for malformed reconstruction identifiers
- [x] Revalidate typecheck, tests, production build, and responsive rendering

## Code improvement pass 67
- [x] Reject reconstructed child rows with mismatched application IDs
- [x] Add focused regression coverage for cross-record identifier drift
- [x] Revalidate typecheck, tests, production build, and responsive rendering

## Code improvement pass 68
- [x] Reject reconstructed verified facts from a different source chain
- [x] Add focused regression coverage for source-chain drift
- [x] Revalidate typecheck, tests, production build, and responsive rendering

## Code improvement pass 69
- [x] Reject persisted executed offers whose expiry is not after the terminal audit event
- [x] Add focused regression coverage for offer-audit chronology drift
- [x] Revalidate typecheck, tests, production build, and responsive rendering

## Code improvement pass 70
- [x] Reject persisted verified facts timestamped after the terminal audit event
- [x] Add focused regression coverage for fact-audit chronology drift
- [x] Revalidate typecheck, tests, production build, and responsive rendering

## Code improvement pass 71
- [x] Reject persisted audit events with empty or whitespace-only detail text
- [x] Add focused regression coverage for empty audit details at the read boundary
- [x] Revalidate typecheck, tests, production build, and responsive rendering

## Code improvement pass 72
- [x] Reject reconstructed decision and offer rows created after the terminal audit event
- [x] Add focused regression coverage for child-record timing drift
- [x] Revalidate typecheck, tests, production build, and responsive rendering

## Code improvement pass 73
- [x] Reject reconstructed applications with invalid or post-audit timestamps
- [x] Add focused regression coverage for application timestamp drift
- [x] Revalidate typecheck, tests, production build, and responsive rendering

## Code improvement pass 74
- [x] Reject reconstructed applications updated before creation or after the terminal audit event
- [x] Add focused regression coverage for update-timestamp chronology drift
- [x] Revalidate typecheck, tests, production build, and responsive rendering

## Code improvement pass 75
- [x] Reject persisted timestamp values that are not native valid Date instances
- [x] Add focused regression coverage for string and timezone-like timestamp coercion
- [x] Revalidate typecheck, tests, production build, and responsive rendering

## Code improvement pass 76
- [x] Reject direct snapshot writes whose verified facts use a different source chain
- [x] Add focused regression coverage for write-boundary source-chain drift
- [x] Revalidate typecheck, tests, production build, and responsive rendering

## Code improvement pass 77
- [x] Reject fact identity values that rely on implicit string coercion
- [x] Add focused regression coverage for malformed fact IDs and references
- [x] Revalidate typecheck, tests, production build, and responsive rendering

## Code improvement pass 78
- [x] Reject empty and whitespace-only audit details in direct audit upsert construction
- [x] Add focused regression coverage for malformed audit details at the write boundary
- [x] Revalidate typecheck, tests, production build, and responsive rendering

## Code improvement pass 79
- [x] Reject audit hashes with control characters in direct upsert construction
- [x] Add focused regression coverage for malformed audit hash text
- [x] Revalidate typecheck, tests, production build, and responsive rendering

## Code improvement pass 80
- [x] Reject acceptance replay transaction hashes with control characters or non-canonical text
- [x] Add focused regression coverage for malformed replay transaction hashes
- [x] Revalidate typecheck, tests, production build, and responsive rendering

## Code improvement pass 81
- [x] Reject persisted source and verification block values that rely on numeric coercion
- [x] Add focused regression coverage for string and malformed block metadata
- [x] Revalidate typecheck, tests, production build, and responsive rendering

## Code improvement pass 82
- [x] Reject audit hash identity values that rely on implicit string coercion
- [x] Add focused regression coverage for malformed audit hash metadata
- [x] Revalidate typecheck, tests, production build, and responsive rendering

## Code improvement pass 83
- [x] Reject verified facts with malformed asset or proof-worker provenance
- [x] Add focused regression coverage for evidence provenance drift
- [x] Revalidate typecheck, tests, production build, and responsive rendering

## Code improvement pass 84
- [x] Reject non-string optional feature fingerprints before regex validation
- [x] Add focused regression coverage for coercible fingerprint metadata
- [x] Revalidate typecheck, tests, production build, and responsive rendering

## Code improvement pass 85
- [x] Reject non-finite or non-canonical feature vectors before fingerprint comparison
- [x] Add focused regression coverage for coercible feature-vector values
- [x] Revalidate typecheck, tests, production build, and responsive rendering

## Code improvement pass 86
- [x] Add chain-specific wallet address validation without breaking explicit preview identifiers
- [x] Add chain-aware transaction hash validation at live proof boundaries
- [x] Add focused regressions and revalidate the project

## Code improvement pass 87
- [x] Add strict EVM wallet-address validation for live proof requests while preserving preview identifiers
- [x] Route live-mode detection through the wallet and transaction identity predicates
- [x] Add focused regressions and revalidate the project

## Code improvement pass 88
- [x] Reject malformed address-shaped proof identities instead of silently routing them to preview
- [x] Clarify the borrower input contract so live proof identity is not conflated with a wallet address
- [x] Add focused regressions and revalidate the project

## Code improvement pass 89
- [x] Add pure client validation for malformed address-shaped proof identities
- [x] Surface actionable inline feedback before proof submission
- [x] Add focused client regressions and revalidate the project

## Code improvement pass 90
- [x] Detect hash-shaped but non-canonical source identities before submission
- [x] Provide specific 32-byte transaction-hash guidance without rejecting short preview identifiers
- [x] Add focused regressions and revalidate the project

## Code improvement pass 91
- [x] Add stable, privacy-safe persistence validation rule identifiers
- [x] Keep diagnostics free of wallet addresses, payloads, and evidence contents
- [x] Add focused diagnostic regressions and revalidate the project

## Code improvement pass 92
- [x] Add a bounded operator remediation guide for persistence rule identifiers
- [x] Keep guidance read-only and free of sensitive persistence payloads
- [x] Add focused guidance regressions and revalidate the project

## Code improvement pass 93
- [x] Report the last persistence failure rule through the read-only operator diagnostics response
- [x] Normalize and display only bounded stable rule IDs with remediation lookup
- [x] Add focused diagnostics-flow regressions and revalidate the project

## Code improvement pass 94
- [x] Add bounded recent persistence failure rule history
- [x] Keep history coarse, read-only, and free of sensitive identifiers
- [x] Add focused recurring-rule regressions and revalidate the project

## Code improvement pass 95
- [x] Add bounded freshness classification for persistence failure history
- [x] Mark expired diagnostic history as stale without deleting safe rule IDs
- [x] Add focused freshness regressions and revalidate the project

## Code improvement pass 96
- [x] Add bounded recurrence counts by persistence rule ID
- [x] Keep recurrence summaries coarse, deterministic, and privacy-safe
- [x] Add focused recurrence regressions and revalidate the project

## Code improvement pass 97
- [x] Add a read-only current-versus-stale persistence history filter
- [x] Preserve bounded history and privacy-safe rule summaries under filtering
- [x] Add focused filter regressions and revalidate the project

## Code improvement pass 98
- [x] Persist the selected persistence-diagnostics filter for the current operator session
- [x] Handle blocked or malformed session storage safely without sensitive values
- [x] Add focused storage regressions and revalidate the project

## Code improvement pass 99
- [x] Add bounded recurrence trend classification across diagnostics refreshes
- [x] Keep trend telemetry coarse, deterministic, and privacy-safe
- [x] Add focused trend regressions and revalidate the project

## Code improvement pass 100
- [x] Detect when the persistence-diagnostics filter is restored from the operator session
- [x] Show bounded restoration feedback without exposing storage contents
- [x] Add focused restoration regressions and revalidate the project

## Code improvement pass 101
- [x] Add bounded watch and critical thresholds for persistence failure recurrence
- [x] Keep threshold state session-safe and alert copy privacy-safe
- [x] Add focused threshold regressions and revalidate the project

## Code improvement pass 102
- [x] Add strictly bounded session-local recurrence threshold configuration
- [x] Persist only validated threshold values and fail safely on malformed storage
- [x] Add focused threshold-control regressions and revalidate the project

## Code improvement pass 103
- [x] Add safe threshold reset to the bounded default configuration
- [x] Show whether alert thresholds were restored from the current session
- [x] Add focused reset and restoration regressions and revalidate the project

## Code improvement pass 104
- [x] Add bounded explanations for watch and critical persistence recurrence alerts
- [x] Keep alert explanations threshold-aware and free of sensitive data
- [x] Add focused explanation regressions and revalidate the project

## Code improvement pass 105
- [x] Add bounded watch-to-critical escalation transition detection
- [x] Show a privacy-safe escalation notice with explicit operator action
- [x] Add focused escalation regressions and revalidate the project

## Code improvement pass 106
- [x] Add bounded summary text for the selected persistence history filter
- [x] Ensure displayed recurrence telemetry is explicitly scoped to the selected filter
- [x] Add focused filter-summary regressions and revalidate the project

## Code improvement pass 107
- [x] Add a visible filter-scope label beside the persistence recurrence alert
- [x] Keep the alert summary bounded and consistent with selected telemetry
- [x] Add focused scope-summary regressions and revalidate the project

## Code improvement pass 108
- [x] Add a session-safe acknowledgment action for persistence escalation notices
- [x] Keep acknowledgment state bounded, privacy-safe, and scoped to the current alert posture
- [x] Add focused acknowledgment regressions and revalidate the project

## Code improvement pass 109
- [x] Add an explicit unacknowledge action for the active persistence escalation
- [x] Clear acknowledgment storage safely without exposing or retaining sensitive data
- [x] Add focused lifecycle regressions and revalidate the project

## Code improvement pass 110
- [x] Add a bounded UTC acknowledgment timestamp to the session-safe escalation marker
- [x] Display acknowledgment timing without exposing sensitive diagnostics data
- [x] Add timestamp normalization and privacy regressions, then revalidate the project

## Code improvement pass 111
- [x] Add a bounded UTC unacknowledgment timestamp to the session-safe escalation lifecycle
- [x] Display the unacknowledgment timing without exposing sensitive diagnostics data
- [x] Add lifecycle timestamp regressions and revalidate the project

## Code improvement pass 112
- [x] Prune persisted acknowledgment markers when the active critical posture changes
- [x] Keep lifecycle pruning bounded, session-local, and privacy-safe
- [x] Add posture-mismatch regressions and revalidate the project

## Code improvement pass 113
- [x] Separate walletAddress and sourceTransactionHash across the proof identity boundary
- [x] Preserve fail-closed validation and privacy-safe diagnostics for both fields
- [x] Add migration, persistence, API, and UI regressions, then revalidate the project

## Code improvement pass 114
- [x] Add an explicit privacy-safe live-versus-preview proof mode classifier
- [x] Show mode state consistently in borrower and operator-facing surfaces
- [x] Add classifier and UI regressions, then revalidate the project

## Code improvement pass 115
- [x] Add deterministic mocked live Attestcoin coverage for persistence and state transitions
- [x] Verify live requests preserve distinct wallet and source transaction identity
- [x] Add fail-closed live-path regressions and revalidate the project

## Code improvement pass 116
- [x] Require a supported source chain for live proof mode classification
- [x] Keep malformed or unknown-chain inputs fail-closed as preview state
- [x] Add chain-aware classifier regressions and revalidate the project

## Code improvement pass 117
- [x] Add deterministic bounded serialization for operator persistence diagnostics
- [x] Add a browser download action that exports no sensitive identifiers or payloads
- [x] Add export privacy regressions and revalidate the project

## Code improvement pass 118
- [x] Add deterministic mocked live Attestcoin coverage for persistence and state transitions
- [x] Verify live requests preserve distinct wallet and source transaction identity
- [x] Add fail-closed live-path regressions and revalidate the project

## Code improvement pass 119
- [x] Add exact live Attestcoin proof-worker failure recovery coverage
- [x] Prove failed live verification cannot advance to advisory scoring or execution
- [x] Add fail-closed recovery regressions and revalidate the project

## Code improvement pass 120
- [x] Add deterministic live acceptance replay-conflict coverage
- [x] Prove a conflicting request cannot execute or mutate the live offer state
- [x] Add replay-boundary regressions and revalidate the project

## Code improvement pass 121
- [x] Add deterministic Creditcoin replay-commit failure coverage
- [x] Prove post-execution commit failure remains explicitly surfaced and auditable
- [x] Add fail-closed acceptance regressions and revalidate the project
