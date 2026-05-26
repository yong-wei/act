## Overview

Replace overloaded readiness flags with a metric set that separates evidence
availability, scoring availability, snapshot coverage, post-class regeneration,
and cache freshness.

## Metric Families

- `participants`: students associated with the session.
- `loggedUsers`: students with InteractionLog evidence.
- `durableSubmissionCoverage`: StudentStepResponse coverage for required or
  submitted steps.
- `requiredEvidenceCoverage`: required evidence mapped by CourseEvidenceSpec.
- `scoreableEvidenceCoverage`: submitted evidence with reference answers or
  supported scorer inputs.
- `scoringCoverage`: submitted scoreable evidence with computed scoring result.
- `snapshotCoverage`: latest snapshot covers latest relevant fact.
- `postClassUpdateWindowCoverage`: snapshot or report work happened after the
  configured session-end window.
- `featureCacheFreshness`: student feature cache is fresh for the relevant
  evidence window.

## Snapshot Semantics

Snapshot coverage answers whether the latest student snapshot represents the
latest relevant LearningFact. Post-class regeneration answers whether the
refresh happened after class end or inside a configured post-class window. These
are different states and must not share one reason code.

## Consumer Migration

Reports and APIs should expose names that match the metric definitions. Legacy
fields may remain temporarily if they are derived from the new metric set and
documented as compatibility fields.

## Regression Coverage

Include a 5-3-like case where fact users have current latest snapshots but only
some snapshots were generated after session end. The result should show
snapshot coverage as satisfied and post-class regeneration as partial.
