## ADDED Requirements

### Requirement: Modern-control prerequisite increment is scope-bounded
The modern-control teaching increment MUST limit its denominator to explicitly selected core nodes in discrete-time and state-space control domains. Objects shared with another domain MAY retain multiple reviewed memberships but SHALL retain one canonical prerequisite endpoint identity.

#### Scenario: Core node belongs to two domains
- **WHEN** one selected Authority object is reviewed into a modern domain and another domain
- **THEN** prerequisite publication SHALL reference the same canonical endpoint
- **AND** domain membership SHALL not duplicate the teaching edge
