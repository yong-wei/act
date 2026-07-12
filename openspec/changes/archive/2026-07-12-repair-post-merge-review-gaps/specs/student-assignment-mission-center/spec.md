# student-assignment-mission-center Specification

## ADDED Requirements

### Requirement: Submission asset reads verify persisted integrity

Authorized submission asset reads SHALL verify the fetched object against the
persisted byte count and SHA-256 checksum before returning bytes to a client.

#### Scenario: Stored asset metadata does not match the fetched object

- **WHEN** the fetched object has a different byte count or SHA-256 digest than
  the authorized asset metadata
- **THEN** the read SHALL fail with the asset integrity error
- **AND** no unverified object bytes SHALL be returned.

