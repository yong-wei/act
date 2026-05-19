## Context

Materialized facts make evidence durable, but they are not an efficient personalization interface by themselves. Existing profile and recommendation surfaces need concise, explainable, and rebuildable features rather than bespoke raw queries. This phase creates that read model while leaving actual recommendation behavior for a later change.

## Goals / Non-Goals

**Goals:**

- Define a student-level evidence feature cache contract.
- Refresh features deterministically from governed facts and approved aggregates.
- Track freshness, source windows, evidence counts, and confidence markers.
- Support full rebuild and per-student refresh.
- Provide internal read APIs for later profile and recommendation consumers.

**Non-Goals:**

- Changing recommendation algorithms or visible recommendation copy.
- Creating a new AI personalization engine.
- Materializing additional historical facts beyond the prior change.
- Letting UI consumers decide raw evidence eligibility.
- Replacing the six-dimension competency model.

## Decisions

### Decision 1: Cache is a read model, not a new source of truth

The cache summarizes governed evidence. It must be rebuildable from facts and approved aggregates, and it must not become the only location where evidence meaning exists.

### Decision 2: Freshness is part of the contract

Every cache entry must expose refresh time, evidence window, source coverage, and missing-source indicators so downstream recommendations can show confidence instead of pretending the profile is complete.

### Decision 3: Raw scans stay out of normal consumers

Profile and recommendation services should read the cache or governed facts. Raw table access remains acceptable only for audit, drilldown, or migration tooling.

### Decision 4: Deterministic rebuild is mandatory

The same governed evidence should produce the same cache payload. This allows test fixtures, rebuild jobs, and incident recovery to compare expected and actual feature state.

## Risks / Trade-offs

- [Risk] Cache schema can become too generic to be useful. -> Define concrete feature groups tied to existing evidence and current personalization needs.
- [Risk] Cache can drift from source facts. -> Add rebuild checks and freshness reporting.
- [Risk] Consumers may bypass the cache. -> Provide a small internal service boundary and make raw reads explicit exceptions.

## Migration Plan

1. Choose storage shape and feature payload contract.
2. Add refresh/rebuild logic from governed facts and approved aggregates.
3. Add admin-facing freshness and coverage reporting if practical.
4. Add tests for deterministic rebuild, stale data markers, and missing-source handling.
5. Leave consumer behavior changes for the evidence-driven personalization phase.
