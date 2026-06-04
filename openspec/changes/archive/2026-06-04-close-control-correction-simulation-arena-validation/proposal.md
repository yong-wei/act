## Why

The report states that learning and doing remain separated: simulation and Arena evidence exists, but it does not yet determine path completion, failure, fallback, or Konling correction. A control-correction path must end in authentic validation, not only resource consumption.

## What Changes

- Require control-correction paths to include simulation and Arena validation when policy and resource availability allow.
- Convert simulation and Arena outcomes into path terminal validation, fallback triggers, and Konling correction context.
- Preserve preview/official evidence boundaries and avoid exposing hidden Arena internals.
- Add validation tests for successful completion, repeated failure, fallback activation, and low-confidence evidence.

## Capabilities

### Modified Capabilities

- `adaptive-learning-path-planning`
- `simulation-arena-evidence-governance`
- `konling-agent-runtime`

## Impact

- Makes the path loop outcome-based rather than view-based.
- Depends on persisted path rounds, evidence-cache integration, and cited Konling coaching.
- Does not create new Arena scoring semantics or redefine simulation trace governance.
