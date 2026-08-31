# Design: Gate candidate path diversity and coverage

## Context

Candidate fingerprints already hash material facts (`nodeIds`, `estimatedMinutes`, `resourceMix`, checkpoints, terminal validation) and ignore labels. Persistence still keeps every generated option, including identical material facts with different titles.

## Goals / Non-Goals

**Goals:** Keep only executable candidates with observable material differences. Record coverage limitations when options are reduced.

**Non-Goals:** Do not rewrite scoring, mutate saved paths, or rank a “best path”.

## Decisions

### 1. Dedupe by material fingerprint

`buildCandidateSnapshots` keeps the first candidate for each material fingerprint. Label, description, score, and ordinal are not material.

### 2. Shared required nodes are allowed

Identical terminal/checkpoint node IDs alone do not reject a candidate if node order, remaining node identity, resource mix, or effort differs.

### 3. Honest reduction

If only one distinct material option remains, persist it and store `diversityLimitations` such as `title-or-score-only-duplicates-removed` or `insufficient-distinct-resources`.

## Risks / Trade-offs

- [Risk] 过度去重会只剩一条路径。→ 这是诚实降级，页面必须显示实际候选数和限制。
