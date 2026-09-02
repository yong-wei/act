# Migration ledger — canonicalize Course Bundle runtime API (#1785)

Qualification tree: `2e6adc7a0cb2b17310e335516b63ce032ceffc7b`  
Public entry blob: `src/lib/course-bundle/index.ts` @ `8aaf0c7ca781ad0bd5a17647b3997a228caec198`  
Runtime-read owner blob: `src/lib/course-bundle/runtime-reads.ts` @ `52b26828f78b965b6c1fe910247cb659c9cb42c4`  
Superseded aggregator: `src/lib/course-runtime.ts` is absent from this tree.

`2e6adc7a0c` is the first revision that contains the public-entry migration,
the textbook production-caller move, the dangling
`@/lib/course-runtime` type-import repair in
`scripts/db/generate-resource-field-completion-audit.ts`, and this ledger.
`2933a288cad73d57ef99528cbd326405978f20b3` still imported the deleted
aggregator and is not the qualification revision.

This ledger binds caller closure, behavior comparison, deletion proof, rollback,
and known non-blocking gaps to `2e6adc7a0c`.  A later documentation commit may
only correct this binding text; it does not change that scanned caller set.

## Public surface

| Surface | Role | Status |
| --- | --- | --- |
| `src/lib/course-bundle/index.ts` | only consumer-facing runtime read entry | retained |
| `src/lib/course-bundle/runtime-reads.ts` | former `course-runtime.ts` implementation | retained internal owner |
| `src/lib/structured-textbook-runtime.ts` | textbook catalog/projection implementation | retained internal owner; re-exported by the public entry |
| `src/lib/course-runtime.ts` | superseded aggregator | deleted (`git mv` into `runtime-reads.ts`) |

Production lesson, manifest, handout, graph, media, textbook, and bound-resource
reads in `src/app/**` and `src/lib/**` enter through `@/lib/course-bundle`.
Asset URL shapes (`/course-runtime/lessons/...`, `/api/course-runtime/assets/...`)
are unchanged.

## Migrated production callers

| Family | Old module | Replacement | Behavior |
| --- | --- | --- | --- |
| Interactive entry/student/teacher pages and shared lesson shells | `@/lib/course-runtime` | `@/lib/course-bundle` | same lesson/manifest/media/handout reads; identity envelope preserved |
| Classroom/print/resource routes and layered-graph course context | `@/lib/course-runtime` | `@/lib/course-bundle` | same session-bound vs ordinary reads; access stays in Classroom contracts |
| Konling, graph-center, teacher resource nodes, SAR review | `@/lib/structured-textbook-runtime` | `@/lib/course-bundle` | same catalog/projection loaders |
| textbook-reader, resource-coach, source-pack corpus, canonical-rag, candidate-smoke, media-grounding, smart-lesson-plan pack | `@/lib/structured-textbook-runtime` | `@/lib/course-bundle` | same runtime textbook reads; no authoring fallback |

Representative identity/hash, missing-artifact, optional-resource, and media
projection behavior is covered by:

- `src/lib/__tests__/course-runtime-loader-errors.test.ts`
- `src/lib/__tests__/course-runtime-media-projection.test.ts`
- `src/lib/__tests__/structured-textbook-runtime.test.ts`
- `src/lib/__tests__/textbook-reader.test.ts`
- `src/lib/__tests__/runtime-release-textbook-candidate-smoke.test.ts`

## Remaining imports (named, not competing production authorities)

| Caller | Kind | Replacement | Removal condition |
| --- | --- | --- | --- |
| `src/lib/course-bundle/index.ts` re-export of `../structured-textbook-runtime` | public surface | keep | never; this is the canonical export |
| `scripts/db/generate-textbook-media-grounding.ts` | operator script | public entry is unsafe here because the barrel evaluates `runtime-reads` / `server-only` | keep owner import until a server-only-free public subpath exists |
| `scripts/db/generate-resource-field-completion-audit.ts` | operator script | same | keep owner import; `RuntimeLessonMediaKind` now comes from `runtime-lesson-media-document` after aggregator deletion |
| `scripts/db/report-data-completeness-audit.ts` | operator script | same | keep owner import |
| `src/lib/__tests__/source-pack-*.test.ts`, `textbook-media-grounding.test.ts`, `graph-center.test.ts`, `learning-evidence-rag-corpus.test.ts` | owner-module tests | `@/lib/course-bundle` optional | may keep relative owner imports for implementation fixtures |
| `scripts/acceptance/course-bundle-session-1577.ts` | CourseBundle internals | `capture` / `session-binding` owners | not the superseded aggregator |
| `scripts/db/report-course-bundle-revision-quality.ts` | CourseBundle internals | `contract` owner | not the superseded aggregator |

`src/lib/resource-governance-retirement/frozen-callers.ts` still names
`src/lib/structured-textbook-runtime.ts` as a frozen owner path.  That row is
inventory of the retained implementation file, not a live competing reader.

## Deletion proof

Static scan of `*.{ts,tsx,js,mjs}` on qualification tree `2e6adc7a0c`
(and unchanged on this documentation follow-up):

- Zero `from '@/lib/course-runtime'` module imports.
- Zero `src/lib/course-runtime.ts` path in HEAD.
- Zero production `src/app/**` / `src/lib/**` value imports of
  `@/lib/structured-textbook-runtime` except the public-entry re-export.

Required runtime callers of the old aggregator are therefore zero.  The old
module is retired, not transitional.

## Rollback boundary

Before any later deletion of the retained owners, restore imports to
`@/lib/course-bundle` / owner modules at this revision.  Do not rewrite
persisted session bundle identities, manifest hashes, runtime selectors, or
asset URLs.  Recreating `src/lib/course-runtime.ts` is not required unless a
hidden caller appears; if it does, qualification is blocked and the aggregator
must stay explicitly transitional.

## Known non-blocking gaps

- `src/lib/__tests__` still has 21 integration-suite baseline failures that
  also exist on `origin/integration`; this change added none.
- Operator scripts and a few owner-module tests still import the textbook
  implementation file because the public barrel pulls `server-only`.
- Interactive/Classroom Playwright coverage was not expanded beyond the
  existing focused unit/contract tests listed above.
