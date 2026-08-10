## Series Dependencies

- Depends on: `introduce-versioned-act-teaching-projection`, `project-active-course-resources-to-canonical`.

## 1. Core-node authoring

- [x] 1.1 Define `core-nodes.yaml` schema and deterministic denominator selection from objectives, primary COVERS, endpoints, and teacher curation.
- [x] 1.2 Populate an initial candidate inventory with scope, path/card policy, module, rationale, and source evidence.

## 2. Prerequisite authoring and builder

- [x] 2.1 Define direct ACT_TEACHING edge schema with REQUIRED/RECOMMENDED strength, evidence refs, curator rationale, and status.
- [x] 2.2 Implement endpoint, scope, self-loop, duplicate, and REQUIRED cycle validation plus deterministic closure/topological output.
- [x] 2.3 Add fixtures proving engineering relations, textbook order, and lesson order remain candidates only.

## 3. Publication gate

- [x] 3.1 Record one author decision/evidence rationale for every published edge and bind it to the current Authority/Projection capture.
- [x] 3.2 Emit fail-closed diagnostics and preserve the prior artifact on invalid input or drift.

## 4. Verification

- [x] 4.1 Run focused core-node, prerequisite DAG, evidence, determinism, and failure-path tests.
- [x] 4.2 Run `rtk openspec validate publish-core-teaching-prerequisites --type change --strict` and `rtk openspec validate --changes --strict`.
