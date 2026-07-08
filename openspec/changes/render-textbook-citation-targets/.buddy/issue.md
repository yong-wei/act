---
change_id: render-textbook-citation-targets
claim_branch: render-textbook-citation-targets
series: konling-citation-personalization
coupling_group: konling-citation-personalization
execution_mode: isolated
base_branch: integration
required_branch:
depends_on: []
parent_issue:
blocked_by: []
blocking: []
openspec_path: openspec/changes/render-textbook-citation-targets
risk: medium
area: ai
---

## Goal

Make Konling textbook citation clicks open rendered, human-readable source pages instead of raw runtime Markdown chunks, while preserving canonical citation metadata for audit and verification.

## Scope

- Add or wire a rendered textbook citation reader for runtime textbook chunks, sections, and anchors.
- Reuse or extract the existing interactive handout Markdown rendering path for formatted Markdown, formulas, tables, links, and images.
- Route Konling/Source Pack textbook citation display hrefs to the rendered reader while retaining canonical `/course-runtime/**` hrefs.
- Hide machine-only comments and image-description prose from learner-visible citation pages.
- Add browser and unit evidence that rendered citations do not regress to raw chunk output.

## Out of Scope

- Answer relevance, citation ranking, or Source Pack candidate selection. That remains owned by `govern-konling-answer-citation-relevance`.
- Removing image descriptions from runtime search documents, textbook chunks, or machine retrieval corpora.
- Replacing `/course-runtime/**` static raw asset serving.
- Re-authoring the textbook corpus or large-scale semantic field completion.

## Acceptance Checklist

- [ ] AC-1: Textbook Source Pack/Konling citations expose a student-facing rendered display href while preserving canonical runtime href, citation target id, source id, answer-relevance audit metadata, missing or downgraded citation reason, limitation, privacy scope, freshness, and confidence metadata. Owner: independent reviewer.
  Evidence: focused unit tests and implementation diff covering citation hydration/adaptation and Konling presentation payloads, including fixtures that carry relevance audit metadata.
- [ ] AC-2: Rendered textbook citation pages display formatted Markdown, formulas, tables, links, and real images while hiding raw comments, raw Markdown image syntax, and visible machine-only image-description prose. Owner: independent reviewer.
  Evidence: renderer tests plus timestamped browser screenshots or recording-grade artifacts for an image-containing textbook chunk, proving images are visibly loaded.
- [ ] AC-3: `/course-runtime/**` continues to serve raw runtime assets and is not converted into the learner-facing HTML reader. Owner: independent reviewer.
  Evidence: route regression test or focused request assertion for a Markdown runtime asset.
- [ ] AC-4: The implementation reuses or extracts the shared handout/runtime Markdown renderer instead of creating an unrelated citation-only Markdown rendering stack. Owner: independent reviewer.
  Evidence: diff review and a handout-rendering regression or reviewer confirmation that existing handout behavior is preserved.
- [ ] AC-5: Rendered citation target resolution is path-safe and rejects traversal, unsupported extensions, restricted targets, and model-authored fallback links. Owner: independent reviewer.
  Evidence: unit tests for safe and unsafe reader targets plus diff review of resolver boundaries.
- [ ] AC-6: Browser/visual evidence proves a Konling textbook citation chip or citation panel opens the rendered reader and does not show raw corpus leakage. Owner: independent reviewer.
  Evidence: timestamped desktop and 320px mobile screenshots or recording-grade artifacts showing the actual Konling citation chip or citation panel click path opening the rendered reader; direct reader-route screenshots are only supplementary.
- [ ] AC-7: Display href generation does not change `konling-answer` selection, ranking, omitted-citation, or no-relevant-citation downgrade semantics. Owner: independent reviewer.
  Evidence: Source Pack and Konling relevance regression tests using fixtures that include canonical href, rendered display href, and answer-relevance audit metadata.
- [ ] AC-8: OpenSpec and Buddy contracts remain valid. Owner: independent reviewer.
  Evidence: `rtk openspec validate render-textbook-citation-targets --strict` and Buddy issue-body validation pass.

## Tasks

- [ ] Task 1: Define and implement the rendered textbook citation reader route and safe target resolver.
  Covers: AC-2, AC-3, AC-5
  Acceptance: Runtime textbook chunk, section, and supported anchor targets resolve through an allowlisted reader route; unsafe paths and unsupported targets fail closed; `/course-runtime/**` remains raw.
  Evidence: route/resolver tests and static route regression.
  Reviewer Check: Confirm resolver cannot read arbitrary files and raw runtime routes are unchanged.
- [ ] Task 2: Extract or share the runtime Markdown renderer used by interactive handouts.
  Covers: AC-2, AC-4
  Acceptance: Citation reader and handout surfaces share the renderer family for Markdown, GFM, math, KaTeX, links, and runtime images; renderer policy hides citation comments and machine image descriptions in citation mode.
  Evidence: renderer tests, handout regression, and diff review.
  Reviewer Check: Confirm no duplicate ad hoc Markdown renderer is introduced for textbook citations.
- [ ] Task 3: Extend Source Pack citation metadata for canonical href and rendered display href.
  Covers: AC-1, AC-5, AC-7
  Acceptance: Textbook citations carry both canonical runtime href and rendered display href; relevance audit metadata, missing/downgraded reason, limitation, privacy, confidence, and freshness metadata survive serialization; unavailable or unsafe targets preserve limitation state without synthesizing model-authored links.
  Evidence: Source Pack citation hydration/adaptation tests with fixtures carrying answer-relevance audit metadata.
  Reviewer Check: Confirm canonical href is retained for audit, display href is only generated from server-owned metadata, and relevance metadata is not overwritten.
- [ ] Task 4: Wire Konling citation presentation to rendered textbook display hrefs.
  Covers: AC-1, AC-6, AC-7
  Acceptance: Konling citation chips/panel use rendered display hrefs for textbook citations while retaining canonical metadata, relevance audit metadata, missing/downgraded reasons, confidence/freshness/limitation state, and diagnostics.
  Evidence: Konling citation presentation tests and browser evidence.
  Reviewer Check: Confirm non-textbook citation behavior, unavailable states, and relevance-governed omitted citation states remain compatible.
- [ ] Task 5: Add image-containing chunk rendering coverage.
  Covers: AC-2, AC-6
  Acceptance: A chunk such as `ch01-advanced-problems-031__chunk-001` renders formatted text and the referenced image; visible learner output does not include raw image URL text or `Image description` prose.
  Evidence: focused renderer test and timestamped browser artifacts from the real Konling citation click path at desktop and 320px mobile widths, showing loaded images.
  Reviewer Check: Confirm image descriptions remain available to retrieval/search artifacts and are only hidden from human-visible reader output.
- [ ] Task 6: Run validation and prepare review evidence.
  Covers: AC-3, AC-4, AC-5, AC-7, AC-8
  Acceptance: OpenSpec validation, Buddy issue-body validation, focused unit tests, relevance regression tests, typecheck, and visual/browser evidence pass or any unrelated pre-existing debt is documented.
  Evidence: command output and artifact paths in the implementation summary.
  Reviewer Check: Confirm every AC has independent evidence and no AC is self-approved by the implementation thread.

## Agent Guardrails

- Only execute this issue's change.
- Implementation agents may propose satisfied AC ids with evidence, but must not check Acceptance Checklist items themselves.
- Check AC items only after an independent reviewer confirms the linked task evidence.
- Use the claim branch named in front matter.
- Do not execute other planned OpenSpec changes.
- Stop if dependency, coupling group, or branch constraints fail.
- Stop if GitHub blockedBy relationships still contain open blockers.
