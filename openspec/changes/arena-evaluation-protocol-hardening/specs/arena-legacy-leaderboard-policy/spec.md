## ADDED Requirements

### Requirement: Current leaderboards exclude legacy protocols by default
Arena submission listing SHALL return only submissions whose evaluation protocol matches the current expected protocol unless the caller explicitly opts into legacy protocol inclusion.

#### Scenario: Default listing
- **WHEN** submissions are listed for an Arena task without `includeLegacyProtocols`
- **THEN** rows evaluated under `whitebox-v1` MUST be excluded from the returned leaderboard records

#### Scenario: Explicit legacy listing
- **WHEN** submissions are listed with `includeLegacyProtocols: true`
- **THEN** rows evaluated under `whitebox-v1` MAY be returned together with current protocol rows

### Requirement: Legacy protocol visibility remains distinguishable
Callers that include legacy protocol submissions MUST have access to the stored evaluation protocol version so legacy rows can be labeled or separated in UI.

#### Scenario: Teacher historical view
- **WHEN** a teacher or admin view requests legacy submissions
- **THEN** each returned record MUST preserve enough evaluation metadata to distinguish legacy protocol submissions from current protocol submissions
