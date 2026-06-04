## Context

Existing Konling specs already require server-owned adaptive context, scoped tools, governed memory, simulation tools, intervention outcomes, and auditable tool runs. This change tightens the contract for the control-correction path so every coaching action is grounded in current path context and citations.

## Goals / Non-Goals

**Goals:**

- Load page context, learner-state slice, path round, recent evidence, memory summaries, and permitted tools before path coaching.
- Require citations for conceptual answers, personalized recommendations, simulation failure analysis, Arena correction, and report explanations.
- Persist citation records or citation references for answer, recommendation, and intervention owners.
- Make weak or missing evidence visible in response rationale.

**Non-Goals:**

- Replacing the Konling runtime.
- Building the full model-provider matrix.
- Letting Konling mutate controller state without approval.

## Decisions

### Decision 1: Citations are mandatory for coaching claims

Student-facing path recommendations and failure analyses must cite content and learner/path evidence. Low-confidence responses must say why they are tentative.

### Decision 2: Server context wins over client hints

Client page hints may help resolve UI context, but they must not expand scope, bypass privacy, or invent path context.

### Decision 3: Intervention outcomes feed the loop

Accepted, ignored, rejected, and partially accepted interventions must be persisted so later evidence cache and teacher-report changes can measure coaching effect.

## Validation

- Runtime tests SHALL reject or downgrade path coaching responses that require citations but have none.
- Tool-scope tests SHALL prove client-provided hints cannot expand user, class, path, or resource scope.
- `rtk openspec validate enforce-cited-konling-path-coaching --strict` SHALL pass.
