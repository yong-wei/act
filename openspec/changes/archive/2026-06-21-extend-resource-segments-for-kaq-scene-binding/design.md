## Overview

ResourceNode remains the path eligibility contract. This change adds richer graph and scene metadata around ResourceNode projections so the same resource center can support path planning, Konling citations, diagnosis, grading, and prep-pack use without copying raw content or bypassing ownership.

## ResourceNode Graph Profile

A graph profile should be available from ResourceNode or ResourceSemanticProjection and include:

- linked graph node refs by domain;
- scene availability for `path`, `konling`, `diagnosis`, `grading`, `prep-pack`, and `report`;
- segment refs with stable anchors;
- citation readiness and verified-citation status;
- evidence capability and terminal validation role;
- path profile metadata such as estimated time, load, difficulty, and readiness;
- governance limitations.

## Segment Boundary

Segments may represent textbook sections, paragraphs, figures, slide pages, video clips, audio clips, images, exercises, simulation tasks, or Arena protocols. A segment can be retrievable or citable without being path eligible. Path eligibility is granted only when a ResourceNode projection yields a PlanningUnit or checkpoint contract.

## Videos Boundary

The `videos` repository is treated as an upstream media source. This change defines the manifest fields needed to ingest media later: source id, source path, transcript or chapter refs, timecode anchors, graph bindings, scene availability, citation policy, and AI-use permission. Full batch import, ASR, OCR, and manual media review remain later work.

## Governance

The semantic layer stores identity, refs, hashes, graph mappings, citation refs, readiness, and limitations. It must not store raw markdown body, raw chunk text, media bytes, private learner evidence, hidden Arena internals, or private Konling memory.

## Validation

Tests should prove that linked, retrievable, citable, and path-eligible states remain distinct. A chunk with a citation target must not become a PathNode unless the ResourceNode audit passes.
