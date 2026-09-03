## ADDED Requirements

### Requirement: Limitations stay consistent with structured coverage facts

The diagnosis generation pipeline SHALL validate, before persistence, that no limitation contradicts the report's structured coverage facts. When the persisted `sourceCoverage` shows complete coverage (`coverage` = 1, `includedStudents` at least `classMembers` when both are provided, and assignment and assessment groups each reporting zero missing students), the provider output SHALL NOT contain a limitation asserting that some students' data or evidence may be missing. The deterministic validation SHALL intercept a closed wording family for this defect: a subgroup qualifier (such as 部分/少数/个别/某些学生) combined with a data/evidence/progress/records noun and a missing/incomplete predicate (缺失/缺少/未覆盖/未纳入/不完整/不全), evaluated per clause. A violating output SHALL be rejected as a retryable model-behavior defect under the existing attempt budget and SHALL NOT be persisted.

#### Scenario: Complete coverage with a hypothetical missing-data limitation

- **WHEN** the provider returns a report whose `sourceCoverage` shows complete coverage and whose limitations include a clause asserting that some students' data may be missing
- **THEN** the deterministic validation SHALL reject the output with a retryable model-behavior error before persistence
- **AND** the job SHALL requeue within the existing attempt budget.

#### Scenario: General judgment boundary is preserved

- **WHEN** the coverage is complete and a limitation explains a method boundary (for example that risk flags are a sparse hit set and unflagged students are not missing evidence) without asserting missing student data
- **THEN** the validation SHALL accept the limitation and the report MAY be persisted.

#### Scenario: Real coverage gap keeps its limitation

- **WHEN** the `sourceCoverage` shows an actual coverage gap (coverage below 1, or a group with missing students)
- **THEN** limitations describing the missing data SHALL be accepted.

#### Scenario: Sparse risk-flag semantics stay distinct

- **WHEN** a limitation misreads the risk-flag hit count as risk-evidence coverage
- **THEN** the existing sparse risk-flag validation SHALL continue to reject it as its own retryable defect, independent of this consistency check.

### Requirement: Teacher-facing availability status separates judgment boundaries from coverage gaps

The teacher-facing report history projection SHALL NOT label a report as「证据部分可用」nor describe coverage or attribution as incomplete when the report's structured coverage is complete. When coverage is complete, `confidence` is `medium`, and neither a pseudo conflict nor a declared evidence conflict applies, the projection SHALL present an availability status of「证据覆盖完整，结论需复核」or an equivalent accurate meaning, with a recovery action directing the teacher to review the declared judgment boundaries. Complete-coverage reports whose only structural deficit is knowledge-node attribution SHALL present the existing attribution-limited status instead of the partial-availability fallback. Real coverage gaps SHALL keep a partial-availability status with the missing counts and backfill advice, and real comparable evidence conflicts SHALL keep the existing conflict presentation.

#### Scenario: Complete coverage with medium confidence and a general boundary

- **WHEN** a report has complete structured coverage, `confidence: medium`, no detected pseudo conflict, and no declared evidence conflict
- **THEN** the teacher-facing projection SHALL show an availability status equivalent to「证据覆盖完整，结论需复核」
- **AND** the recovery action SHALL direct the teacher to review the declared judgment boundaries and regenerate only if conclusions need updating.

#### Scenario: Attribution-limited complete coverage at medium confidence

- **WHEN** a report has complete structured coverage and knowledge-node findings lacking node attribution
- **THEN** the projection SHALL present the attribution-limited status and SHALL NOT fall back to「证据部分可用」.

#### Scenario: Real coverage gap remains explicit

- **WHEN** a report's evidence groups have missing students or unavailable sources
- **THEN** the projection SHALL keep a partial-availability status carrying the missing counts and backfill advice.

#### Scenario: Historical reports are re-projected safely

- **WHEN** a previously persisted report with complete coverage and a contradictory hypothetical limitation is projected after this change
- **THEN** the historical report body SHALL remain immutable
- **AND** the availability status SHALL follow the complete-coverage semantics without asserting incomplete coverage.
