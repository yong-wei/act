## ADDED Requirements

### Requirement: Adaptive path closed-loop UI requires design-contract evidence
Adaptive path closed-loop UI changes SHALL include design-contract evidence proving visible alignment with expected Product Design sources and current-state regression targets.

#### Scenario: Design QA evidence is captured
- **WHEN** the closed-loop adaptive path states are accepted
- **THEN** the evidence SHALL cite expected visuals at `artifacts/product-design-audits/adaptive-learning-path-2026-06-14/concepts/01-path-generation-main.png`, `02-path-selection-comparison.png`, `03-active-path-execution.png`, and `04-history-evidence-record.png`
- **AND** it SHALL cite current-state screenshots at `artifacts/product-design-audits/adaptive-learning-path-2026-06-16-current-audit/`
- **AND** each state SHALL record whether the implementation matches, partially matches, or fails the design contract.

#### Scenario: Implementation diverges from design contract
- **WHEN** generation controls are not editable, route states are collapsed into one long page, heavy nodes are immediately executable for low-readiness students, complex-node result cards are missing, or student-visible engineering strings remain
- **THEN** the adaptive path closed-loop work SHALL NOT be considered complete
- **AND** the QA result SHALL block archive or final acceptance for the affected change.

### Requirement: Adaptive path QA covers student-safe language
Adaptive path visual and interaction QA SHALL verify that learner-facing pages do not expose engineering semantics.

#### Scenario: Student page is reviewed
- **WHEN** QA inspects adaptive path landing, generation, selection, execution, and evidence review states
- **THEN** visible text, accessible labels, and embedded student JSON SHALL exclude `started`, `fallback`, `low-resource-fallback`, `policyBundle`, `reasonCodes`, `missing-*`, and `terminal-validation-unavailable`
- **AND** any required diagnostic value SHALL be converted to student-facing product language.
