## Why

The canonical Yang Fan student account has answer records, learning paths, path executions, and Konling tool runs, but it lacks the governed derived learner-state records needed to test personalized graph, path-planning, Konling, and adaptive-answering behavior. The duplicate no-email Yang Fan account also makes account identity ambiguous.

Mock learner-state data should be added only after graph and resource coverage is complete enough for the account's tests to cite real resources. Otherwise the fixture would validate an artificial learner state against incomplete resource data.

## What Changes

- Add deterministic developer/test fixture generation for the canonical Yang Fan account after resource-data completeness gates pass.
- Report duplicate Yang Fan accounts and block apply/reset until they are resolved by an explicit human-reviewed account operation.
- Materialize governed LearningFact and learner-state records from existing answers, path executions, adaptive assessment evidence, and fixture-specific source references.
- Rebuild StudentEvidenceFeatureCache and related profile/snapshot records.
- Add tests that verify Yang Fan can exercise graph context, path planning, Konling citation, and adaptive answering flows.
- Enforce development/test-only execution, default dry-run behavior, explicit apply confirmation, database safety checks, and privacy-minimized logs.
- Preserve Arena official scoring and ranking authority; fixture-derived LearningFacts may support learning diagnosis but cannot create or overwrite official Arena results.

## Impact

- Adds or updates test/developer data scripts.
- Mutates local or configured development/test database data only through explicit fixture commands.
- Depends on the completeness helper and graph/resource semantic completion.
- Does not alter production data implicitly at app startup.
