## MODIFIED Requirements

### Requirement: Complete Release import and course activation are separate
The system MUST keep every integrity-valid ActKG Release available for engineering Authority browsing and engineering consumers, while ACT teaching consumers use only the explicitly scoped, version-matched Teaching Projection records. A missing, empty, or unresolved ACT overlay MUST NOT make the engineering Release invalid.

#### Scenario: Valid Release has no teaching bindings
- **WHEN** an integrity-valid ActKG Release is admitted and the ACT Teaching Projection is empty or absent
- **THEN** engineering Authority MAY become `ACTIVE`
- **AND** ACT teaching consumers SHALL report `NOT_PROJECTED` or remain on an explicitly pinned prior projection

#### Scenario: Teaching binding is unresolved
- **WHEN** one course/resource binding is `REVIEW_REQUIRED` or missing
- **THEN** only that affected teaching consumer SHALL be blocked
- **AND** engineering browsing and Engineering RAG SHALL remain available from Authority

### Requirement: Coverage baseline is scoped to ACT teaching resources
The system MUST NOT require every member of an ActKG Release to receive an ACT course role or exclusion. The denominator SHALL be the current ACT resource/core-node scope selected for Teaching Projection, and each in-scope resource SHALL have `BOUND`, `EXPLICIT_NONE`, or `REVIEW_REQUIRED` status with a deterministic reason.

#### Scenario: Unprojected upstream object exists
- **WHEN** a valid ActKG Release contains an object not used by any ACT course or resource
- **THEN** the object SHALL remain `NOT_PROJECTED`
- **AND** it SHALL not enter an ACT coverage review denominator or Authority gate

#### Scenario: Required ACT resource has no binding
- **WHEN** an in-scope resource is marked `REQUIRED` but has no valid Canonical binding
- **THEN** the affected Teaching Projection SHALL fail closed
- **AND** the ActKG Authority SHALL remain independently activatable

### Requirement: Coverage updates follow ReleaseSet Delta
After Authority changes, ACT SHALL compute impact only for changed Canonical identities and their existing local bindings. Unaffected teaching records may be carried forward deterministically; new unbound engineering objects do not create review work.

#### Scenario: Delta adds unrelated engineering objects
- **WHEN** a ReleaseSet Delta adds objects with no ACT binding
- **THEN** ACT SHALL emit zero teaching-review items for those objects
- **AND** the engineering Release may activate after integrity validation
