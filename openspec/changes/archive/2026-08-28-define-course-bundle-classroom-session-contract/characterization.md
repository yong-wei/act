# Characterization and Identity Ledger

Source revision: `653b4a7cd0cedf3e70902411404f0c297cd00901` (`origin/integration`, 2026-08-28)
Dependency inputs: archived `2026-08-26-establish-modular-monolith-refactor-charter`,
archived `2026-08-26-enforce-modular-domain-dependency-contracts` (qualified).

## 1. Frozen denominator

| Surface | Count | Evidence |
| --- | --- | --- |
| Identity registry course families | 32 | `INTERACTIVE_LESSON_IDENTITY_REGISTRY` in `src/lib/interactive-lesson-identity.ts` (cruise + 1-1 handwritten, 30 `unitRecord`) |
| Runtime lesson directories | 34 | `course-content/runtime/lessons/` (32 registry-mapped + 2 non-registry content dirs) |
| Private course route surfaces | 96 | 32 landing pages + 64 `[role]/[sessionId]` pages under `src/app/interactive-learning/courses/**` |
| `ClassSession` create writer | 1 | `src/app/api/session/route.ts` (`db.classSession.create`) |
| Session-bound runtime readers | 64 | every course role page calls `loadLessonRuntimeEntry('<canonicalId>')` with a hardcoded id; none reads the session binding today |
| Plan-title → route resolver | 3 callers | `classroom-session-route.ts` (`buildSessionParticipantHref`), `session-lesson-snapshot.ts` (`loadSessionLessonSnapshot`), `api/session/join` |
| Active-release lookups in session paths | 2 | `projectRuntimeMediaResources` (`course-runtime.ts`), `api/course-runtime/assets/[...assetPath]` |
| Authoring reads in runtime loading | 1 | `LESSON_ID_MAP_PATH` = `course-content/authoring/shared/lesson-id-map.json` via `loadRuntimeLessonDirIndex` |
| Generated-courseware launch path | 1 | `api/session/route.ts` publication-revision projection (`generatedBinding`) |
| Generated-courseware read guard | 4 pages | `resolveGeneratedCoursewareSessionBinding` used by teacher/student/review pages and `api/session/[sessionId]` |

Observed counts reconcile with the proposal's frozen baseline (32 families, ≈96 route
surfaces); the difference to 34 runtime dirs is recorded as non-registry content dirs
that no identity record resolves (see §3).

## 2. Current behavior (pre-change)

### 2.1 Session creation (`src/app/api/session/route.ts`)

- Generated courseware: publication revision is verified (single projection,
  `generatedCoursewareManifestHash === publication.manifestHash`, ownership) and the
  session stores `coursewarePublicationRevisionId` + denormalized display/revision
  fields; `manifestHash` equals the publication manifest hash. Immutable and strong.
- Ordinary runtime-bound lessons: `resolvePlanRuntimeBindings` requires one consistent
  `sourcePresetKey` + `runtimeLessonId` across items; creation cross-checks preset and
  runtime identity resolution against the same `canonicalId` and snapshots the current
  `interactive-manifest.json` bytes (`loadRuntimeLessonManifestSnapshot`) into
  `lessonVersion`/`manifestHash`/`totalSteps`. The snapshot captures today's active
  runtime content but the session stores no release locator, no bundle digest, and no
  per-resource hashes, so later reads cannot prove they served the same bytes.
- Ordinary lessons without runtime binding: `loadSessionLessonSnapshot(plan.title)`
  resolves the lesson from the mutable plan title. This is the title-authority fallback.
- Duplicate-session detection keys on `plan.title` for preset flows (compatibility; not
  identity authority for new sessions after this change).

### 2.2 Participant routing (`src/lib/classroom-session-route.ts`)

`buildSessionParticipantHref({ planTitle })` resolves the interactive route segment from
the mutable plan title. Every session entry (teacher page, student page, join API)
derives the participant route this way, so a plan-title change mid-session can move the
classroom to a different lesson family.

### 2.3 Session-bound runtime reads (64 role pages)

Each page hardcodes its canonical id (e.g. `loadLessonRuntimeEntry('1-1')`), reads the
current runtime directory, and never compares the served bytes with the session's
`manifestHash`. Switching the active runtime or editing runtime files mid-session
silently serves different content to an active classroom.

### 2.4 Media projection and asset delivery

- `projectRuntimeMediaResources` reads the active release manifest; media without a
  release object stays `pending` (no authoring fallback — already fail-closed for
  presence, but identity follows the active release, not the session).
- `api/course-runtime/assets/[...assetPath]` looks the object up in the active release
  manifest and signs an OSS URL. After an active-release switch the same runtime path
  resolves to the new release's bytes.

### 2.5 Identity resolution fallbacks (`src/lib/course-runtime.ts`)

`resolveLessonRuntimeFragment` tries the identity registry, then the authoring
`lesson-id-map.json` index, then treats the input as a directory name. The authoring
read and the raw-name fallback are unbounded for session-bound loads.

### 2.6 Runtime release manifests

`readActiveRuntimeReleaseManifest` reads the mounted v1/v2 manifest (v2 receipt-fenced).
Local development typically has no mounted manifest (returns `null`); production binds
`releaseId`, `treeSha256`, `manifestSha256`, `sourceRevision`, and per-file
`objectKey`/`sha256` (`ActRuntimeReleaseFile`).

## 3. Identity alias families (frozen)

- 32 registry records with alias kinds: `canonicalId`, `routeSegment`,
  `runtimeLessonDir`, `lessonKey`, `presetKey`, `planTitleAlias`, `evidenceAlias`.
- Plan-title matching is prefix-normalized (`normalizePlanTitle`); ambiguous or unknown
  aliases return `unsupported` — no guessing (retained as ingress-only after this change).
- Non-registry runtime dirs (34 − 32) are reachable only through the raw-name fallback
  in `resolveLessonRuntimeFragment` for non-session catalog surfaces; they never qualify
  as a session bundle.

## 4. Compatibility reader ledger

Each row names the owner surface kept working during the expand phase, its replacement,
and the deletion condition.

| # | Compatibility reader | Owner | Replacement | Deletion condition |
| --- | --- | --- | --- | --- |
| C1 | Title-authority snapshot `loadSessionLessonSnapshot(plan.title)` at creation | `api/session/route.ts` | captured `CourseBundleRevision` binding | all new sessions write the binding; creation rejects un-bindable plans (this change ships the switch; C1 keeps only for legacy re-reads until the last pre-binding session ends) |
| C2 | `buildSessionParticipantHref({ planTitle })` | teacher/student pages, join API | route from captured `canonicalLessonId` binding | sessions without a binding are classified legacy and keep C2; delete when legacy sessions expire |
| C3 | Authoring `lesson-id-map.json` index in `loadRuntimeLessonDirIndex` | non-session catalogs (`loadAllLessonRuntime*`, teacher resource-node APIs) | filesystem enumeration already merged in `loadRuntimeLessonFragmentsFromContent` | delete the authoring read once catalog consumers accept filesystem enumeration only (this change removes it from all session-bound paths; directory enumeration keeps authoring index merged until the catalog migration retires it) |
| C4 | Raw-name fallback `index[lessonId] ?? lessonId` in `resolveLessonRuntimeFragment` | non-session catalog reads | registry/canonical resolution | bounded ingress only; session-bound loads use the captured binding with no fallback (this change) |
| C5 | Active-release media projection `projectRuntimeMediaResources` | course role pages, handout/media APIs | release-bound media projection via captured locator | all session-bound callers pass the captured release locator (this change); C5 remains only for non-session catalogs |
| C6 | Active-release asset API without release pin | `/api/course-runtime/assets` | `?releaseId=` pinned lookup with per-file hash | keep unpinned variant for non-session surfaces; session media URLs always pinned (this change) |
| C7 | Duplicate-session detection by `plan.title` | preset start flow | unchanged (UX duplicate check, not persisted identity) | out of contract; recorded for audit |

## 5. Legacy session classes

- `legacy-incomplete`: rows with `courseBundleRevisionId IS NULL` after this change
  ships. Classified on read; compatibility readers C1/C2 serve them; never rebound.
- `bound`: rows with a complete binding whose denormalized fields equal the referenced
  revision; any disagreement is `drift` and fails closed with an integrity incident.

## 6. Migration status ledger

| Step | Status | Evidence |
| --- | --- | --- |
| Expand schema (`CourseBundleRevision`, nullable session binding) | this change | `prisma/migrations/<ts>_course_bundle_revision/` |
| Bundle capture + qualification at creation | this change | `src/lib/course-bundle/*` tests |
| Session-bound readers use captured binding | this change | role pages + course-runtime hash verification |
| Media/asset release pinning | this change | `projectRuntimeMediaResources(binding)`, assets `?releaseId=` |
| Title/authoring fallback retirement for bound sessions | this change (bound sessions only) | C1–C6 ledger |
| Historical session rebinding | prohibited | none performed |
