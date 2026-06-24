## Context

Existing path code already supports policy families, path bundles, selection history, execution, deviation, intervention, and terminal validation semantics. Existing prep-pack code supports candidate generation, review states, enhancement pack creation, activation, rollback, archive, overlay merge, and impact evidence. The missing layer is a cohesive user workflow.

## Goals / Non-Goals

**Goals:**

- Provide a student-facing path comparison and execution experience tied to diagnosis.
- Record selection evidence without treating selection alone as mastery.
- Provide a teacher-facing prep-pack review and activation flow tied to class diagnosis.
- Capture overlay impact evidence for effect reports.

**Non-Goals:**

- No reinforcement-learning or bandit planner rollout.
- No automatic publishing of prep-pack items without teacher approval.
- No mutation of base runtime lesson content.
- No final competition screenshot polish.

## Decisions

- Reuse existing path choice evidence rather than adding a standalone `PathSelectionSignal` table unless implementation proves the current payload is insufficient.
- Use the path center as the product abstraction. It should surface bundle diversity, resource mix, effort, terminal validation, and limitations without exposing internal scoring weights.
- Treat prep-pack activation as scoped overlay state. Every active item must be reversible, class/session scoped, and auditable.
- Keep Konling advisory. Path advisor and prep coauthor can explain and draft suggestions, but cannot approve grading, publish prep items, or mutate runtime content.

## Risks / Trade-offs

- Path cards can become cosmetic variants -> require distinct resources, effort, modality, and terminal validation metadata.
- Overlay activation can be confused with content authoring -> show runtime diff and maintain base manifest immutability.
- Student selection can be overinterpreted -> keep selection as preference evidence only; execution and terminal validation drive learning-state changes.
