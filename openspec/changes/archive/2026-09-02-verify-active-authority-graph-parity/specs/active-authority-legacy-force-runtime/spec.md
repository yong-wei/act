## ADDED Requirements

### Requirement: Force migration completion requires integrated browser evidence
The Force runtime migration SHALL remain incomplete until real 2D and 3D browser probes pass the exact movement, pin, reflow, camera and performance matrix defined by the migration acceptance capability.

#### Scenario: Unit tests pass without browser force evidence
- **WHEN** component and unit tests pass but the integrated force trace is absent or failing
- **THEN** migration completion SHALL be rejected
- **AND** tasks SHALL not be marked complete from implementation inspection alone
