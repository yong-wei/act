# Change: Recover teacher diagnosis from empty structured provider output

## Why

Issue #1516: the governed teacher-diagnosis worker can receive an empty
structured response from a configured provider. The failure is currently
persisted as `No output generated.`, leaving a valid frozen evidence snapshot
without a report even though the provider can return a usable JSON response.

## What Changes

- Add one diagnosis-only fallback from structured output to plain JSON text
  when the first request has no output.
- Parse and validate the fallback output through the existing governed result
  pipeline before persistence.
- Classify exhaustion of both strategies as an explicit, retryable empty-output
  failure.
- Add regressions for the fallback and failure classification.

## Non-Goals

- Changing the frozen governed input, evidence cutoff, output schema, or
  persistence authorization rules.
- Retrying other model modes or changing their structured-output behavior.
- Altering automatic retry limits.

## Impact

- Affected capability: `teacher-diagnosis-generation-governance`.
- Affected code: provider runtime, diagnosis provider adapter, diagnosis worker,
  and their unit tests.
