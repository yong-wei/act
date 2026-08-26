## ADDED Requirements

### Requirement: Unsatisfiable terminal validation is not a candidate endpoint

The planner SHALL NOT select a terminal validation node as an official candidate endpoint when the current learner still misses `minimumCompetency` or `minimumEvidenceCount` and the node has no remaining `requiredCompletedNodeIds` or `requiredOutcomeRefs`. Completing other path nodes does not create Portrait V2 competency or evidence. Terminals that still have path-closable completion or outcome gates MAY remain official locked future work. If no official terminal remains, the planner SHALL return fallback or evidence-needed instead of an unexecutable closed path.

#### Scenario: Cold-start learner is not given an unsatisfiable Arena endpoint

- **WHEN** a learner without trusted Portrait V2 evidence requests a control-correction path
- **THEN** the planner SHALL NOT end an executable candidate on a terminal locked only by `minimumCompetency` or `minimumEvidenceCount`
- **AND** it SHALL choose a reachable official terminal, or return fallback with an explicit limitation
- **AND** it SHALL NOT fabricate completion events or portrait evidence to unlock the terminal
