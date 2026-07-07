## Overview

This change creates the workflow for human semantic review. Scripts may prepare review packets, detect gaps, and validate required fields. They must not mark an item reviewed through semantic inference alone.

## Review Packet

Each review packet should group items by LearningGoal candidate, source family, stage candidate, and missing-field class. A packet should show enough context for a reviewer to make a decision without loading the full repository:

- catalog item id and source reference;
- question stem, choices, answer key, and rubric/explanation when available;
- source lesson, homework, AC-Q file, iCourse objective-bank record, textbook, or K/A/Q foundation context;
- candidate LearningGoal, K/A/Q objective, graph-node, difficulty, cognitive-level, misconception, remediation, and stage fields;
- current eligibility state and missing blockers;
- source hash and packet version.

The packet may include machine suggestions, but suggestions are not review decisions.

## Review Decision

A review decision must record:

- reviewer id or role;
- reviewed timestamp;
- review batch id;
- source content hash;
- selected LearningGoal ids;
- selected K/A/Q objective ids;
- graph-node and capability/quality target refs;
- stage purpose such as precheck, practice, checkpoint, readiness, remediation, or terminal-validation support;
- difficulty and cognitive level;
- misconception and remediation refs;
- notes for rejected or deprecated items.

An item may become `semantically-reviewed` only when required fields pass validation. It may become `path-eligible` only when the reviewed fields satisfy the LearningGoal and stage policy.

## Validation

The workflow should add a deterministic validator that reports:

- unreviewed registered items;
- reviewed items with stale source hashes;
- reviewed items missing required semantic fields;
- items with LearningGoal or K/A/Q ids absent from the registered catalogs;
- items whose remediation refs are not path-eligible resources;
- items whose selected stage conflicts with item type or rubric.

## Data Governance Boundary

The validator belongs to data-quality governance. It should produce actionable backlog output without copying raw private student answers or unrelated resource bodies. It should be usable by later agents as the checklist for manual completion.

The review coverage report should preserve source-family counts from the catalog, including the current 167 AC-Q static files and the current 226 iCourse objective-bank items derived from their repository artifacts.
