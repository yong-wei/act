## ADDED Requirements

### Requirement: Confirmed correction candidates update only eligible future path nodes
The system SHALL apply a confirmed correction candidate by preserving completed nodes and the current node once execution has entered it, excluding unfinished historical nodes that a governed skip, replacement, or abandonment deviation explicitly marks as no longer applicable, and replacing only eligible adjustable unfinished future nodes. It SHALL preserve existing execution and deviation records and terminal evidence unless the confirmed candidate itself contains a governed future terminal node.

#### Scenario: Current node is in progress
- **WHEN** a learner confirms a correction while the current node is started but not completed
- **THEN** the system SHALL keep the current node and its position unchanged
- **AND** it SHALL apply the candidate only to later eligible unfinished nodes.

#### Scenario: Path has no eligible future node
- **WHEN** a current candidate has no eligible future node that can be safely replaced
- **THEN** the system SHALL reject confirmation as unavailable or conflicted
- **AND** it SHALL not alter the persisted path.
