## Overview

Goal subgraph expansion is the bridge between a LearningGoal package and downstream planning. It converts a student-facing target into an explicit graph payload: target nodes, prerequisite edges, remediation candidates, terminal validation candidates, checkpoint suggestions, and limitations.

## Expansion Inputs

The service consumes:

- LearningGoal package id and version;
- K/A/Q objective ids;
- target graph node ids;
- graph catalog version;
- optional learner/class context only as references, not raw evidence.

## Expansion Output

The output includes:

- LearningGoal id and version;
- graph version;
- knowledge, capability, and quality node ids;
- required and recommended edges;
- prerequisite policy entries;
- remediation and extension candidates;
- terminal validation candidates;
- checkpoint suggestions;
- limitations.

## Relation Semantics

Relations should be resolved into a small planner-safe set:

- `hard_prerequisite`;
- `soft_prerequisite`;
- `co_requisite`;
- `remediation`;
- `extension`;
- `transfer_to`;
- `evidence_for`.

These semantics can be derived from graph catalog relations or explicit policy mapping. Unknown or weak relation evidence must become a limitation rather than a hidden assumption.

## Boundaries

The expansion service does not select ResourceNodes, compute learner mastery, generate a path, or write evidence. It is a read-only interpretation layer that keeps graph body data immutable.

## Validation

Tests should prove that expansion is deterministic, versioned, and rejects or degrades missing graph bindings. Path planner tests should be able to consume a fixture expansion without re-deriving graph relations.
