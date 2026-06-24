## Context

Active changes will make control-correction Konling coaching citation-enforced and provider-normalized. The broader teaching assistant needs a shared corpus so diagnosis, grading, prep packs, and student feedback can cite the same governed source objects.

## Goals / Non-Goals

**Goals:**

- Define corpus chunk ownership, source types, privacy class, source href, span references, hash, freshness, and retrieval metadata.
- Support course content, knowledge cards, runtime handouts, path/evidence summaries, document-grading blocks, simulation/Arena summaries, and diagnosis/report materializations.
- Define retrieval and citation verification APIs or service contracts.
- Enforce role and scope checks before returning source text or display links.

**Non-Goals:**

- Choosing a permanent vector database.
- Replacing existing knowledge graph or resource registry.
- Letting model-generated citations bypass verification.

## Decisions

### Decision 1: Corpus chunks are governed evidence objects

Corpus entries must carry source type, source reference, privacy class, confidence, and display metadata. A free text embedding without provenance is not usable for teaching-assistant claims.

### Decision 2: Citation verification is independent from generation

The verifier must validate chunk id, source accessibility, owner scope, privacy class, and source-type compatibility after model generation.

### Decision 3: Retrieval is service-level, not UI-specific

Konling, grading, diagnosis, recommendation, and prep-pack services should call the same retrieval contract so citation behavior stays consistent.

## Validation

- Tests SHALL reject fake chunk ids and inaccessible private sources.
- Tests SHALL verify role-specific redaction for student and teacher retrieval.
- `rtk openspec validate build-learning-evidence-rag-corpus --strict` SHALL pass.
