## ADDED Requirements

### Requirement: Arena model selectors render professional transfer-function notation
The system SHALL render transfer functions in Arena model-selection surfaces as mathematical notation when a model provides LaTeX.

#### Scenario: Student views a second-order model card
- **WHEN** a selectable Arena model provides a LaTeX transfer function containing `s^2`
- **THEN** the model card MUST render the exponent as mathematical superscript markup
- **AND** the card MUST NOT expose the literal source notation `s^2`

#### Scenario: Student views the locked challenge model
- **WHEN** an Arena workspace locks a model that provides a LaTeX transfer function
- **THEN** the locked-model summary MUST render that transfer function as inline mathematics

### Requirement: Formula rendering preserves fallback and selection behavior
The system SHALL preserve usable model-selector behavior when professional formula rendering is unavailable.

#### Scenario: Model has no LaTeX representation
- **WHEN** an Arena model has a plain display value but no LaTeX value
- **THEN** the selector MUST show the plain display value
- **AND** it MUST NOT hide or disable an otherwise selectable model

#### Scenario: Student selects a compatible model
- **WHEN** the student activates a compatible model card after formulas are rendered
- **THEN** the selector MUST report that model identifier through its existing selection callback

### Requirement: Formula presentation does not change model semantics
The system SHALL treat this change as presentation-only.

#### Scenario: Existing model data is consumed
- **WHEN** evaluation or analysis consumes an Arena transfer-function model
- **THEN** its numerator, denominator, plain display, and LaTeX data MUST remain unchanged
- **AND** compatibility and evaluation rules MUST remain unchanged
