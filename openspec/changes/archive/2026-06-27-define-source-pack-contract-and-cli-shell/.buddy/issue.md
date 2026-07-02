---
change_id: define-source-pack-contract-and-cli-shell
claim_branch: define-source-pack-contract-and-cli-shell
series: unified-source-pack-retrieval
coupling_group: unified-source-pack-retrieval
execution_mode: isolated
base_branch: integration
required_branch:
depends_on: []
parent_issue:
blocked_by: []
blocking: []
openspec_path: openspec/changes/define-source-pack-contract-and-cli-shell
risk: medium
area: ai
---

## Goal

Define the shared Source Pack contract and CLI shell so authoring workflows and server runtime consumers can use one governed evidence-package protocol.

## Scope

- Add Source Pack query, item, coverage, limitation, citation, access, and audit contracts.
- Add JSON/Markdown/audit serializers and a thin CLI entrypoint.
- Add contract and CLI smoke tests.

## Out of Scope

- Full governed corpus adapters.
- Hybrid retrieval ranking.
- Consumer integration for Konling, path planning, lesson, or homework workflows.

## Acceptance Checklist

- [ ] AC-1: Source Pack schema and serializers preserve stable citation and source ids. Owner: independent reviewer.
  Evidence: unit tests for JSON and Markdown serialization plus schema validation fixtures.
- [ ] AC-2: `source:pack` CLI shell delegates to shared core and writes valid output artifacts. Owner: independent reviewer.
  Evidence: CLI smoke test or scripted command showing JSON, Markdown, and audit outputs.
- [ ] AC-3: CLI failure or unavailable adapter states are structured limitations, not unmanaged raw Markdown fallback. Owner: independent reviewer.
  Evidence: negative test or fixture proving limitations/failure output.

## Tasks

- [ ] Task 1: Implement Source Pack types, validation, and serializers.
  Covers: AC-1
  Acceptance: generated packs retain stable ids, citation metadata, access metadata, scores, coverage, and limitations in JSON and Markdown.
  Evidence: targeted Source Pack schema and serializer tests.
  Reviewer Check: confirm no model-authored URL or raw file line number is treated as a verified citation target.
- [ ] Task 2: Add the `source:pack` script and CLI shell.
  Covers: AC-2
  Acceptance: CLI argument parsing calls the shared builder and writes requested output files.
  Evidence: CLI smoke test or scripted output in test fixtures.
  Reviewer Check: confirm retrieval logic is not embedded in the CLI script.
- [ ] Task 3: Add structured limitation handling for unsupported retrieval states.
  Covers: AC-3
  Acceptance: unavailable adapters or indexes produce valid limitations or structured failure.
  Evidence: negative test or fixture output.
  Reviewer Check: confirm there is no fallback path that scans raw authoring Markdown directly.

## Agent Guardrails

- Only execute this issue's change.
- Implementation agents may propose satisfied AC ids with evidence, but must not check Acceptance Checklist items themselves.
- Check AC items only after an independent reviewer confirms the linked task evidence.
- Use the claim branch named in front matter.
- Do not execute other planned OpenSpec changes.
- Stop if dependency, coupling group, or branch constraints fail.
- Stop if GitHub blockedBy relationships still contain open blockers.
