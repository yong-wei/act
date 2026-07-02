## ADDED Requirements

### Requirement: SAR supports teacher K/A/Q evidence trace consumers
SAR SHALL provide privacy-safe associated evidence suitable for teacher K/A/Q evidence trace surfaces.

#### Scenario: Teacher trace requests SAR evidence
- **WHEN** a teacher K/A/Q evidence trace consumer requests associated evidence for an authorized class and selected graph node
- **THEN** SAR SHALL return candidate event refs, entity refs, resource refs, trace summary, rejected refs, and limitations within the teacher's class scope
- **AND** cross-class, student-private, audit-only, hidden Arena, and private memory details SHALL be filtered or redacted before serialization.
