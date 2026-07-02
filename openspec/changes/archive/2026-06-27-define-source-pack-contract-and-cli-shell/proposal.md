## Why

Course resources now include textbooks, references, runtime lessons, figures, transcripts, knowledge cards, exercises, and governed learner evidence. Lesson and homework authoring, Konling answers, and adaptive path planning all need compact cited context, but they must not each implement a separate retrieval protocol or read raw authoring Markdown directly.

## What Changes

- Define a shared Source Pack contract for governed retrieval evidence packages.
- Define profile-aware Source Pack query and output metadata without implementing full retrieval ranking in this change.
- Add a CLI shell that calls the shared Source Pack core and can write JSON, Markdown, and audit outputs.
- Require every Source Pack item to retain stable citation/provenance identifiers rather than model-authored URLs or raw file line numbers.

## Capabilities

### New Capabilities

- `source-pack-retrieval`: Governed Source Pack contract and thin CLI shell for evidence package generation.

### Modified Capabilities

- None.

## Impact

- Proposed modules: `src/lib/source-pack/*`, `scripts/source-pack/source-pack-cli.ts`, package script for `source:pack`.
- Proposed tests: Source Pack type/schema, serializer, CLI argument validation, output round-trip, contract fixture tests.
- Downstream changes in this series will adapt governed corpora, implement hybrid ranking, and connect consumers.
