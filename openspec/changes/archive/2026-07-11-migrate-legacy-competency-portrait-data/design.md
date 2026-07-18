## Design Notes

The migration should be explicit, auditable, and repeatable. It should not
blindly overwrite learner data. A migrated portrait v2 record should include:

- source legacy snapshot id or source evidence refs
- mapping version
- mapping confidence per dimension
- limitation notes where a legacy dimension maps to multiple portrait v2
  dimensions
- original snapshot timestamp
- migration timestamp
- dry-run summary and apply summary

Yang Fan fixture data must be treated as a test-data contract, not as a
production learner shortcut. The fixture should generate LearningFacts or
portrait v2 seed data that can survive normal worker recomputation. In
particular, if `diagnosticAssessment` remains a resource or assessment target,
it must be mapped into official portrait v2 dimensions before profile
calculation.

Duplicate Yang Fan accounts should not be merged or overwritten by display name
alone. Canonical student number and canonical email remain the identity anchor.

## Verification Strategy

- Dry-run migration report tests.
- Idempotent apply tests.
- Yang Fan fixture tests proving all seven portrait v2 dimensions are present
  after worker recomputation.
- Data-completeness helper checks for migrated/native/unmigrated states.
