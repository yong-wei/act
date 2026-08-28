# Migration ledger

| Producer / reader | Mode after this change | Trigger / current | Retirement gate |
| --- | --- | --- | --- |
| Portrait v2 materializer | direct same-transaction version write; pointer via `publishCurrentPointer` | ingestion projection trigger → worker snapshot | keep until sixth-item retirement of legacy competency snapshot |
| Class cumulative portrait | existing fence publish | member currents | keep |
| Feature cache | rebuildable projection, not current | fact watermark window | keep; not a current pointer |
| Student read port | `studentFieldsFromEnvelope` + existing `readCurrentCumulativePortrait` | current pointer | n/a |
| Teacher class read | `projectTeacherClassRead` independent-learner ≥ 5 | class current | graph-center overlay already uses the same minimum |
| AI / Personalization | `projectSafeFeatureRead` | current envelope | ground-evidence-copilot authorization unchanged |
| InteractionLog page aggregations | **retained** | reports / admin | do not delete until a consumer change proves zero required callers |

## Receipts

- Pointer CAS: create / advance / stale / conflict / duplicate
- Crash between version insert and pointer CAS leaves the prior current visible; candidate version is retryable
- Forbidden projection payload: redacted fingerprint only
- Small-sample teacher aggregates: suppressed, coverage retained
