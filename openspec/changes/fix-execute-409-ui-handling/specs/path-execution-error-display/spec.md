# Path Execution Error Display

## Requirements

1. Path execution 409 errors must display in the current-path module, not just the path-resource module.
2. Path execution errors must use a state (`pathExecutionError`) separate from the shared page `error` state.
3. Practice loading/submit/next-question failures must NOT set `pathExecutionError`.
4. Successful retry after a failed path execution must clear `pathExecutionError`.
5. The refresh button in the error display must clear `pathExecutionError` and reload the path.

## Scenarios

| # | Scenario | Expected |
|---|----------|----------|
| 1 | Execute API returns 409 | `pathExecutionError` set, `error` unchanged, current-path shows error |
| 2 | Practice load fails | `error` set, `pathExecutionError` unchanged, practice-resource shows error |
| 3 | After 409, retry succeeds | `pathExecutionError` cleared, error area hidden |
| 4 | User clicks refresh button | `pathExecutionError` cleared, path reloaded |
| 5 | launchPathNodeAction starts resource | `pathExecutionError` cleared |

## Data attributes

- Error container: `data-adaptive-path-execution-error="visible"`
- State markers: `data-adaptive-path-node-actions="attached"`, `data-adaptive-practice-error-state="recoverable"`
