# Intelligent Teaching Assistant Demo Package

This package is the release proof for the intelligent teaching assistant product loop. It is a synthetic, resettable demo package, not production seed data.

## Demo Storyline

The demo class contains three synthetic learners and one synthetic teacher. The product story starts from role-based diagnosis, moves through path choice and resource execution, uses document-rubric grading and student feedback, then closes with class reporting, fixture-backed teacher prep-pack evidence, and Konling mode sessions with citations.

Expected reviewer checkpoints:

- Student diagnosis and teacher diagnosis views expose evidence-backed dimensions and redaction state.
- The adaptive path includes a selected node, alternatives, and citations.
- Resource execution context launches `resource-coach` instead of a generic chat fallback.
- The grading workbench and feedback page use cited document-rubric evidence.
- Teacher reports expose metric methodology and redacted export policy.
- Prep packs use server-owned signed context and cite class evidence.
- Konling covers `generic-chat`, diagnosis, path, resource, grading, feedback, class summary, and prep coauthoring modes.
- Unavailable-state handling is represented for every mode.

## Setup And Reset

The canonical fixture is `INTELLIGENT_TEACHING_ASSISTANT_DEMO_PACKAGE` in `src/lib/data-governance/intelligent-teaching-assistant-demo-package.ts`.

Reset ownership:

- Class cleanup selector: `tenantId=demo-intelligent-teaching-assistant-tenant AND classId=demo-ita-class AND demoPackage=intelligent-teaching-assistant`
- Synthetic cleanup selector: `tenantId=demo-intelligent-teaching-assistant-tenant AND syntheticOnly=true AND demoPackage=intelligent-teaching-assistant`
- Demo package selector: `tenantId=demo-intelligent-teaching-assistant-tenant AND demoPackage=intelligent-teaching-assistant`
- Idempotency key: `intelligent-teaching-assistant-demo-2026-06-05`

Run:

```bash
rtk npm run test:intelligent-teaching-assistant-demo
```

The command runs offline fixture acceptance: deterministic install/reset records, product-surface coverage, citation policy, privacy scan, provider prerequisites, rollback contract, and documentation checks. It does not write production records.

For a local or staged deployment, add a base URL so the same command also performs HTTP route and API checks:

```bash
INTELLIGENT_TEACHING_ASSISTANT_DEMO_BASE_URL=http://localhost:3001 \
INTELLIGENT_TEACHING_ASSISTANT_DEMO_STUDENT_AUTH_COOKIE='next-auth.session-token=...' \
INTELLIGENT_TEACHING_ASSISTANT_DEMO_TEACHER_AUTH_COOKIE='next-auth.session-token=...' \
INTELLIGENT_TEACHING_ASSISTANT_DEMO_FIXTURES_INSTALLED=true \
rtk npm run test:intelligent-teaching-assistant-demo -- --require-http
```

`--require-http` makes missing deployment checks fail instead of falling back to offline fixture acceptance.

Without `--require-http`, unauthenticated protected API checks may return an auth boundary response (`401` or `403`) rather than a server error. With `--require-http`, every checked route and API must return a successful `2xx` response and the expected marker or payload assertion. Because the checked product loop crosses both student and teacher surfaces, provide both `INTELLIGENT_TEACHING_ASSISTANT_DEMO_STUDENT_AUTH_COOKIE` and `INTELLIGENT_TEACHING_ASSISTANT_DEMO_TEACHER_AUTH_COOKIE` from valid NextAuth sessions. `INTELLIGENT_TEACHING_ASSISTANT_DEMO_AUTH_COOKIE` remains a non-require fallback for local auth-boundary checks; it is not sufficient for full product-surface acceptance. Bearer-token auth is not supported by these checked routes.

Authenticated payload checks require the target environment to have synthetic demo fixtures installed first. Set `INTELLIGENT_TEACHING_ASSISTANT_DEMO_FIXTURES_INSTALLED=true` only after the demo class, students, diagnosis views, paths, grading runs, prep packs, Konling sessions, reports, citations, and exports are present in that target database.

The HTTP target is restricted before any credential is sent. `INTELLIGENT_TEACHING_ASSISTANT_DEMO_BASE_URL` may point to `localhost`, `127.0.0.1`, or `::1` by default. A non-loopback target must be HTTPS and must exactly match `INTELLIGENT_TEACHING_ASSISTANT_DEMO_ALLOWED_ORIGIN`.

## Route Checks

Expected browser route checks:

- `/assessment/adaptive-practice?goal=control-correction` includes `data-control-correction-center`.
- `/teacher/grading-workbench?demo=1` includes `data-intelligent-teaching-assistant-demo-surface="document-grading-workbench"`.
- `/assessment/document-feedback?demo=1` includes `data-intelligent-teaching-assistant-demo-surface="document-feedback"`.
- `/teacher/classes/demo-ita-class/analytics-v2` includes `data-intelligent-teaching-assistant-demo-surface="teacher-class-analytics"`.
- `/teacher/classes/demo-ita-class/students/demo-ita-student-beta` includes `data-intelligent-teaching-assistant-demo-surface="teacher-student-insights"`.

The fixture records these route checks so browser automation can reuse the same package when a local or staged deployment is available. The class and student insight routes use stable shell-level surface markers so raw HTTP can verify the route frame before client-side data hydration; `--require-http` also verifies their backing APIs. Prep-pack review is verified through resettable fixture records, citations, signed context metadata, and acceptance checks; this package does not claim a separate prep-pack review page until that surface exists.

## API Examples

Representative API checks:

```http
GET /api/adaptive/learner-state?goal=control-correction
```

Expected assertions: the `control-correction` goal slice exposes the real learner-state contract: `goalId`, non-empty `dimensions`, and `pathContext.activePathId` or `pathContext.noActivePath`.

```http
POST /api/learning-paths/plan
```

Expected assertions: the plan response contains a `control-correction` path id.

The request body follows the real route contract: `classId`, `learnerStateRef`, `inputSnapshot`, and `plan.goal.id/userId/id`.

```http
POST /api/learning-paths/demo-path-demo-ita-student-alpha-control-correction/execute
```

Expected assertions: the execution response contains an execution node id and cache refresh status. The request body includes `nodeId`, `resourceType`, `status`, `idempotencyKey`, and `evidenceRefs`.

```http
POST /api/teacher/document-grading/approve
```

Expected assertions: the approval response contains `gradingRunId`, `createdFacts`, and evidence source event references.

```http
POST /api/ai/chat
```

Representative body shape:

```json
{
  "messages": [
    { "role": "user", "content": "Explain the current demo mode with citations." }
  ],
  "courseId": "demo-control-correction-course",
  "pageId": "intelligent-teaching-assistant-demo",
  "teachingAssistantModeId": "generic-chat",
  "modeClientContextHints": {
    "demoPackage": "intelligent-teaching-assistant",
    "syntheticOnly": true
  }
}
```

The acceptance command sends this request once per required mode: `generic-chat`, `diagnosis-explainer`, `path-advisor`, `resource-coach`, `grading-assistant`, `feedback-explainer`, `class-summarizer`, and `prep-coauthor`. Expected assertions: the mode runtime contract and citation guard handle the request.

```http
GET /api/teacher/classes/demo-ita-class/control-correction-report?export=true
```

Expected assertions: export is redacted and metrics include methodology.

```http
GET /api/teacher/classes/demo-ita-class/insights
GET /api/teacher/classes/demo-ita-class/heatmap
GET /api/teacher/classes/demo-ita-class/students/demo-ita-student-beta/insights
```

Expected assertions: the class insights response identifies `demo-ita-class`, exposes a non-empty student roster and governance summary; the heatmap response exposes students, dimensions, and matrix rows; the student insights response identifies `demo-ita-student-beta`, exposes an overview score, and includes evidence summary items.

## Metric Methodology

`diagnosisCoverage`

- Numerator: students represented by student or teacher-student diagnosis views, plus path fixtures where applicable.
- Denominator: synthetic class roster.
- Window: `2026-06-05T00:00:00.000Z/2026-06-05T23:59:59.999Z`.
- Source family: `role-based-learning-diagnosis`.
- Confidence: medium.
- Source coverage: 3 of 3 synthetic roster students.

`gradingFeedbackCoverage`

- Numerator: grading runs with visible feedback and citations.
- Denominator: synthetic grading runs.
- Window: `2026-06-05T00:00:00.000Z/2026-06-05T23:59:59.999Z`.
- Source family: `document-rubric-grading`.
- Confidence: high.
- Source coverage: 2 of 2 grading runs.

`konlingModeCoverage`

- Numerator: required Konling modes with scoped context and citations.
- Denominator: required demo Konling modes.
- Window: `2026-06-05T00:00:00.000Z/2026-06-05T23:59:59.999Z`.
- Source family: `konling-agent-runtime`.
- Confidence: medium.
- Source coverage: 8 of 8 required modes.

## Provider Configuration

Provider examples use secret references only:

- `env:DEMO_AI_API_KEY` for OpenAI-compatible providers.
- `env:DEMO_ANTHROPIC_API_KEY` for Anthropic-compatible providers.

The package must not store plaintext API keys. Provider capability checks require tool use, streaming, and citation support.

## Privacy And Citation Controls

The package rejects:

- Raw secrets and bearer tokens.
- Real contact data.
- Raw answer bodies.
- Private Konling memory.
- Hidden Arena evaluator internals.
- Raw traces.

Every diagnosis view, path plan, grading run, teacher report, prep pack, and Konling session must include reviewable citations. Teacher exports must remain redacted and may include governed summaries, metric methodology, source families, confidence markers, and scoped evidence references.

## Deployment And Rollback

Deployment readiness:

- `AI_PROVIDER_ENABLED` is enabled when provider-backed acceptance is expected.
- `KONLING_SERVER_MODE_CONTEXT_SECRET` is configured when signed teacher class and prep-pack mode context is required.
- `DOCUMENT_RUBRIC_GRADING_ENABLED` is enabled when the grading workbench is expected to run beyond fixture acceptance.
- Demo tenant cleanup selectors are present.
- Provider examples use environment secret references.
- Offline fixture acceptance passes.
- Local or staged HTTP acceptance passes with `--require-http` before claiming deployed readiness.

Rollback command:

```bash
rtk npx tsx scripts/tests/intelligent-teaching-assistant-demo-acceptance.ts --rollback-check
```

Rollback expectations:

- `AI_PROVIDER_ENABLED=false` disables the environment fallback provider path.
- Removing `KONLING_SERVER_MODE_CONTEXT_SECRET` prevents signed server mode context generation without exposing fixture secrets.
- Demo tenant cleanup selectors remain available.
- Teacher exports remain redacted.

## Release Readiness

The package is ready when:

- `rtk npm run test:intelligent-teaching-assistant-demo` passes for offline fixture acceptance.
- `INTELLIGENT_TEACHING_ASSISTANT_DEMO_BASE_URL=<local-or-staged-url>` plus student and teacher auth cookies passes `rtk npm run test:intelligent-teaching-assistant-demo -- --require-http` before claiming deployed demo readiness.
- `rtk openspec validate package-intelligent-teaching-assistant-demo --strict` passes before archive.
- `rtk openspec validate --changes --strict` and `rtk openspec validate --specs --strict` pass after archive.
- Fixture privacy scan finds no real student data, raw secrets, hidden Arena internals, raw traces, raw answer bodies, or private Konling memory.

- This package does not implement missing upstream features.
- This package does not create marketing-only screenshots.
- This package does not write production data.
