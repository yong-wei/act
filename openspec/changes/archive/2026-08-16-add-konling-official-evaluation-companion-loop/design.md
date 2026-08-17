## Context

Arena-bound control workbenches submit controller artifacts to `/api/arena/evaluate`. The persisted `ArenaSubmission` retains the task identity, scoped owner context, controller artifact, official metrics, hard-constraint results, and submission time. The official submission panel already renders the formal result.

The existing companion intervention engine instead accepts client-shaped attempt records and contains generic metric thresholds. That makes it unsuitable as an authority for formal-task constraints. The Konling runtime already persists scoped intervention records, feedback, evidence references, and cooldown data, but its current cooldown is time-based rather than tied to one official result.

## Goals / Non-Goals

**Goals:**

- Ground control-workbench companionship in persisted official Arena submissions.
- Explain formal-task failures without recreating or modifying task standards.
- Preserve one verifiable intervention round from official result through resubmission comparison.
- Reuse governed Konling intervention, feedback, privacy, and audit boundaries.

**Non-Goals:**

- Support preview-only runs, free exploration, or arbitrary `/simulations/*` routes.
- Change official evaluation, controller parameters, task constraints, rankings, learning facts, or learning-path planning.
- Infer task thresholds from generic metrics or declare an objectively best controller.
- Create a new intervention center or a second learner-history store.

## Decisions

### Read official submissions through a task-scoped adapter

The companion will construct an in-memory official-evaluation attempt sequence from persisted submissions belonging to the authenticated student and the current task. Each attempt carries the submission reference, official validity, controller artifact parameters, metrics, and hard-constraint outcomes. The adapter is a read model for intervention decisions; it does not create learner facts or a second persisted attempt table.

Preview metrics, client-provided attempts, and ordinary simulation runs are excluded. This selects the evidence that already owns formal validity and keeps the companion from silently creating a competing standard.

### Use task-owned hard constraints and ordered intervention reasons

Any failed hard constraint comes directly from the current official result. The companion never applies the old generic overshoot, comfort, or stability-margin thresholds as task validity rules.

When more than one signal is present, the companion chooses exactly one reason in this order: parameter-change stagnation, two consecutive task failures, then current hard-constraint failure. This makes later rounds more informative than repeating the first constraint hint.

Parameter-change stagnation means three consecutive official submissions for the same task changed controller parameters while the failed-hard-constraint set stayed the same. Consecutive failure means the latest two submissions for the same task are both invalid.

### Treat an intervention as a single verifiable round

An intervention stores a reference to the official submission that caused it. The next official submission for the same student and task closes that round and is compared only with the stored baseline. The result card reports metric deltas and hard-constraint state changes without inferring overall superiority from one metric.

If the follow-up remains eligible for intervention, it starts a new round from that new submission. An older suggestion is not kept open across multiple submissions because its context can become stale.

### Deduplicate by official submission rather than elapsed time

The system deduplicates a companion intervention by the scoped official submission reference. The existing cooldown continues to prevent a repeated prompt for that exact result, but it does not suppress a new intervention after a completed follow-up. This preserves duplicate protection without forcing a student to wait after a legitimate resubmission.

### Keep the student in control

The result panel hosts one expandable companion card. It surfaces official evidence and proposes an adjustment direction, but never applies a controller patch or submits an artifact. Student ratings remain optional outcome records for reporting and future governed analysis; they do not prove mastery, modify evaluation, or trigger path generation.

## Risks / Trade-offs

- [Historical submission lacks enough scoped data for a comparison] → Show the current official result without a companion comparison and do not fabricate a baseline.
- [Task-specific metric names differ] → Render official labels and values; advice is constrained to the formal result rather than a metric-name-specific template.
- [Repeated invalid submissions cause excessive prompts] → Render one card per submission and keep the round-based deduplication key.
- [Intervention feedback is mistaken for learning evidence] → Preserve it as an intervention outcome only and exclude it from mastery or task-attainment claims.

## Migration Plan

1. Add the scoped official-evaluation adapter and intervention-round evidence references behind the existing formal submission flow.
2. Add the result-panel card and follow-up comparison only for supported Arena-bound workbenches.
3. Validate scope isolation, duplicate submission handling, and the no-path-mutation boundary before enabling the surface.
4. Roll back by disabling the card and adapter invocation; official evaluation and existing submission history remain unchanged.
