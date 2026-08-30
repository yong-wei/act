## ADDED Requirements

### Requirement: Teacher delivery surface copy is Simplified Chinese

The teacher delivery surface SHALL present its fixed interface copy, including the governed-report eyebrow above the report title, in Simplified Chinese. Technical values such as report version identifiers, enum-derived labels that already have Chinese label mappings, and browser-generated print headers remain exempt.

#### Scenario: Teacher opens a fixed report

- **WHEN** an authorized teacher opens the teacher delivery page
- **THEN** the eyebrow above the report title SHALL read Simplified Chinese governed-report copy
- **AND** the page SHALL NOT render the previous English "Fixed governed report" eyebrow.
