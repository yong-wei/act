## ADDED Requirements

### Requirement: Filter panel switches as one locale-owned interface surface
All visible and accessible filter-panel labels, samples, counts, errors, retries and empty states SHALL use the selected qualified locale. Switching locale SHALL preserve filter values by stable type/family identity and MUST NOT mix languages within the panel.

#### Scenario: Viewer switches an open panel to English
- **WHEN** the bilingual-ready graph commits English while the filter panel is open
- **THEN** every panel label and accessible description SHALL switch together
- **AND** the enabled node types and relation families SHALL remain unchanged
