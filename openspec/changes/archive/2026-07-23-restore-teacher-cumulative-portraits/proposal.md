## Why

The cumulative-attainment backfill creates valid portrait v2 records and the
student profile correctly displays them, but teacher student details still
derive their primary portrait from the recent, class-scoped evidence window.
Completed-course learners therefore appear to have no evidence in the teacher
view; a timestamp inconsistency can also make an otherwise valid class
cumulative-insights request fail with HTTP 500.

## What Changes

- Make the teacher student detail use the same valid native cumulative portrait
  selected by the class cumulative-attainment view as its primary capability
  result.
- Retain recent, class-scoped evidence only for diagnostic drawer, risk, and
  activity semantics; its absence shall not erase a cumulative portrait.
- Keep revoked portraits suppressed and represent missing cumulative class
  comparison values as unavailable rather than as zero.
- Prevent the cumulative class-insights route from constructing a recent
  compatibility portrait that is not part of the cumulative response and can
  violate its evidence-clock contract.
- Add regression coverage for completed-course learners, current scoped
  evidence, and no-evidence learners.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `teacher-evidence-governance`: Teacher student details must deliver the
  authorized learner's cumulative native portrait independently from recent
  class-scoped diagnostic evidence, while class cumulative views remain
  available when recent scoped facts exist.

## Impact

- Affected APIs: teacher class insights and teacher student insights.
- Affected code: teacher insight route projections and their focused tests.
- No Prisma migration, raw-fact rewrite, student profile behavior, or
  authorization model changes.
