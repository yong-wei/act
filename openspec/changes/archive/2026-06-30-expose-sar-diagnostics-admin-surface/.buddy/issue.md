---
change_id: expose-sar-diagnostics-admin-surface
claim_branch: expose-sar-diagnostics-admin-surface
series: structured-associative-retrieval
coupling_group: structured-associative-retrieval
execution_mode: isolated
base_branch: integration
required_branch:
depends_on: []
parent_issue:
blocked_by: []
blocking: []
openspec_path: openspec/changes/expose-sar-diagnostics-admin-surface
risk: medium
area: data-governance
---

## Goal

Expose the existing SAR diagnostics report as an administrator-visible data-governance surface, while preserving SAR privacy boundaries and cleaning the archived SAR spec Purpose placeholder.

## Scope

- Add a visible SAR diagnostics panel or linked admin route from `/admin/data-governance`.
- Render existing `sarDiagnostics` metrics, trace summaries, Source Pack handoff, verified citation rate, privacy rejections, limitations, and demo fixture status.
- Add explicit absent/degraded state for missing SAR diagnostics.
- Add tests that prove private raw fixture strings are not rendered.
- Replace the archived `structured-associative-retrieval` spec Purpose placeholder with stable descriptive text.

## Out of Scope

- No new SAR association algorithm.
- No Prisma SAR tables or production asynchronous SAR indexing.
- No Source Pack ranking, citation verifier, Konling tool, or path-planner authority changes.
- No automatic writeback from SAR candidates into K/A/Q graph bindings.

## Acceptance Checklist

- [ ] AC-1: Admin data governance has a visible SAR diagnostics entry point or panel. Owner: independent reviewer.
  Evidence: targeted admin UI/unit test or DOM/browser evidence showing SAR event/entity/relation counts and demo fixture status.
- [ ] AC-2: The SAR diagnostics surface renders trace and citation-health signals safely. Owner: independent reviewer.
  Evidence: test output showing Source Pack handoff, verified citation rate, privacy rejection or limitation summaries, and no raw restricted fixture strings.
- [ ] AC-3: Missing SAR diagnostics do not look healthy by default. Owner: independent reviewer.
  Evidence: test covering absent/degraded `sarDiagnostics` state.
- [ ] AC-4: The archived SAR spec Purpose is no longer placeholder text. Owner: independent reviewer.
  Evidence: file diff, `rtk openspec validate expose-sar-diagnostics-admin-surface --strict`, and `rtk openspec validate structured-associative-retrieval --type spec --strict`.

## Tasks

- [ ] Task 1: Render SAR diagnostics in the admin data-governance surface.
  Covers: AC-1, AC-2
  Acceptance: `/admin/data-governance` or its linked route exposes SAR counts, trace summaries, Source Pack handoff, verified citation rate, privacy rejections, limitations, and demo fixture status from the existing status payload.
  Evidence: targeted UI/unit test or DOM/browser evidence.
  Reviewer Check: Confirm the UI is visible to administrators and does not require inspecting raw JSON.
- [ ] Task 2: Add safe unavailable state for missing SAR diagnostics.
  Covers: AC-3
  Acceptance: missing `sarDiagnostics` produces explicit unavailable/degraded copy or state, not a healthy default.
  Evidence: focused test for missing payload.
  Reviewer Check: Confirm absence of diagnostics is not represented as success.
- [ ] Task 3: Enforce privacy-safe rendering.
  Covers: AC-2
  Acceptance: rendered output omits raw learner answers, hidden Arena internals, private Konling memory, and raw audit-only trace payloads.
  Evidence: tests asserting forbidden fixture strings are absent.
  Reviewer Check: Confirm SAR candidate refs are not displayed as verified citations.
- [ ] Task 4: Replace SAR spec Purpose placeholder.
  Covers: AC-4
  Acceptance: `openspec/specs/structured-associative-retrieval/spec.md` has a meaningful Purpose describing SAR boundaries.
  Evidence: file diff plus `rtk openspec validate expose-sar-diagnostics-admin-surface --strict` and `rtk openspec validate structured-associative-retrieval --type spec --strict`.
  Reviewer Check: Confirm the Purpose does not expand this change into second-stage persistence or ranking work.

## Agent Guardrails

- Only execute this issue's change.
- Implementation agents may propose satisfied AC ids with evidence, but must not check Acceptance Checklist items themselves.
- Check AC items only after an independent reviewer confirms the linked task evidence.
- Use the claim branch named in front matter.
- Do not execute other planned OpenSpec changes.
- Stop if dependency, coupling group, or branch constraints fail.
- Stop if GitHub blockedBy relationships still contain open blockers.
