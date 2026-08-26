## ADDED Requirements

### Requirement: Unsatisfiable terminal validation is not a candidate endpoint

The planner SHALL NOT select a terminal validation node as an executable candidate endpoint when the current learner cannot satisfy that node's `minimumCompetency` or `minimumEvidenceCount`, and those gaps cannot be closed by completing other nodes on the same candidate. Terminals locked only by `requiredCompletedNodeIds` or `requiredOutcomeRefs` that the candidate can satisfy MAY remain. If no reachable official terminal exists, the planner SHALL return fallback or evidence-needed instead of an unexecutable closed path.

#### Scenario: Cold-start learner is not given an unsatisfiable Arena endpoint

- **WHEN** a learner without trusted Portrait V2 evidence requests a control-correction path
- **THEN** the planner SHALL NOT end an executable candidate on a terminal locked only by `minimumCompetency` or `minimumEvidenceCount`
- **AND** it SHALL choose a reachable official terminal, or return fallback with an explicit limitation
- **AND** it SHALL NOT fabricate completion events or portrait evidence to unlock the terminal
