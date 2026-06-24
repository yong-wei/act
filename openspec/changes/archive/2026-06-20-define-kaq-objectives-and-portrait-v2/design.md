## Overview

This change establishes a semantic contract before any graph-center UI work. Objectives describe teaching intent; graph nodes describe knowledge, capability, or quality structures; learner state remains an overlay derived from evidence. The important boundary is that portrait v2 is a reporting and aggregation layer, not a replacement for existing stored six-dimensional learner state.

## Objective Domains

- `knowledge`: stable course facts, concepts, methods, formulas, criteria, models, and cases.
- `capability`: observable mastery expectations over knowledge nodes, including Bloom-style level, behavior verb, task context, and success criteria.
- `quality`: engineering disposition and responsibility objectives, expressed through scenario, observable behavior, rubric levels, and evidence sources.

Each objective has an id, domain, level, explicit parent id or null, title, description, course module, portrait dimensions, evidence policy, graph binding policy, and status.

## Portrait v2

The new portrait version has seven dimensions:

- `controlModelingRepresentation`
- `systemAnalysisInterpretation`
- `controllerDesignSynthesis`
- `simulationValidationEvidence`
- `engineeringConstraintSafety`
- `transferIntegratedApplication`
- `reflectionImprovementAiCollab`

The current six dimensions remain authoritative for existing snapshots. Compatibility functions map old dimensions, secondary learner-state dimensions, and registered goal-slice dimensions into the seven v2 dimensions with explicit confidence and limitation metadata.

## Validation

Validation should check objective id uniqueness, parent validity, domain-level consistency, portrait dimension validity, and evidence/graph binding presence. Tertiary objectives must not be accepted if they lack an evidence policy or graph binding.

## Non-Goals

- No Prisma migration.
- No rewrite of `AdaptiveLearnerState`.
- No page work.
- No automatic conversion of historic snapshots.
