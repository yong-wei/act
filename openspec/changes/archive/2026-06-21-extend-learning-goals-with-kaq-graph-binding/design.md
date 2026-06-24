## Overview

LearningGoal packages are the student-facing expression of platform K/A/Q objectives. A package should tell the learner what they are working toward while giving the system enough structured references to expand a graph subgoal, select resource candidates, and explain the resulting path.

This change must extend the current registered-goal path rather than introducing a second target catalog. Existing `AdaptiveLearningPathRegisteredGoalDefinition` entries remain valid; they gain a package layer with K/A/Q bindings, student-facing intent, evidence policy, resource mix, and terminal validation policy.

## Contract Shape

A LearningGoal package includes:

- stable id and display title;
- student-facing description and completion meaning;
- intent type and recommended learning phase;
- knowledge, capability, and quality objective ids;
- target graph node ids;
- required evidence types and evidence policy;
- preferred resource mix and path policy family;
- terminal validation policy;
- status: `draft`, `path-ready`, or `fully-governed`;
- version metadata.

## Seeding Strategy

The first implementation should upgrade the existing `control-correction` and `frequency-response-foundations` goals, then add at least six more automatic-control goals. These should cover foundational concept understanding, modeling, time-domain analysis, frequency response, stability analysis, controller design, simulation validation, and transfer/application.

## Boundaries

LearningGoal packages are not teacher-created custom goals yet. They do not write mastery, do not replace K/A/Q objectives, and do not bypass ResourceNode eligibility. They are the governed entry layer that downstream graph expansion and planning can consume.

## Validation

Tests should prove that every `path-ready` LearningGoal has knowledge, capability, and quality objective bindings, student-facing text, resource mix, evidence policy, terminal validation policy, and compatibility with existing registered goals. If quality evidence is not fully governed yet, the package still keeps the quality objective and records an evidence limitation.
