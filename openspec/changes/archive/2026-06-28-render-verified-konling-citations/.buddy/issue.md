---
change_id: render-verified-konling-citations
claim_branch: render-verified-konling-citations
series: unified-source-pack-retrieval
coupling_group: unified-source-pack-retrieval
execution_mode: stacked
base_branch: integration
required_branch:
depends_on:
  - integrate-source-pack-consumers
parent_issue:
blocked_by: []
blocking: []
openspec_path: openspec/changes/render-verified-konling-citations
risk: high
area: ai
---

## Goal

Ensure Konling presents verified citations from server-owned metadata and Source Pack evidence instead of model-authored Markdown footnotes or current-page anchors.

## Scope

- Define the final Konling citation presentation contract from `konlingCitationGuard`, CitationChip, and Source Pack metadata.
- Sanitize or disable model-authored GFM footnotes and `#user-content-fn*` anchors in assistant messages.
- Render verified CitationChips or compact citation lists in global and local Konling message bubbles.
- Route citation clicks through platform-owned CitationAddress/CitationTarget behavior.
- Keep development streaming diagnostics separate from final user-facing citations.

## Out of Scope

- Source Pack retrieval ranking and corpus adapter implementation.
- Knowledge graph ability-target metadata completion.
- Production vector index or embedding rollout.

## Acceptance Checklist

- [ ] AC-1: Konling citations render from server-owned metadata, not model-authored Markdown footnotes. Owner: independent reviewer.
  Evidence: UI/rendering tests showing CitationChips or citation list derived from `konlingCitationGuard`/CitationChip/Source Pack metadata.
- [ ] AC-2: Assistant prose no longer exposes duplicate GFM footnotes or `/knowledge#user-content-fn*` anchors as verified citations. Owner: independent reviewer.
  Evidence: renderer tests for duplicate `[1]`, `[^content]`, and `#user-content-fn*` cases.
- [ ] AC-3: Citation clicks route to platform-owned targets or limitation states. Owner: independent reviewer.
  Evidence: tests for knowledge node, textbook/reference chunk, figure/image, restricted, and unavailable citation targets.
- [ ] AC-4: Streaming diagnostics and final citation verification are visually and semantically separate. Owner: independent reviewer.
  Evidence: tests or manual browser evidence for streaming diagnostic notice and final verified/limited citation state.

## Tasks

- [ ] Task 1: Add the Konling citation presentation payload and renderer contract.
  Covers: AC-1
  Acceptance: global and local Konling message bubbles render citations from metadata and ignore prose footnotes for verification.
  Evidence: component or route tests for citation metadata rendering.
  Reviewer Check: confirm model prose cannot create verified citation UI by emitting Markdown links.
- [ ] Task 2: Sanitize or disable fake Markdown citation footnotes.
  Covers: AC-2
  Acceptance: duplicate GFM footnotes and `#user-content-fn*` anchors are stripped, disabled, or normalized outside verified citation UI.
  Evidence: AI message content renderer tests.
  Reviewer Check: confirm safe ordinary links still render when they are not pretending to be verified citations.
- [ ] Task 3: Implement platform-owned citation click behavior.
  Covers: AC-3
  Acceptance: knowledge, textbook/reference, figure, restricted, and unavailable citations route or display limitations according to citation metadata.
  Evidence: click-target tests and accessibility assertions.
  Reviewer Check: confirm no fallback synthesizes `/knowledge#user-content-*` source links.
- [ ] Task 4: Separate streaming diagnostics from final citation state.
  Covers: AC-4
  Acceptance: development diagnostics remain diagnostic notices, while final messages show verified, limited, or missing citation state from metadata.
  Evidence: streaming/final message tests or browser evidence.
  Reviewer Check: confirm production-hidden diagnostics are not required for citation display.

## Agent Guardrails

- Only execute this issue's change.
- Implementation agents may propose satisfied AC ids with evidence, but must not check Acceptance Checklist items themselves.
- Check AC items only after an independent reviewer confirms the linked task evidence.
- Use the claim branch named in front matter.
- Do not execute other planned OpenSpec changes.
- Stop if dependency, coupling group, or branch constraints fail.
- Stop if GitHub blockedBy relationships still contain open blockers.
