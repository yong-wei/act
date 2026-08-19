## Context

The persisted `DiagnosisReport` and its teacher-only history projection are stable. Reports contain governed summaries, findings, coverage, limitations, evidence cutoff, version lineage, and server-generated preparation links. Evidence references are internal and must not cross a delivery boundary. The application already uses PostgreSQL, Prisma, `pdf-lib`, fontkit, server-owned teacher/class authorization, and registered `TeachingResource` metadata.

## Goals / Non-Goals

**Goals:**

- Make one report version addressable as teacher and student-safe projections.
- Make PDF content deterministic and independently auditable from export events.
- Keep evidence summaries, destination links, and disposition decisions fail-closed.
- Preserve risk truth while adding human workflow state.

**Non-Goals:**

- Generating or rewriting diagnosis prose.
- Sending reports or creating preparation packs, resources, assignments, or interventions.
- Deriving personal conclusions from a class-scoped report.
- Treating disposition completion as evidence resolution.

## Decisions

### Separate canonical projection, artifact, and access event

A pure projection builder will validate the stored report and emit allowlisted teacher or student-safe JSON. Its canonical JSON hash is the content identity. `DiagnosisReportExportArtifact` stores one immutable PDF artifact per report, projection version, role version, and audience. `DiagnosisReportExportEvent` records each successful download.

This separates repeatable content from actor/time audit. Updating a single “last exported” row was rejected because it destroys history; storing only events was rejected because artifact identity and bytes could drift between exports.

### Render deterministic PDFs directly

The PDF renderer will use `pdf-lib` and an embedded repository/system Chinese font resolved through an explicit allowlist. Document metadata dates derive from the persisted report time, page layout is fixed, and saved bytes use stable input order. The artifact stores bytes and hashes so repeat exports never depend on browser rendering or runtime font drift.

Chromium print-to-PDF was rejected for the official artifact because browser metadata, font resolution, and page timing make byte reproducibility and fail-closed identity harder. The HTML detail page still supplies print CSS for direct presentation.

### Authorize from report ownership and audience, never request hints

Teacher routes resolve the authenticated teacher, persisted report, owning class, and optional current target membership. Student routes resolve the authenticated user and require `targetUserId` equality. Projection type is fixed by the route. A class report cannot enter the student projection.

Teacher preview and student self-service use the same student projection version and audience identity. Teacher-only force reasons, internal notes, peer aggregates, dispositions, and action links are absent from that projection.

### Summarize evidence without resolving raw evidence rows

Each finding exposes counts grouped by allowlisted evidence source family plus report-level cutoff and limitations. It does not return internal IDs or raw row values. A finding without governed evidence receives an explicit unavailable state.

Resolving and displaying underlying evidence rows was rejected because the current report contract does not define a safe per-source public projection.

### Resolve action destinations on the server

Student and preparation links derive from the authorized report scope and existing routes. Remediation links require a `TeachingResource` owned by the teacher, bound to the finding knowledge node, and backed by an existing registry entry or safe content URL. The API returns no remediation action when this proof is absent.

### Model disposition as append-only events

`DiagnosisReportDispositionEvent` uses a stable report/finding target and server-validated action enum. Idempotency is unique per report and teacher. Current state is the newest event; history remains immutable. An intervention-arranged event may store only an already-existing authorized action reference. No disposition write touches report, risk, portrait, progress, grade, or recommendation tables.

## Risks / Trade-offs

- [PDF font unavailable in a minimal runtime] → Resolve only packaged or known system fonts, validate glyph embedding before persistence, and return a recoverable failure without an export event.
- [Stored PDF bytes increase database size] → Reports are small text artifacts and each role/audience/version identity stores at most one artifact; indexes support bounded lookup.
- [Legacy reports contain weakly structured findings] → Projection validation shows unavailable evidence/action states and never infers student or remediation identity.
- [A resource is removed after an artifact is created] → The fixed artifact remains auditable; live action links are resolved on current authorization and may become unavailable.
- [Concurrent first export or repeated disposition] → Unique identities plus transaction-safe create-or-read behavior prevent duplicate artifacts and idempotent events.

## Migration Plan

1. Add artifact, export-event, and disposition-event tables with restrictive report/user relations and uniqueness constraints.
2. Deploy projection and persistence code; no backfill is required because artifacts and events are created on demand.
3. Deploy authorized routes and UI entry points.
4. Rollback by removing entry points first. Existing audit rows remain inert and can be retained until a later schema cleanup migration.
