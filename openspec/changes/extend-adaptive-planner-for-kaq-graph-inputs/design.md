## Overview

This change turns graph-driven planning from a set of upstream contracts into planner input. The existing planner stays the owner of Stage 1 path generation. New helpers may prepare graph input, but they must not become a parallel planner or bypass existing ResourceNode and path round governance.

## Inputs

The planner should accept or resolve:

- LearningGoal package id and version;
- ExpandedGoalSubgraph;
- ResourceNode graph profile fields;
- ResourceCoverage overlay where available;
- Learner/Class overlay where available;
- time budget, resource preferences, checkpoint preference, external resource permission, excluded nodes, and preferred style;
- version refs.

## Planning Behavior

Stage 1 remains deterministic rules plus graph search. The planner filters audited ResourceNodes, matches them against graph subgoal gaps, respects readiness metadata, and returns executable starter paths for cold-start learners. It should expose fallback or limitations when resource coverage, overlay confidence, or graph bindings are insufficient.

## Compatibility

The planner must preserve:

- existing `control-correction` and `frequency-response-foundations` path behavior;
- generic path round persistence;
- append-only execution/deviation/intervention activity;
- Konling path-generation tool audit;
- terminal validation distinction between preview, simulation, Arena official, and checkpoint evidence.

## Boundaries

This change does not implement multi-objective ranker modules, CP-SAT repair, contextual bandit, or RL. It prepares the planner to receive richer graph and ResourceNode inputs and to produce versioned, explainable path artifacts.

## Validation

Tests should include at least one cold-start learner, one low-resource fallback, one readiness-locked heavy node, and one path-ready LearningGoal package using graph input.
