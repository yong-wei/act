## Context

The current six-change platform series covers protocol, replay, evidence sources, Arena registry, scene shell structure, and course-resource launch. The professional report also requires a later P2 layer: simulation feature store, adaptive recommendation, and teacher diagnostic reporting. Existing specs already define feature cache, personalization, and teacher evidence governance; this change modifies those capabilities instead of creating a parallel feature-store truth source.

## Goals

- Convert governed simulation/Arena summaries into deterministic per-student feature-cache fields.
- Make simulation/Arena features usable by profile and recommendation consumers with reason metadata.
- Make teacher class/student insight APIs surface simulation/Arena evidence coverage, weak metrics, replay confidence, and low-confidence states.
- Avoid raw high-frequency trace scans in normal profile/recommendation paths.

## Non-Goals

- No new AI recommendation engine.
- No full data warehouse.
- No raw trace payload duplication into the feature cache.
- No teacher dashboard redesign beyond the evidence payload contract.

## Design

Feature cache rebuild should read governed facts, snapshots, and compact simulation/Arena context. Candidate derived fields include scene/task counts, completion status, recent/all-time metric summaries, weak metric ids, replay checksum confidence, official/preview distinction, evidence windows, and source coverage.

Personalization consumers may use these features to explain weak areas and next resources, but they must expose confidence and avoid treating context-only events as competency evidence. The recommendation rationale should identify whether a claim came from official evaluation, course-launched simulation completion, standalone simulation, or preview-only evidence.

Teacher evidence governance should aggregate class-level coverage and student-level summaries without leaking hidden official evaluation internals or raw trace payloads. Drilldown should show trace references and replay confidence only within the teacher's authorized class/course scope.

## Risks

- Feature fields can become too broad. Keep the first implementation to compact summaries that existing consumers can explain.
- Preview evidence can be overstated. Preserve official, preview, standalone, and course-launched provenance.

## Verification

- Feature-cache rebuild tests for deterministic simulation/Arena-derived fields.
- Personalization rationale tests for confidence and source coverage.
- Teacher insight tests for scoped simulation/Arena coverage and hidden-data protection.
- Gate with `rtk proxy openspec validate materialize-simulation-features-for-personalization --strict`.
