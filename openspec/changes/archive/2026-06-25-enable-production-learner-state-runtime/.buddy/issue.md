---
change_id: enable-production-learner-state-runtime
claim_branch: enable-production-learner-state-runtime
series: konling-citation-personalization
coupling_group: konling-citation-personalization
execution_mode: isolated
base_branch: integration
required_branch:
depends_on: []
parent_issue:
blocked_by: []
blocking: []
openspec_path: openspec/changes/enable-production-learner-state-runtime
risk: medium
area: platform
---

## Goal

Make learner-state service availability a production runtime requirement while ensuring sparse learner data only limits personalization and never prevents Konling from returning cited teaching-content answers.

## Scope

- Add `ADAPTIVE_LEARNER_STATE_SERVICE_ENABLED=true` to production-facing environment examples and deployment injection.
- Ensure app and worker containers receive the learner-state flag during production deployment.
- Clarify learner-state runtime semantics for disabled service, no evidence, no active path, stale evidence, and read failure.
- Verify Konling uses learner-state when available and degrades personalization when sparse data is absent.
- Separate code/PR evidence from post-merge production operations evidence.

## Out of Scope

- Hiding or showing citation debug text in the stream; that belongs to `govern-konling-citation-debug-streaming`.
- Rebuilding the learner-state feature cache pipeline or changing database schema.
- Changing model-provider secrets, model names, or deployed AI base URLs.
- Performing production redeploy before the implementation PR is merged and explicitly released.

## Acceptance Checklist

- [ ] AC-1: Production app and worker runtime configuration injects `ADAPTIVE_LEARNER_STATE_SERVICE_ENABLED=true`. Owner: independent reviewer.
  Evidence: `.env.example`, `deploy/podman/.env.server.example`, deploy script changes, and a focused deploy-script check or test.
- [ ] AC-2: Learner-state reads distinguish disabled service, no evidence, no active path, stale evidence, and read failure as explicit states. Owner: independent reviewer.
  Evidence: adaptive learner-state service tests or route tests covering sparse and failure cases.
- [ ] AC-3: Konling consumes available learner-state for personalization but still returns cited teaching-content answers when learner-state or path-execution rows are missing. Owner: independent reviewer.
  Evidence: Konling runtime tests covering available learner-state, missing learner-state, and missing path-execution cases.
- [ ] AC-4: Production verification plan separates PR-contained code evidence from post-merge operational evidence. Owner: independent reviewer.
  Evidence: documented verification steps for container env, `/api/readyz`, learner-state route behavior, and sparse-data Konling citation behavior.
- [ ] AC-5: The OpenSpec change remains valid. Owner: independent reviewer.
  Evidence: `rtk openspec validate enable-production-learner-state-runtime --strict`.

## Tasks

- [ ] Task 1: Update production environment declarations and deployment injection.
  Covers: AC-1
  Acceptance: The learner-state flag appears in environment examples and is passed to both app and worker containers by the production deploy path.
  Evidence: Diff of env examples and deploy script plus a deploy-script test or focused static check.
  Reviewer Check: Confirm the flag is present for both app and worker and is not limited to local development.
- [ ] Task 2: Harden learner-state runtime state semantics.
  Covers: AC-2
  Acceptance: Runtime callers can distinguish disabled service, no evidence, no active path, stale evidence, and read failure without treating sparse data as service failure.
  Evidence: Service or route tests for the explicit state matrix.
  Reviewer Check: Confirm no-data states are represented separately from disabled or failed service states.
- [ ] Task 3: Connect Konling personalization degradation to learner-state availability.
  Covers: AC-3
  Acceptance: Available learner-state shapes Konling metadata and personalization; missing learner-state/path-execution limits personalization but still allows content citations.
  Evidence: Konling runtime tests for available learner-state, sparse learner data, missing path execution, and path-advice limitation disclosure.
  Reviewer Check: Confirm cited content generation does not depend on learner-state completeness.
- [ ] Task 4: Document and prepare production verification evidence.
  Covers: AC-4, AC-5
  Acceptance: The implementation includes PR-verifiable checks and a clear post-merge operations checklist for runtime env, readiness, learner-state route behavior, and sparse-data Konling citation behavior.
  Evidence: Verification notes in the PR or implementation evidence plus `rtk openspec validate enable-production-learner-state-runtime --strict`.
  Reviewer Check: Confirm operational checks are not falsely claimed as completed before deployment and every AC has matching evidence.

## Agent Guardrails

- Only execute this issue's change.
- Coordinate with sibling issues in the `konling-citation-personalization` coupling group before editing shared Konling runtime files.
- Implementation agents may propose satisfied AC ids with evidence, but must not check Acceptance Checklist items themselves.
- Check AC items only after an independent reviewer confirms the linked task evidence.
- Use the claim branch named in front matter.
- Do not execute `govern-konling-citation-debug-streaming` in this issue.
- Stop if dependency, coupling group, or branch constraints fail.
- Stop if GitHub blockedBy relationships still contain open blockers.
