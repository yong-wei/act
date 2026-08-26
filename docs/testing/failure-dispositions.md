# Failure disposition and closure

`eliminate-accepted-red-test-baseline` uses failure fingerprints as the unit of
accountability. A count from one command run is an observation, not a permanent
baseline.

## Allowed dispositions

| disposition | use | closure proof |
| --- | --- | --- |
| `fix` | The product or test behavior is still current and must be repaired. | A focused regression command passes and the original fingerprint is absent. |
| `remove` | The test asserts a retired capability and has retirement, replacement, owner, and call-site evidence. | Retirement evidence is recorded. |
| `release-input` | The assertion depends on a capture, artifact, source revision, or release environment. | `test:release` validates a revision-bound qualification manifest. |
| `external-blocker` | A required service, permission, plan, or environment is unavailable. | The item stays `open` or `blocked` until the external condition is resolved. |

`accepted`, `quarantine`, `silent-skip`, `skip`, and `flaky-retry` are not
dispositions. Widened or relaxed assertions, timeout inflation, and silent
filtering are also rejected by the validator.

## Versioned contracts

The implementation is exported from
`src/lib/architecture-test-commands/disposition.ts`:

- `act-test-failure-disposition/v1`
- `act-test-failure-closure-receipt/v1`
- `validateFailureDisposition`
- `validateFailureClosureReceipt`
- `createFailureDisposition`
- `createFailureClosureReceipt`

Every record binds `sourceCommit`, `sourceTree`, command, fingerprint, owner,
disposition, status, and closure condition. An inventory record also binds the
test identity, failure class and stage, normalized error summary, evidence
identity, occurrence count, and action evidence.

A closure receipt additionally contains `beforeFingerprint`,
`afterCommandResult`, and proof. A closed `fix` must have a passing regression
result; a closed `remove` must have retirement evidence; a closed
`release-input` must have a relative qualification-manifest path, artifact
identity, SHA-256, scope, and capture time. The receipt ID is deterministic
over the receipt body and is checked on read.

Receipt evidence must not contain local absolute paths, credentials, learner
identifiers, raw answers, or event payloads. External blockers record only a
safe response class, affected gate, response summary, and resolution condition.

## Release gate

`test:release` declares `qualification-manifest` as a required input. Missing
input produces the fail-closed result:

```text
release-manifest-missing:qualification-manifest
```

Product commands do not consume release evidence. Capture-bound tests use the
`*.real-smoke.test.ts` suffix and are excluded from the default Vitest unit
scope; they remain visible to discovery and are classified as `nightly`.
