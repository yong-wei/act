## ADDED Requirements

### Requirement: Single host validation is sufficient for the declared comparison scope
The declared comparison SHALL complete on the available M5 host without requiring another physical device; emulated conditions SHALL be identified as such.

#### Scenario: No low end device is available
- **WHEN** All required implementations and local tests have run
- **THEN** The project can complete its declared scope with explicit external-hardware coverage limits rather than fabricated device results.

### Requirement: Route selection uses quality constrained measured cost
Route recommendations SHALL use measured costs and declared quality constraints, retain uncertainty and distinguish implementation status from adoption advice.

#### Scenario: A complete route is evaluated
- **WHEN** All candidates have executed the required local profiles
- **THEN** The report provides valid pairwise tradeoffs without equating vsync-capped frame rate with identical cost.
