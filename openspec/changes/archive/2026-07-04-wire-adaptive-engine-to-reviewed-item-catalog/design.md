## Overview

This change switches runtime selection to reviewed catalog items without losing the existing persistence guarantees. The selection layer should be strict for path-owned assessment nodes and conservative for generic practice.

## Selection Inputs

The selection service should consume server-owned context:

- authenticated student;
- LearningGoal id and version;
- path id and node id when launched from a path;
- assessment stage or purpose;
- learner-state slice and weak target hints when available;
- asked and answered catalog item ids or historical question ids;
- coverage matrix version and catalog version.

Client-provided goal or path hints may help routing, but server-owned path/session state remains authoritative.

## Candidate Filtering

For path-scoped readiness, checkpoint, remediation, or terminal-validation support, candidates must be:

- present in the catalog;
- current by source hash and version refs;
- semantically reviewed;
- path-eligible for the requested LearningGoal and stage;
- compatible with path policy, learner readiness, and retry rules;
- not already asked when unasked candidates remain.

For generic low-stakes practice, generated or provisional items may still be used when the response and evidence carry limited authority.

## Persistence

When an item is selected, `AdaptiveAssessmentItemRef` should snapshot the catalog item id, content hash, semantic metadata, review state, eligibility state, and version refs used at selection time. Existing answer restore logic should continue to work for historical refs that predate the catalog.

## Fallbacks

If reviewed catalog coverage is incomplete, the runtime should return a low-resource or limited-confidence state according to policy. It should not silently substitute generated items for readiness or checkpoint coverage.

## Validation

Tests should cover every current path-ready LearningGoal, including cold start and path-launched assessment contexts. They should also cover duplicate prevention, stale item rejection, historical snapshot restoration, and provisional practice downgrade.
