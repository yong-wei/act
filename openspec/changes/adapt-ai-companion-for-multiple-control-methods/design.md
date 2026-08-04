## Context

The companion panel and intervention engine currently encode one PID experiment directly into their state, thresholds, and Chinese guidance. Arena already has an authoritative static task registry: each task declares allowed methods and references a `MetricProfile` with metric direction and unacceptable boundaries. The authenticated intervention route currently authorizes scope but has no Arena task context, so a caller cannot receive method-aware guidance.

The change must support genuine learning assistance without allowing advisory output to become a substitute for official Arena evaluation or governed wrong-answer attribution. Official Arena submissions, LearningFacts, portraits, rankings, and hidden scenario internals remain owned by their existing service boundaries.

## Goals / Non-Goals

**Goals:**

- Use registered task, method, and metric definitions as the sole configuration source for Arena companion guidance.
- Preserve legacy generic/PID intervention behavior for existing non-Arena callers.
- Provide distinct, evidence-limited learning guidance for MPC and black-box control.
- Reject unknown tasks and methods not allowed by the registered task before generating Arena-context guidance.

**Non-Goals:**

- Change official evaluation formulas, hard-constraint enforcement, ranking, challenge definitions, or hidden scenario disclosure rules.
- Persist a companion attempt as an official submission, LearningFact, portrait update, or wrong-answer attribution.
- Infer a formal error cause from a manually recorded result or create remediation resources.
- Add database schema, migrations, model calls, or a new task authoring workflow.

## Decisions

### Derive an immutable companion context from the Arena registry

A shared resolver takes an Arena task ID and method, verifies that the method is in `allowedMethods`, and returns a context containing only task-owned method metadata and `MetricProfile` metric definitions. The client uses the same resolver to render the relevant input labels; the server resolves it again before invoking the governed Konling service. Sending arbitrary client thresholds, metric labels, or instructional content was rejected because it would let callers alter the interpretation contract.

### Make the intervention engine context-aware but preserve its legacy default

`shouldIntervene` and `generateIntervention` accept an optional companion context. With one, threshold detection uses metric direction and `unacceptableValue`, and generated explanation/action text uses the selected method and available metrics. Without one, the existing PID-oriented behavior remains unchanged for generic Konling use. Replacing the legacy default outright was rejected because current callers lack task identities and would otherwise receive an unreviewed behavior change.

### Scope governed intervention cooldowns to the selected Arena method

The governed intervention session identity appends the server-resolved Arena task and method when Arena context is present. The same identity is used for cooldown lookup, intervention persistence, and intervention-outcome memory. The stored evidence also includes a structured task-method reference. This preserves cooldown protection for repeated guidance in the same method while allowing a student who switches to another registered method to receive that method's distinct guidance.

### Treat companion output as advisory evidence interpretation

The context accepts only observations of the current practice attempt. It can identify an out-of-bound metric and recommend a next learning action, but labels the statement as a practice observation rather than an official result or error cause. Formal wrong-answer attribution continues to require its existing reviewed, immutable evidence path; official Arena feedback continues to be generated from official submissions. Reusing the companion output as a formal attribution was rejected because its inputs are not a governed answer-time evidence record.

### Keep hidden evaluation details out of method guidance

For tasks with hidden scenarios, the context can describe the aggregate metric and encourage robustness work, but it cannot expose scenario parameters, order, trace data, or unofficial pass/fail detail. The metric profile is sufficient for a useful aggregate suggestion and matches the established Arena student-feedback secrecy boundary.

## Risks / Trade-offs

- [A task registry metric may be absent from a manually captured attempt] -> Ignore the missing metric for threshold detection and state only available observations; never replace it with zero.
- [A registered task permits several methods] -> Require the selected method and validate membership in `allowedMethods` on both client resolution and server generation.
- [A method-specific cooldown suppresses another method's guidance] -> Include the server-resolved task and method in the governed intervention identity, cooldown query, persisted record, and evidence reference.
- [Existing generic callers could regress] -> Keep the no-context branch intact and add explicit PID compatibility tests.
- [Guidance could be mistaken for an official conclusion] -> Use advisory language and exclude all official-result and learning-record writes from this change.

## Migration Plan

1. Release the shared resolver and optional context-aware engine path.
2. Update the panel and route to use the resolver for Arena-context requests.
3. Roll back by removing the optional Arena context input; legacy intervention behavior remains available without data migration.

## Open Questions

None. The task registry and metric profiles provide the required method and metric authority, while existing wrong-answer attribution remains the formal evidence boundary.
