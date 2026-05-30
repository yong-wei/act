## Context

Recent UI review found that the platform already has strong product capabilities, but students encounter them as separate pages with different visual systems. The redesign should treat the student journey as a commercial product map rather than as a collection of implementation modules.

The user explicitly allowed bold refactoring where the existing UI system is unreasonable. That means this change may replace entry-page structures, local shells, page-specific color systems, and repeated card blocks when they conflict with the brand and navigation contracts.

## Surface Model

The student entry layer has five primary intents:

- Learn: Interactive Learning and course runtime.
- Practice: adaptive practice and mastery remediation.
- Challenge: Arena and challenge detail.
- Experiment: Control Workbench, simulation resources, and object exploration.
- Review: profile, evidence history, reports, and recommendations.

Homepage and student cockpit should expose this intent map. Individual product entry surfaces should then narrow the context rather than repeat every destination with equal weight.

## Authentication Surfaces

Login, authentication callback, authentication error, account menu, and profile callback routes are entry surfaces, not technical leftovers. A student who lands on `/login?callbackUrl=%2Fprofile` should see the same commercial brand, clear account action, preserved destination intent, and adjacent learning destinations if authentication cannot complete.

These surfaces should avoid the current failure mode where authentication is visually disconnected from the product and the callback destination is only a URL detail.

## Visual Direction

Entry pages should use the commercial brand language through trace, feedback-loop, instrument-grid, and governed-evidence motifs. They should avoid page-local decorative gradients, oversized generic heroes, and unrelated card matrices.

The first viewport should communicate the platform identity and the current product context, but still reveal usable destinations without requiring excessive scrolling. Cards remain allowed for repeated items such as challenges or courses, but page sections should be full-width bands or structured product lanes.

## Data and State Boundaries

Student entry pages may summarize evidence, readiness, progress, and recommendations, but they must not compute learner truth locally. They consume governed payloads from the relevant feature domains and render confidence, missing data, and feature-flagged unavailable states through shared status semantics.

## Risks

- Replacing entry layouts can disturb route expectations. Preserve existing route URLs and add compatibility aliases where necessary.
- A high-end commercial surface can become decorative if it hides tasks. The design must keep primary destinations visible and actionable.

## Verification

- Route smoke checks for all student entry routes and aliases.
- Browser checks at desktop, tablet, and 320px mobile widths.
- Empty, unauthenticated, authenticated, authentication-error, loading, and low-evidence states reviewed visually.
