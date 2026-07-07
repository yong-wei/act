## Overview

This change introduces the catalog boundary. It does not decide that every registered item is safe for adaptive learning. It makes item source, eligibility, and audit state explicit so later changes can review and select items without guessing.

## Catalog Sources

The catalog must include at least:

- the existing 50 `PRESET_QUESTIONS`;
- existing Prisma `Question` records used by the generic question table;
- parsed static question files under `course-content/questions/questions/AC-Q-*.json`, currently 167 items;
- iCourse objective-bank artifacts under `course-content/questions/objective-bank/icourse-bank-bankType4.*`, currently 226 items according to `icourse-bank-bankType4.index.json`;
- generated adaptive practice questions;
- reviewed K/A/Q foundation-bank items under `course-content/runtime/resource-governance/`;
- future manually authored checkpoint items.

If a source cannot be fully imported yet, the catalog must still report its manifest or index-derived count where available, source family, import blocker, and reason it is not path-eligible. If a legacy or external "188-question" source is later found, it must be registered as its own source family with a concrete path or manifest rather than folded into the current 167-item AC-Q or 226-item iCourse banks.

## Item Identity

Each catalog entry must expose:

- stable catalog item id;
- source family and source record id or file anchor;
- immutable content hash and hash algorithm;
- stem, answer choices, answer key, and rubric references where available;
- LearningGoal, K/A/Q, graph-node, misconception, remediation, difficulty, cognitive-level, and stage fields when known;
- review state, reviewer audit, and metadata version refs;
- eligibility flags for low-stakes practice, readiness, checkpoint, remediation, and terminal-validation support.

Historical `AdaptiveAssessmentItemRef` records remain answer-time snapshots. They may reference a catalog item id and content hash, but catalog updates must not rewrite historical answer evidence.

## Eligibility States

The catalog must distinguish:

- `registered`: known source item, not necessarily complete;
- `imported-unreviewed`: content available but semantic fields not human-reviewed;
- `generated-provisional`: generated practice item with limited evidence authority;
- `semantically-reviewed`: manually reviewed fields are complete;
- `path-eligible`: reviewed and allowed by LearningGoal/stage policy;
- `deprecated`: retained for history but not selectable.

Only `path-eligible` items may satisfy readiness, checkpoint, or terminal-validation policies. Low-stakes practice may use provisional items only when the response clearly records degraded confidence.

## Runtime Artifacts

The implementation should emit machine-readable artifacts that downstream work can consume:

- a catalog manifest with source totals and version refs;
- a catalog item JSONL snapshot;
- a limitation report for missing source imports, missing semantic fields, and non-eligible items.

These artifacts should be deterministic, small enough for review, and aligned with existing resource-governance artifact conventions.
