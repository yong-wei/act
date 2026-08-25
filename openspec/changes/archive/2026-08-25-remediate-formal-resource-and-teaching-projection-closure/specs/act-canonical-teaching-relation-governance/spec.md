## ADDED Requirements

### Requirement: Relation decisions are applied into immutable final ledgers
For the captured active-domain scope, the governance workflow SHALL persist the candidate set, evidence registry, course-owner decision, and applied final disposition for every `canonicalId × relation-family` row. A decision applier SHALL validate candidate and evidence references and SHALL materialize accepted relations, rejected candidates, replacements, or evidence-backed `NO_RELATION` dispositions. Caller-provided completion flags, arbitrary evidence strings, or candidate counts SHALL NOT create final closure.

#### Scenario: Course owner accepts or replaces a candidate
- **WHEN** a repository decision accepts a qualified candidate or replaces it with an evidence-supported teaching relation
- **THEN** the applier SHALL materialize the exact final relation and retain the original candidate, evidence, decision, and semantic revisions
- **AND** the relation SHALL be active only inside the non-selectable remediation candidate

#### Scenario: Course owner records no relation
- **WHEN** a repository decision records `NO_RELATION` for a scoped member and family
- **THEN** the disposition SHALL cite frozen course evidence explaining why that teaching relation is absent
- **AND** the applier SHALL reject missing, drifting, or unbound evidence references

### Requirement: Qualified relations and problematic relations receive distinct final outcomes
Evidence-qualified automatic relations SHALL receive valid candidate dispositions, while low-confidence, conflicting, unsupported, or otherwise problematic relations SHALL be excluded from candidate activation and preserved in immutable repository review packs for course-owner adjudication. Review and adjudication SHALL finish during development and SHALL NOT require a runtime role, service, or student/teacher application surface.

#### Scenario: Relation passes automatic qualification
- **WHEN** the exact qualified pipeline and item-level gates pass against the captured Authority and course evidence
- **THEN** the relation MAY receive a final included disposition without per-item manual review
- **AND** its pipeline, input, evidence, confidence, and output identities SHALL remain auditable

#### Scenario: Relation is low-confidence or problematic
- **WHEN** a relation fails automatic admission or has conflicting, incomplete, or exceptional evidence
- **THEN** it SHALL be absent from candidate-active relations and present in an immutable review pack
- **AND** a course-owner decision SHALL resolve it before the remediation projection can become complete

### Requirement: Remediation teaching closure is computed over all three families
The remediation workflow SHALL derive the exact active-domain membership from the sealed Authority capture and SHALL compute teaching closure only from reopened containment, prerequisite, and pedagogical-association final ledgers. `COMPLETE` SHALL be derived when every scoped member has exactly one valid final disposition in every family and unresolved count is zero; it SHALL NOT be accepted as caller input.

#### Scenario: Three-family ledgers are disposition-complete
- **WHEN** membership, candidates, decisions, evidence, and final dispositions reopen under the same capture and every family conserves the full scope with zero unresolved rows
- **THEN** the validator SHALL derive `COMPLETE` and seal a closure receipt over the exact ledgers
- **AND** only included relations SHALL enter the remediation Teaching Projection

#### Scenario: One scoped row is missing or pending
- **WHEN** any member-family row is missing, duplicated, pending, drifting, or bound to another capture
- **THEN** the validator SHALL refuse `COMPLETE`
- **AND** no complete Teaching Projection or downstream handoff SHALL be sealed

#### Scenario: Engineering relation is relabeled as teaching evidence
- **WHEN** a workflow attempts to obtain closure by copying or renaming an Engineering Authority relation without ACT teaching evidence and disposition
- **THEN** the candidate SHALL fail governance validation
- **AND** the upstream Engineering Authority SHALL remain unchanged
