## Context

The completed interview defines one contest scenario but the implementation crosses six independently reviewable boundaries. This parent preserves the shared architecture and dependency graph while executable design details live in child changes.

## Goals / Non-Goals

**Goals:**

- Keep one coherent product contract across source ingestion, plan generation, slide runtime, courseware editing, publication, classroom execution, and PDF export.
- Make each child independently claimable, testable, reviewable, revertible, and deliverable through one Issue, branch, PR, and archive.
- Allow source ingestion and slide-runtime foundations to proceed independently.
- Keep contest completion distinct from code archive by tracking natural-language multi-turn acceptance, content-quality evidence, source rights, and target-user feedback.

**Non-Goals:**

- Implement product behavior directly in this parent.
- Let a child silently redefine shared terminology, privacy, citation, version, or publication semantics.
- Make P1 PDF export block P0 classroom publication.

## Decisions

### 1. Use a dependency-ordered six-child series

`add-teacher-course-basis-management` and `standardize-generated-courseware-slide-runtime` are independent foundations. `add-smart-lesson-plan-authoring` depends on the course-basis child. `add-smart-courseware-generation-editor` depends on both the plan and slide-runtime children. `publish-smart-courseware-to-classroom` depends on the editor. `export-smart-courseware-pdf` is P1 and depends on publication.

### 2. Keep capability ownership exclusive

Each new capability is introduced by exactly one child. Publication is separated from authoring as `smart-courseware-publication`, preventing two active changes from adding partial requirements to one not-yet-archived capability.

### 3. Preserve cross-series invariants

All children SHALL use teacher ownership, immutable source/plan/courseware version identity, existing `lesson-design` Source Packs, SAR only as candidate expansion, server-owned citations, Provider Registry routing, deterministic publication gates, and the existing classroom runtime. Natural-language intake SHALL reuse the existing Konling session and teacher `prep-coauthor` mode rather than create a second chat stack. ADRs 0001–0014 remain the decision record.

### 4. Define P0 and P1 completion separately

P0 completes when children 1–5 are archived and the real-provider root-locus demonstration proves natural-language task creation, ambiguity clarification, a later-turn constraint revision, zero unresolved goal/module source gaps, three authoritative content-quality cases, classroom runtime, source-rights provenance, and feedback from at least two target users with usage/effect records. P1 completes when child 6 is archived. The parent closes only after all six declared children are archived unless the parent scope is explicitly revised.

## Risks / Trade-offs

- [Cross-child drift] -> Each child references the parent, uses exclusive capability ownership, and validates dependencies before claim.
- [Foundation changes merge in incompatible forms] -> The editor child cannot start until both plan and slide-runtime specs are archived and verified.
- [Parent is mistaken for executable work] -> Buddy triage marks it `series-parent`, proposal review lists all children, and its Issue uses tracking-only tasks.

## Migration Plan

Create and validate all child proposals before any GitHub Issue mutation. Create the parent tracking Issue and child Issues with explicit parent/dependency relationships. Claim only executable children whose blockers are archived. Close the parent after Buddy verifies all children archived.

## Open Questions

None.

## Testing Strategy
Change class: documentation
Seam status: not-applicable
Public behavior: none
Public seam: Buddy proposal-shape, Issue-body, relationship, dependency, and archived-child verification together with strict OpenSpec validation of the parent and every child.
Existing seam reused: OpenSpec strict validation and OpenSpec Buddy proposal, metadata, relationship, and status validators.
AC coverage: AC-1: local metadata and proposal validation verifies the six declared executable children and exclusive capability ownership; AC-2: dependency metadata validation verifies the intended graph and parallel foundation boundary.
Manual-only acceptance: AC-3: real-provider behavior, source-rights provenance, and authentic target-user feedback cannot be established by repository automation alone | verify all six child archives plus the timestamped P0 demonstration, three authoritative source comparisons, source-rights manifest, and at least two target-user usage and effect records before closing the parent.
Rationale: This parent introduces no runtime behavior; correctness is the consistency of its child inventory, dependency graph, capability ownership, and Buddy tracking state, all of which have explicit machine-readable validators.
