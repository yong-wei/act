## Context

Teaching prerequisites are pedagogical decisions owned by ACT. The core denominator must be explainable and bounded: formal course objectives, primary COVERS nodes, prerequisite endpoints, and explicit teacher-selected backbone nodes. Existence in ActKG or a textbook is not enough.

## Series Dependencies

- Depends on: `introduce-versioned-act-teaching-projection`, `project-active-course-resources-to-canonical`.

## Goals / Non-Goals

**Goals:**

- Build a small, explicit, versioned ACT prerequisite DAG.
- Keep strength and evidence visible to downstream paths and reviewers.
- Fail closed on invalid endpoints, self-loops, cycles, missing evidence, or scope drift.

**Non-Goals:**

- Do not change ActKG relation semantics or convert `association`, `derived_from`, `has_component`, or engineering order into study prerequisites.
- Do not require every Authority node or every textbook section to be core.
- Do not implement path traversal or resource ranking here.

## Decisions

### 1. Core-node denominator

`core-nodes.yaml` includes nodes from current formal course objectives, primary `COVERS` resources, prerequisite endpoints, or explicit teacher-curation. Every row records scope, `pathEligible`, `cardPolicy` (`REQUIRED` or `OPTIONAL`), module, and rationale. A node merely mentioned by a textbook or present upstream is not included automatically.

### 2. Edge contract

Each direct edge contains `sourceNodeId`, `targetNodeId`, `layer: ACT_TEACHING`, `relationType: PREREQUISITE`, `strength: REQUIRED|RECOMMENDED`, scope, evidence refs, curator identity/rationale, and status. `REQUIRED` edges are hard path dependencies; `RECOMMENDED` edges are advisory.

### 3. Candidate and publication boundary

Legacy graph prerequisites, lesson/chapter order, explicit language in handouts, interactive dependency metadata, textbook order, and teacher proposals may create candidates. Publication requires one ACT evidence reference or explicit teacher-curation rationale and one author decision. No model similarity or upstream engineering edge alone can publish.

### 4. Validation and derived data

Builder verifies both endpoints exist in current Authority/core scope, rejects self-loops and scope mismatch, and topologically sorts REQUIRED edges. It stores direct edges only; closure and ordered views are deterministic derived fields. Any cycle or dangling endpoint rejects the full prerequisite artifact, not Authority.

## Risks / Trade-offs

- A narrow backbone may omit useful optional advice; RECOMMENDED edges provide a safe extension without hard-blocking paths.
- Teacher curation adds review work but preserves pedagogical authority and explainability.

## Migration Plan

Seed core nodes and candidate edges from current course resources, then perform one author confirmation per published edge. Build and validate the DAG in projection staging; leave path consumers on their prior state until the path-adoption change passes.

## Open Questions

None. Strength vocabulary and graph invariants are fixed.
