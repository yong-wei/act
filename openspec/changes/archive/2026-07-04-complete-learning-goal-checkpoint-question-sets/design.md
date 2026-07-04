## Overview

This change is the content-completion layer. It uses the catalog and review workflow to create enough reviewed, path-eligible assessment items for every current path-ready LearningGoal.

## Minimum Coverage Policy

For each current path-ready LearningGoal, the implementation should provide at least:

- precheck/readiness: 3 reviewed items;
- practice: 6 reviewed items distributed across key knowledge and capability targets;
- checkpoint: 3 reviewed items;
- remediation: 3 reviewed items tied to common misconceptions and ResourceNode remediation refs.

Terminal-validation or simulation-heavy goals may need additional rubric-backed or scenario-linked items. If the LearningGoal policy requires simulation, Arena, control workbench, or project evidence, the question set may support readiness and checkpoint diagnosis but must not replace the required typed outcome.

## Source Reuse

The implementation should prioritize existing material:

- 50 preset adaptive questions;
- existing Prisma `Question` rows;
- parsed static AC-Q files under `course-content/questions/questions/AC-Q-*.json`, currently 167 items;
- iCourse objective-bank items under `course-content/questions/objective-bank/icourse-bank-bankType4.*`, currently 226 items according to the index;
- reviewed K/A/Q foundation-bank items;
- manually authored new checkpoint items only for remaining gaps.

Items that are too broad, ambiguous, duplicated, open-ended without rubric, or disconnected from LearningGoal policy should remain registered but not path-eligible until rewritten or deprecated.

This change should treat the archived K/A/Q foundation bank as a seed and complete only the catalog/current LearningGoal delta. It should not rebuild the archived foundation-bank capability. If a separate legacy 188-question source is identified later, it should be registered through the catalog with a concrete manifest before being counted for coverage.

## Coverage Matrix

The output should include a matrix by LearningGoal and stage:

- required count;
- reviewed path-eligible count;
- source mix;
- K/A/Q objective coverage;
- graph-node coverage;
- difficulty and cognitive-level distribution;
- remediation coverage;
- blockers and limitation reasons.

This matrix becomes the evidence used by path planning and reviewer checks.

## Manual Content Boundary

Semantic fields and new item authoring require human judgment. Scripts may detect gaps and format records, but the actual semantic assignment and new item quality review must be traceable through review audit fields.
