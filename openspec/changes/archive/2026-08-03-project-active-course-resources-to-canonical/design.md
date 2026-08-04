## Context

ACT course content already has authoring-to-runtime generation and lesson/interactive manifests. This change supplies the first local Teaching Projection data, using only active production/rehearsal surfaces and existing crosswalk/card/knowledge fields. Historical or retired courses are intentionally outside the denominator.

## Series Dependencies

- Depends on: `introduce-versioned-act-teaching-projection`.

## Goals / Non-Goals

**Goals:**

- Produce deterministic course resource IDs, Canonical bindings, statuses, and evidence.
- Keep ambiguous mappings visible and fail closed for the affected course package.
- Preserve legacy IDs for history and rollback without allowing new authoring to write them.

**Non-Goals:**

- Do not scan every repository file or all ActKG members.
- Do not accept fuzzy similarity, model-only guesses, aggregate/profile metadata, or unsupported semantic merges automatically.
- Do not change Authority activation, textbook projection, prerequisite publication, card migration, or consumer activation in this change.

## Decisions

### 1. Scope and source inventory

The inventory includes only current published/used courses, runtime lessons, lesson plans, handouts, interactive manifests/steps, and classroom resources that can be reached by current course routes. Each row binds the authoring revision, source path/digest, course package, resource ID, and projection mode.

### 2. Authoring fields

Course/handout/lesson records declare `projectionMode: REQUIRED|OPTIONAL|NONE` and `knowledgeRefs[]` entries containing Canonical ID, role, optional primary flag, and source rationale. Step records use the same contract. Runtime output is generated and includes the resolved status and binding digest.

### 3. Mapping priority and ambiguity

Mapping priority is: (1) one-to-one old-ID crosswalk, (2) existing active card reference, (3) manifest knowledge field, (4) exact normalized label/alias match. Fuzzy, split, merge, conflicting, or evidence-poor matches become `REVIEW_REQUIRED` with candidate set and rationale. One course-author semantic decision resolves each ambiguous record; the decision is persisted in authoring and reused deterministically.

### 4. Gate scope

`REQUIRED` resources must be `BOUND`; `OPTIONAL` may be `EXPLICIT_NONE`; `NONE` is explicit non-semantic content. A `REVIEW_REQUIRED` item blocks only the course package whose runtime can reach it. Authority and other course packages remain independently usable.

## Risks / Trade-offs

- A narrow active inventory can leave legacy courses unmigrated; they remain on compatibility fallback and are not silently claimed as complete.
- Exact matching may produce more author decisions than fuzzy matching, but avoids false canonical identity.
- Crosswalks add durable files; they are needed to read historical facts and support rollback.

## Migration Plan

Generate inventory and dry-run report first, then write authoring knowledgeRefs for deterministic matches. Resolve ambiguous records once, rebuild runtime projection, and run per-course gates. Keep old runtime readers until the independent retirement change.

## Open Questions

None. The active-course scope and mapping priority are fixed by this change.
