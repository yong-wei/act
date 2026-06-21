## Overview

Versioning is the audit backbone for graph-driven planning. Any persisted artifact that claims "this path was generated because of these graph and resource facts" must store the versions used at generation time.

## Versioned Objects

The first implementation should define version refs for:

- LearningGoal catalog;
- K/A/Q objective catalog;
- K/A/Q graph catalog;
- ResourceNode registry;
- resource segment and projection manifests;
- learner/class/resource coverage overlays;
- path plan and path round artifacts;
- Konling graph grounding context.

## Artifact Metadata

Persisted artifacts should include:

- artifact id;
- artifact kind;
- generatedAt;
- version refs used;
- source snapshot refs when available;
- freshness state;
- limitations.

## Staleness

If a graph or resource version changes after a path or overlay is generated, the artifact remains explainable but may be marked stale. Staleness is a limitation, not a reason to rewrite history silently.

## Boundaries

This change defines versioning and replay references. It does not implement a full graph migration UI, historical diff UI, or automatic backfill for every legacy record.

## Validation

Tests should prove that new graph-driven path artifacts and overlay payloads include version refs, and that missing version refs block production writeback or produce governed limitations.
