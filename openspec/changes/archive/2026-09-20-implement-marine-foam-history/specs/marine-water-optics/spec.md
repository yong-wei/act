## ADDED Requirements

### Requirement: Foam coverage has a persistent source-driven lifecycle
The active water renderer SHALL consume bounded foam history with explicit generation, transport and decay. A repeated shape texture gated only by wave height SHALL NOT satisfy this requirement.

#### Scenario: A natural crest stops producing foam
- **WHEN** its compression source falls below the configured threshold
- **THEN** previously generated foam persists, deforms or advects, and dissipates according to elapsed visual time rather than disappearing with the crest mask

#### Scenario: The local foam domain moves
- **WHEN** the vessel causes a foam-domain recentering
- **THEN** previous foam retains its world-space history and new domain regions are initialized without wrapping old trails to the opposite boundary

### Requirement: Foam detail preserves established wave glitter
Foam detail SHALL avoid conspicuous repeating large stamps and SHALL share scene lighting and fog without erasing the established directional water glitter.

#### Scenario: A fixed-camera comparison is reviewed
- **WHEN** natural and vessel foam are enabled separately and together for a moving sequence
- **THEN** the sequence shows distinct sources and evolving shapes without a rigid periodic pattern sliding across the sea
- **AND** unaffected water retains the accepted sun-glitter appearance
