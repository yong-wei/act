## Tasks

- [x] 1. Run the completeness helper and define the resource completion batch.
  - Identify blocker buckets and select the first completion scope across graph nodes, textbooks, references, lessons, knowledge cards, quizzes, and simulations.

- [x] 2. Complete citation and graph binding fields.
  - Fill source hashes, citation targets, graph node refs, KAQ refs, LearningGoal refs, and route targets where applicable.

- [x] 3. Complete path-planning and evidence fields.
  - Add path profiles, evidence contracts, evidence instrumentation, readiness metadata, privacy policy, and review metadata for resources intended to become PlanningUnits.
  - Preserve Arena official scoring and ranking authority on ArenaSubmission and official evaluation records.

- [x] 4. Preserve citation-only boundaries.
  - Keep long-form textbook/reference chunks and media transcript chunks citation-ready without promoting them to path nodes unless separately reviewed as PlanningUnits.

- [x] 5. Regenerate runtime governance artifacts and rerun readiness checks.
  - Rebuild field completion audit, runtime projections, baseline matrices, and any affected Source Pack/RAG artifacts.

- [x] 6. Add targeted path planning and Konling citation tests.
  - Verify that paths include a reasonable mix of resource types and that Konling can cite governed resources from graph context.

- [x] 7. Validate the change.
  - Run `rtk openspec validate complete-graph-resource-semantic-coverage --strict`.
  - Run the completeness helper and targeted path/Konling tests.
  - Verify GitHub blockedBy relationships for downstream dependent changes after issues are created.
