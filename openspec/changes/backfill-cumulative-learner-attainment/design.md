## Context

Portrait v2 is the canonical learner-attainment read model, but its normal
operational path is incremental and recent class aggregation uses a 30-day
window. At semester end, a learner with valid older facts can have no recent
class evidence even though the personal portrait should remain useful. The
existing materialization stack already has durable fenced rebuild requests,
BullMQ workers, canonical portrait readers, and versioned class snapshots.

The change must materialize all in-system `LearningFact` rows without editing
facts or schema. It must also preserve the recent class snapshot because its
activity, risk, classroom-quality, and trend semantics remain useful.

## Goals / Non-Goals

**Goals:**

- Rebuild a native portrait v2 for every `STUDENT` with at least one historical
  `LearningFact` through the existing fenced full-rebuild path.
- Materialize a separate cumulative class aggregate for each current
  `StudentProfile.classId` only after all requested learner portraits are
  valid.
- Provide a dry-run-first, idempotent operator command with direct BullMQ
  enqueueing and durable retry recovery.
- Make cumulative attainment the default teacher-facing scope while keeping
  recent analytics as an explicit, unchanged alternative.

**Non-Goals:**

- Do not add a Prisma migration, alter or backfill raw `LearningFact` rows, or
  infer historical class membership.
- Do not replace the existing recent `class-competency.v2` materialization or
  reinterpret risk, classroom quality, or trends as cumulative outcomes.
- Do not fabricate a zero-valued portrait for a student with no facts.

## Decisions

### Reuse fenced rebuild requests and return their generation

The operator command will call `requestLearningMaterializationRebuild` for
each eligible learner with `classIds: []` and receive the generation assigned
by the same durable request transaction. Empty cumulative class input is
merged with any class ids already pending on that learner request, so the new
generation preserves earlier recent-class refresh responsibility without
adding new recent-class work. It will enqueue a `snapshot-student` full-rebuild
job carrying that generation immediately. The worker remains the only portrait
writer and rejects stale generations.

Returning the generation from the existing request operation avoids a separate
read/race and preserves the request as the recovery source if enqueueing or a
worker attempt fails. Passing an empty array is intentional: it prevents the
legacy full-rebuild path from staging a recent class snapshot.

The alternative, directly calling the portrait materializer from the command,
would bypass queue retry, fencing, and worker ownership. Waiting for the
hourly coordinator would make the operation unsuitable for semester-end
recovery.

### Make apply explicit, resumable, and bounded

`db:backfill-cumulative-attainment` defaults to dry run. Writes require
`--apply`, a stable `--run-id`, and `--wait`. Waiting polls durable learner
rebuild completion, accepts an explicit native no-evidence outcome without
creating a zero-valued portrait, and then waits for every cumulative class job
to return and verifies its newly created snapshot row. Each class task writes
a non-sensitive opaque run reference into the existing cumulative snapshot
JSON, so completion remains durable after BullMQ trims completed jobs. A
deterministic `--limit` permits a five-student pilot without inventing a second
workflow.

When a fenced full rebuild finds no governed portrait contribution, it removes
stale native portrait projection rows for that learner before completing the
explicit no-evidence outcome. Source facts remain unchanged; this prevents an
older derived portrait from being counted as current cumulative coverage.

Each run logs counts and one-way hashed identifiers only. Repeating an apply
is safe because every rerun advances to a new fenced learner generation and
never edits source facts or permits an unfenced portrait write. The run id is a
traceable in-flight BullMQ job deduplication identity; it does not guarantee
that repeated successful runs reuse snapshot rows or leave snapshot row counts
unchanged. A failed request remains durable for a later run. The command stops
before class enqueueing if any requested learner has neither a valid native
portrait nor an explicit no-evidence completion outcome.

### Model cumulative class snapshots as a separate version and job scope

`ClassSnapshotJob` gains `scope: 'recent' | 'cumulative'`, defaulting to
`recent`. The cumulative worker reads the current roster from
`StudentProfile.classId`, selects the newest valid native portrait v2 for each
member, and aggregates it with the existing portrait aggregation utilities.
It stores only `class-competency.cumulative.v1`; the normal recent path
continues to write `class-competency.v2` unchanged.

Waiting verifies the cumulative version, the opaque run reference, and a
snapshot timestamp at or after the task request. BullMQ return values remain
an optional snapshot lookup optimization rather than completion authority.

Cumulative coverage is the number of current members with valid native
portraits divided by the current roster size. Its payload records that
comparison and near-term trends are not applicable. Recent risk, classroom
quality, and trend data remain independent recent-only signals. Reusing the
old version would silently overwrite a different time semantic, while adding a
new model would require an unnecessary migration.

### Scope teacher APIs explicitly

Teacher insights and heatmap routes parse `scope=cumulative|recent`; omitted
scope selects `cumulative`. Both enforce existing teacher/class authorization.
The cumulative path reads the separate class snapshot and current native
portraits; its heatmap has no calculated period-over-period change. The recent
path retains its current time window and response semantics.

Teacher pages request cumulative data by default, offer a visible recent
switch, and label the selected semantic. The student growth surface labels the
portrait generation time rather than implying a recent activity window.

## Risks / Trade-offs

- [A batch may partially finish] → Durable fenced requests remain pending or
  retryable; class tasks are held until every selected learner validates.
- [A student's facts make no portrait contribution] → The learner remains an
  eligible historical-fact candidate, completes with an explicit no-evidence
  outcome, receives no synthetic portrait, and still contributes its current
  class id to the cumulative class target set.
- [A roster changes during a run] → The class worker reads the roster at
  materialization time, which matches the locked current-membership rule.
- [Cumulative labels could be confused with recent signals] → Separate
  materialization versions, scope metadata, and UI labels keep trend/risk
  semantics explicit.
- [Large cohorts increase queue load] → Direct jobs use deterministic ids,
  existing worker concurrency/retry behavior, and operator dry-run/pilot
  controls; no unbounded in-process parallelism is introduced.

## Migration Plan

1. Deploy the code and run focused tests plus PostgreSQL/Redis integration
   verification against a disposable environment.
2. Before production apply, create a completed database backup, verify local
   and remote SHA-256 values, and run `pg_restore -l`.
3. Run dry-run and record candidate, current-class, and no-evidence counts.
4. Run `--apply --run-id=<stable-id> --limit=5 --wait`; verify learner and
   teacher APIs/pages for the pilot.
5. Run the full `--apply --run-id=<stable-id> --wait` and verify every target
   learner has a valid portrait and every target class has the cumulative
   version.
6. If rollback is needed, stop the cumulative jobs and restore the UI/API
   default to `recent`. Raw facts and recent snapshots are unaffected.

## Open Questions

None. The cumulative evidence boundary, current roster definition, and default
teacher scope are fixed by the approved plan.
