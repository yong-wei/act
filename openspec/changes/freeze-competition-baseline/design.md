## Context

The latest `integration` branch has archived specs and code for the main assistant loop, but current routes and data are still spread across teacher, assessment, profile, adaptive practice, data governance, and demo-package modules. The competition plan in `docs/proposals/2026-06-13-update.md` should become an executable baseline before deeper hardening begins.

Active UI governance must be respected. `restrict-data-center-to-operations-roles` is complete, so students must use learner-record surfaces rather than Data Center. `enforce-secondary-navigation-visual-governance` remains active, so this baseline records current required surfaces but does not make final visual conformance claims.

## Goals / Non-Goals

**Goals:**

- Freeze one deterministic assistant story for reviewers and agents.
- Make seed, reset, account, route, data-origin, screenshot, and acceptance expectations explicit.
- Prevent downstream changes from expanding competition scope without updating the baseline ledger.
- Preserve real-vs-synthetic evidence boundaries.

**Non-Goals:**

- No LLM grading quality upgrade.
- No new diagnosis algorithm.
- No new RAG index or citation UI.
- No final 1440/320 screenshot baseline.
- No production deployment or release tagging.

## Decisions

- Use a dedicated `competition-demo-baseline` capability instead of extending the existing demo-package spec directly. The demo-package specs describe product records; this baseline coordinates the full submission story and must reuse existing deterministic demo-package records where they already exist.
- Keep demo seed data synthetic and explicitly marked. Real evidence import belongs to later effect-report work and must not be implied by synthetic baseline success.
- Use existing routes first, with ledger entries for gaps. Creating new polished routes before the shell governance change completes would create unnecessary churn.
- Treat `OpenAI-compatible` as the supported runtime provider in the baseline. Anthropic-compatible metadata can be documented but is not a readiness requirement unless a later change implements a native adapter.

## Risks / Trade-offs

- Baseline may become stale as downstream changes land -> require every downstream competition change to update the route and scenario ledger.
- Seed data can be mistaken for real outcome evidence -> every seeded record and effect metric must carry `synthetic` or equivalent data-origin metadata.
- Existing pages may not yet be visually final -> baseline acceptance checks should prove reachability and data semantics, leaving final visual acceptance to the polish change.

## Migration Plan

1. Add documentation and seed/reset contracts behind deterministic script or API names, reusing existing demo-package seed records before adding any new data shape.
2. Validate the baseline without changing production data.
3. Let downstream changes extend the ledger rather than inventing new demo paths.
