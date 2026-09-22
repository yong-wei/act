## ADDED Requirements

### Requirement: Foam source sampling resolves its declared spatial band
Natural foam generation SHALL sample or filter compression at a rate adequate for its declared band and SHALL retain transport and decay at low quality.

#### Scenario: Foam resolution is reduced
- **WHEN** The low-tier source grid becomes coarser
- **THEN** Unresolved source frequencies are filtered and foam does not become a repeating advected stamp.

### Requirement: Fleet contact and interaction quality is exercised dynamically
Fleet interaction quality SHALL be validated through real controlled motion sequences while preserving numerical degree-of-freedom ownership.

#### Scenario: The platform holds position with thrust
- **WHEN** A deterministic station-keeping sequence is replayed
- **THEN** Localized wash appears at real propulsors and open water between structures remains visible without invented transit motion.
