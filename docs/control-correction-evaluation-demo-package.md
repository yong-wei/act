# Control Correction Evaluation Demo Package

This package is the release proof for the control-correction closed loop. It is a synthetic, resettable demo package, not production seed data.

## Demo Storyline

The demo class contains three synthetic learners working on the `control-correction` goal. One learner completes the path from learner-state diagnosis through simulation and Arena validation. A second learner triggers a low-confidence simulation fallback, receives cited Konling coaching, and is routed back to the time-domain resource before terminal validation. The teacher report then summarizes simulation pass rate, citation coverage, and redacted export readiness.

Expected reviewer checkpoints:

- Learner state exposes `control-correction` dimensions and an active path id.
- The path contains resource, simulation, and Arena nodes.
- Node execution evidence is scoped to the demo tenant and demo class.
- Konling coaching includes content citations and evidence citations when available.
- Konling citations point to reviewable routes: `/interactive-learning/resources/lesson09-correction-precheck` and `/arena/challenges/task-second-order-lead-pid`.
- Low-confidence validation and fallback are explicitly marked.
- Teacher export is redacted and contains methodology, not raw payloads.

## Setup And Reset

The canonical fixture is `CONTROL_CORRECTION_DEMO_PACKAGE` in `src/lib/data-governance/control-correction-demo-package.ts`.

Reset ownership:

- Class cleanup selector: `tenantId=demo-control-correction-tenant AND classId=demo-control-correction-class`
- Goal cleanup selector: `tenantId=demo-control-correction-tenant AND goalId=control-correction`
- Synthetic cleanup selector: `tenantId=demo-control-correction-tenant AND syntheticOnly=true`
- Idempotency key: `control-correction-demo-2026-06-05`

Run:

```bash
rtk npm run test:control-correction-demo
```

The command first runs offline fixture acceptance: deterministic install/reset records, privacy rules, documentation, provider references, rollback contract, and route/API contract coverage. It does not write production records.

For a local or staged deployment, add a base URL so the same command also performs HTTP route and API checks:

```bash
CONTROL_CORRECTION_DEMO_BASE_URL=http://localhost:3001 rtk npm run test:control-correction-demo -- --require-http
```

`--require-http` makes missing deployment checks fail instead of falling back to offline fixture acceptance.

Without authentication credentials, API checks must return an auth boundary response (`401` or `403`) rather than a server error. To require payload assertions against authenticated routes, provide `CONTROL_CORRECTION_DEMO_AUTH_COOKIE` from a valid NextAuth session. Bearer-token auth is not supported by these checked routes.

Authenticated payload checks require the target environment to have the demo fixtures installed first. Set `CONTROL_CORRECTION_DEMO_FIXTURES_INSTALLED=true` only after the demo course, class, students, learner-state/path records, simulation/Arena outcomes, and teacher-report evidence are present in that target database. If authentication is provided without this flag, the acceptance command fails instead of treating missing demo data as a valid deployment check.

## Route Checks

Expected browser route checks:

- `/assessment/adaptive-practice?goal=control-correction` includes `data-control-correction-center`.
- `/api/teacher/classes/demo-control-correction-class/control-correction-report` returns a control-correction report payload.

The route checks are recorded in the fixture so the same package can be reused by browser automation when a local or staged deployment is available.

## API Examples

Representative API checks:

```http
GET /api/adaptive/learner-state?goal=control-correction
```

Expected assertions: `goalId=control-correction`, active path reference present, missing or low-confidence dimensions marked.

```http
POST /api/learning-paths/plan
```

Representative body shape:

```json
{
  "classId": "demo-control-correction-class",
  "learnerStateRef": "learner-state-alpha",
  "plan": {
    "id": "demo-path-demo-student-alpha-control-correction",
    "userId": "demo-student-alpha",
    "goal": { "id": "control-correction" },
    "stage": "stage-1-rules-graph",
    "policyFamily": "rules-plus-graph-search",
    "mainPath": [
      {
        "nodeId": "knowledge-card:control-correction-time-domain-targets",
        "type": "knowledge_card",
        "privacyLevel": "student-visible",
        "teacherPolicy": "allowed",
        "target": "/interactive-learning/resources/lesson09-correction-precheck",
        "terminalConstraints": []
      },
      {
        "nodeId": "simulation:control-correction-step-response-lab",
        "type": "simulation",
        "privacyLevel": "student-visible",
        "teacherPolicy": "allowed",
        "target": "/simulations/cruise?resource=control-correction-step-response-lab",
        "terminalConstraints": []
      },
      {
        "nodeId": "arena-task:task-second-order-lead-pid",
        "type": "arena_task",
        "privacyLevel": "student-visible",
        "teacherPolicy": "allowed",
        "target": "/arena/challenges/task-second-order-lead-pid",
        "terminalConstraints": ["terminal-validation"]
      }
    ],
    "executionStatus": {
      "adopted": true,
      "completedNodeIds": ["knowledge-card:control-correction-time-domain-targets"],
      "activeNodeId": "simulation:control-correction-step-response-lab"
    }
  }
}
```

The actual request body is emitted by `buildControlCorrectionDemoPlanPostBody(...)` and is validated with `validateControlCorrectionPathPlanForPersistence(...)`; the excerpt above shows the fields that must remain aligned with the persistence route. Expected assertions: path id returned, resource graph node ids are scoped, fallback metadata is visible when confidence is low.

```http
GET /api/teacher/classes/demo-control-correction-class/control-correction-report?export=true
```

Expected assertions: export is redacted, metrics contain numerator, denominator, window, confidence, and governed source family.

## Metric Methodology

`simulationPassRate`

- Numerator: students with governed simulation terminal validation state `passed`.
- Denominator: students in the demo class with control-correction path rounds.
- Window: `2026-06-05T00:00:00.000Z/2026-06-05T23:59:59.999Z`.
- Source family: `simulation-runtime-summary`.
- Confidence: medium.
- Included population: demo class roster students with a control-correction path round and simulation/Arena outcome.
- Excluded population: none; all synthetic roster students are included.
- Source coverage: 3 of 3 synthetic roster students.

`citationCoverage`

- Numerator: Konling interventions with content citations and marked low-confidence fallback when needed.
- Denominator: Konling interventions emitted during demo path rounds.
- Window: `2026-06-05T00:00:00.000Z/2026-06-05T23:59:59.999Z`.
- Source family: `konling-citation-guard`.
- Confidence: high.
- Included population: Konling interventions emitted during demo path rounds.
- Excluded population: path rounds without a Konling intervention.
- Source coverage: 2 of 2 emitted interventions.

## Provider Configuration

Provider examples use secret references only:

- `env:DEMO_AI_API_KEY` for bearer OpenAI-compatible providers.
- `env:DEMO_LOCAL_GATEWAY_API_KEY` for local no-auth gateway examples.

The package must not store plaintext API keys. Provider capability checks require tools and streaming, and citation normalization is declared when the provider supports it.

## Privacy And Audit Controls

The package rejects:

- Raw secrets and bearer tokens.
- Real contact data.
- Raw answer bodies.
- Private Konling memory.
- Hidden Arena evaluator internals.
- Raw high-frequency traces.

Teacher exports must remain redacted and may include governed summaries, metric methodology, source families, confidence markers, and scoped evidence references.

## Deployment And Rollback

Deployment readiness:

- Runtime flags for path round persistence, learner-state service, and AI provider routing are enabled.
- Demo tenant cleanup selectors are present.
- Provider examples use environment secret references.
- Offline fixture acceptance passes.
- Local or staged HTTP acceptance passes with `--require-http`; authenticated payload assertions require demo auth credentials.

Rollback command:

```bash
rtk npx tsx scripts/tests/control-correction-demo-acceptance.ts --rollback-check
```

Rollback expectations:

- Runtime flags can be disabled: `CONTROL_CORRECTION_PATH_ROUNDS_ENABLED`, `ADAPTIVE_LEARNER_STATE_SERVICE_ENABLED`, and `AI_PROVIDER_ENABLED`.
- `--rollback-check` verifies the disabled behavior through the same runtime helpers used by the route and provider code.
- `AI_PROVIDER_ENABLED=false` only disables the environment fallback provider path. Persisted provider settings remain governed by admin provider configuration and are not claimed as disabled by this package.
- Demo tenant cleanup selector is present.
- Exports remain redacted.

## Release Readiness

The package is ready when:

- `rtk openspec validate control-correction-evaluation-demo-package --strict` passes for the archived main spec.
- `rtk openspec validate --changes --strict` and `rtk openspec validate --specs --strict` pass after archive.
- `rtk npm run test:control-correction-demo` passes for the offline fixture package.
- `CONTROL_CORRECTION_DEMO_BASE_URL=<local-or-staged-url> rtk npm run test:control-correction-demo -- --require-http` passes before claiming a deployed demo check.
- Strict OpenSpec validation for remaining changes passes.
- Fixture privacy scan finds no real student data, raw secrets, hidden Arena internals, raw traces, raw answer bodies, or private Konling memory.

Known non-goals:

- This package does not implement missing upstream features.
- This package does not create marketing-only screenshots.
- This package does not write production data.
