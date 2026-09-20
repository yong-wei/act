## ADDED Requirements

### Requirement: Micro-wave filtering follows projected sampling density
The active micro-wave shader SHALL filter unresolved frequencies using physical-pixel footprint or an equivalent projection-aware measure; camera distance alone SHALL NOT be the complete filter.

#### Scenario: Pixel density or field of view changes
- **WHEN** drawing-buffer resolution or camera field of view changes at a fixed world pose
- **THEN** the optical frequency cutoff follows the new sampling density without changing the interaction wave field

### Requirement: Anti-aliasing retains directional wave glitter
Micro-wave changes SHALL reduce coherent stripe patterns and temporal aliasing while retaining the accepted directional highlight structure.

#### Scenario: The camera moves through a glancing view
- **WHEN** a controlled camera movement crosses near and far water under the same sun
- **THEN** the water avoids conspicuous stripe crawling or a sudden mirror-flat transition and preserves visible natural glitter
