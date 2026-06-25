---
change_id: govern-konling-citation-debug-streaming
claim_branch: govern-konling-citation-debug-streaming
series: konling-citation-personalization
coupling_group: konling-citation-personalization
execution_mode: isolated
base_branch: integration
required_branch:
depends_on: []
parent_issue:
blocked_by: []
blocking: []
openspec_path: openspec/changes/govern-konling-citation-debug-streaming
risk: high
area: ai
---

## Goal

Make Konling answers citation-first and environment-aware: development may show full citation diagnostics in the stream, production must keep raw diagnostics out of the student-visible answer while preserving complete citation/debug metadata in records, and missing learner personalization data must not block content-grounded citations.

## Scope

- Gate Konling streaming citation-debug injection by environment and explicit support-debug override.
- Persist citation guard, missing-context, retrieval-source, and personalization-availability metadata for streaming chat and session-message routes.
- Refine citation requirements by answer intent so ordinary concept explanations can cite content without learner-state or path-execution evidence.
- Treat missing learner-state/path-execution as limited personalization unless the answer makes personalized diagnosis, path, grading, report, or intervention claims.
- Add focused runtime and route tests for production, development, concept explanation, and personalized-answer behavior.

## Out of Scope

- Enabling production learner-state service configuration; that belongs to `enable-production-learner-state-runtime`.
- Replacing the RAG/hybrid retrieval stack or changing corpus ingestion.
- Changing model-provider configuration, prompt-provider selection, or deployed API keys.
- Implementing UI redesign for the Konling dock or knowledge graph page.

## Acceptance Checklist

- [ ] AC-1: Development streaming responses for any authenticated development user account can include complete citation diagnostics when debug injection is enabled. Owner: independent reviewer.
  Evidence: focused route or unit tests covering development/default-on and explicit debug cases.
- [ ] AC-2: Production streaming responses do not inject raw citation diagnostic text into student-visible assistant content by default, while the same diagnostic metadata remains persisted for review. Owner: independent reviewer.
  Evidence: route-source or integration tests proving no raw diagnostic tokens in visible text and persisted metadata still contains guard, missing-context, retrieval-source, and personalization details.
- [ ] AC-3: Graph-center concept explanations return verified teaching-content citations even when learner-state and path-execution data are missing. Owner: independent reviewer.
  Evidence: Konling runtime tests for a concept-explanation intent with content citations and missing learner/path evidence.
- [ ] AC-4: Personalized diagnosis and path-advice answers degrade to limited personalization when learner evidence is absent instead of failing content citation generation. Owner: independent reviewer.
  Evidence: Konling runtime tests for diagnosis/path-advice intents that record limited-personalization status and preserve available content citations.
- [ ] AC-5: The OpenSpec change remains valid. Owner: independent reviewer.
  Evidence: `rtk openspec validate govern-konling-citation-debug-streaming --strict`.

## Tasks

- [ ] Task 1: Define and apply the Konling citation debug injection policy.
  Covers: AC-1, AC-2
  Acceptance: The policy defaults to development-visible diagnostics and production-hidden diagnostics, with an explicit override for support debugging.
  Evidence: Tests or source checks covering development, production, and explicit override behavior.
  Reviewer Check: Confirm the policy is server-side, environment-aware, and cannot leak raw diagnostics in production by default.
- [ ] Task 2: Refactor the streaming citation guard around intent-scoped requirements.
  Covers: AC-3, AC-4
  Acceptance: `buildKonlingStreamingCitationGuard` no longer treats stream-final uncertainty or missing learner/path context as unconditional user-visible low confidence for every answer.
  Evidence: Runtime tests for concept explanation, personalized diagnosis, and path advice.
  Reviewer Check: Confirm content-citation requirements and learner-evidence requirements are separated by answer intent and claim scope.
- [ ] Task 3: Persist citation and personalization metadata for both chat entrypoints.
  Covers: AC-2, AC-4
  Acceptance: Streaming chat and session-message records retain guard metadata, missing-context metadata, retrieval source summaries, and personalization availability without requiring raw stream injection.
  Evidence: Route tests, integration tests, or source-level assertions for `/api/ai/chat` and `/api/ai/sessions/[id]/messages`.
  Reviewer Check: Confirm production reviewers can inspect metadata after the answer while students do not see diagnostic prefixes by default.
- [ ] Task 4: Add regression verification for citation-first fallback behavior.
  Covers: AC-1, AC-2, AC-3, AC-4, AC-5
  Acceptance: The implementation has automated coverage for debug injection, production hiding, concept explanation citations, and limited-personalization degradation, and the OpenSpec change validates strictly.
  Evidence: Focused test command outputs and `rtk openspec validate govern-konling-citation-debug-streaming --strict`.
  Reviewer Check: Confirm evidence covers every AC and that no AC is checked without independent review.

## Agent Guardrails

- Only execute this issue's change.
- Coordinate with sibling issues in the `konling-citation-personalization` coupling group before editing shared Konling runtime files.
- Implementation agents may propose satisfied AC ids with evidence, but must not check Acceptance Checklist items themselves.
- Check AC items only after an independent reviewer confirms the linked task evidence.
- Use the claim branch named in front matter.
- Do not execute `enable-production-learner-state-runtime` in this issue.
- Stop if dependency, coupling group, or branch constraints fail.
- Stop if GitHub blockedBy relationships still contain open blockers.
