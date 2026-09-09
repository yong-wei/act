## MODIFIED Requirements

### Requirement: Structured generation makes stage duration arithmetic explicit
Smart lesson-plan stage generation SHALL provide the provider with the
authoritative stage duration and require an arithmetic self-check before JSON
output. A targeted correction for a sole nested-step duration mismatch SHALL
include a concrete positive-integer allocation when the original candidate
exposes a usable step count.

#### Scenario: A BOPPPS stage is generated from a confirmed outline
- **WHEN** the worker requests a BOPPPS stage after persisting an outline
- **THEN** the request SHALL state the authoritative stage duration
- **AND** the prompt SHALL require the sum of `steps.minutes` to equal that
  duration before output
- **AND** the system and prompt version recorded for the attempt SHALL identify
  the updated generation prompt contract.

#### Scenario: A sole nested-step duration mismatch is corrected
- **WHEN** validation reports only `stage-step-duration-mismatch`
- **THEN** the correction context SHALL retain the expected and actual totals
- **AND** when the candidate has a usable step array and a feasible positive-
  integer allocation can be derived, it SHALL include an allocation with the
  same length and the expected total that prefers the original step-minute
  proportions
- **AND** when no such allocation can be derived, the correction instruction
  SHALL permit merging or reducing steps while preserving the teaching
  semantics and source bindings
- **AND** the correction instruction SHALL require applying and rechecking
  the resulting allocation without changing semantic fields or source
  bindings.

#### Scenario: A candidate has no feasible step allocation
- **WHEN** targeted correction cannot derive a valid positive-integer step
  allocation
- **THEN** the correction context SHALL omit the allocation
- **AND** the correction instruction SHALL not require preserving an
  infeasible step count
- **AND** the correction instruction SHALL still require exact equality between
  `stage.minutes` and the sum of `steps.minutes`.
