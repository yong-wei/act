## ADDED Requirements

### Requirement: Arena challenges expose training metadata
The system SHALL define training metadata for every Arena challenge.

#### Scenario: Challenge metadata is complete
- **WHEN** the Arena challenge registry is loaded
- **THEN** every challenge has capability tags, prerequisite capability tags, a training stage, estimated effort, and common failure points

### Requirement: Arena hall presents a capability training map
The system SHALL let students browse Arena challenges by training stage and capability.

#### Scenario: Student opens Arena hall
- **WHEN** the Arena hall renders
- **THEN** challenges are grouped or navigable by control-design training stage while existing filters remain usable

### Requirement: Challenge detail explains training intent
The system SHALL show the training goal and prerequisites for a challenge before the student enters the workbench.

#### Scenario: Student views a challenge
- **WHEN** the challenge detail page renders
- **THEN** it shows trained capabilities, prerequisites, estimated effort, and common failure points
