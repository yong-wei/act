## Overview

PlanningUnit is the planner-facing learning action derived from a resource or segment. It must be understandable to a student and measurable by the system. It cannot be an arbitrary RAG chunk.

## Selection Signals

The planner should use:

- Knowledge node targets.
- Capability target levels.
- Prerequisites and readiness metadata.
- Estimated time and cognitive load.
- Resource modality and learner preference.
- Evidence instrumentation and completion behavior.
- Teacher policy and privacy scope.

## Dependency Boundary

This change does not redefine path launch, return, resume, selected option adoption, or completion writeback. It should depend on the active changes that own those behaviors.

## Risks

- Too-fine PlanningUnits can make paths unreadable.
- Too-coarse PlanningUnits preserve current resource-list behavior.
- Bypassing ResourceNode audit would regress existing path governance.
