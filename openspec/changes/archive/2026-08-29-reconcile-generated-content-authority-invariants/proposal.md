# Proposal: Reconcile generated-content authority invariants

## Why

Assessment, Assignment rubric generation, Smart Lesson, and Smart Courseware
already have domain-specific draft, review, revision, and publication pieces,
but their authority boundaries are not recorded in one cross-domain matrix.
Without a shared invariant check, an AI output can be mistaken for catalog
content, a score, feedback, LearningFact, or a publication even when the
owning domain has not completed its human and immutable-revision gates.

## What Changes

- Define one cross-domain vocabulary for editable AI drafts/candidates,
  deterministic/schema/source validation, human accept/approve, immutable
  revision/snapshot, and publication receipt or equivalent authority.
- Publish a domain-to-invariant reconciliation matrix for Assessment,
  Assignment rubric, Smart Lesson, and Smart Courseware, including each
  owner, route/API/model/worker/script/test/caller denominator and evidence
  identity.
- Add architecture fitness checks for prohibited direct AI writes to catalogs,
  scores, student feedback, LearningFact, and publication selectors, and for
  missing human/immutable/publication evidence.
- Keep each domain's existing state machine, persistence, worker, and
  publication contract; do not create an AI superdomain, shared candidate
  table, shared state machine, or cross-domain persistence.
- Mark the Assessment row blocked until
  reconcile-reviewed-assessment-generation-governance (#1564) qualifies its
  concrete draft-to-precheck-to-human-review-to-catalog-publication path. This
  change does not implement that Assessment work.
- Keep Assignment, Smart Lesson, and Smart Courseware mappings as references
  to their existing owners and contracts; this change does not create an
  artificial dependency on the Assignment migration chain.
- Leave any future global closure or release audit to verification of this
  rule; this change does not define a first global closure state machine.
- Externalize run-specific QA artifacts and retain only revision/hash and
  conclusion receipts; those receipts are never score, approval, or
  LearningFact authority.

## Capabilities

### New Capabilities

- `generated-content-authority-invariants`: Defines the shared invariant
  vocabulary, domain matrix, and architecture fitness checks without adding a
  cross-domain runtime model.

### Modified Capabilities

None. Assessment, Assignment rubric, Smart Lesson, and Smart Courseware
contracts remain domain-owned; the matrix records and verifies their existing
boundaries rather than redefining them.

## Impact

- **Owners:** Assessment/adaptive-assessment, Assignment/src/lib/assignments,
  Smart Lesson Plan, and Smart Courseware each retain one owner. The matrix
  owns only cross-domain invariant evidence and does not own runtime data.
- **Routes/API:** assessment generation/submit/catalog routes, teacher
  assignment rubric routes, smart-lesson task/draft/generation routes, and
  smart-courseware draft/generation/publication routes are inventoried for
  sink and boundary checks.
- **Models:** existing domain models (Assignment*, adaptive catalog/item
  records, SmartLesson*, SmartCourseware*, revisions/snapshots/receipts)
  remain unchanged; no shared candidate table or persistence is added.
- **Workers/scripts:** existing domain generation/publication workers and
  validators remain in their domains. New checks consume their manifests,
  receipts, and source inventories but do not enqueue product work.
- **Tests/callers:** matrix coverage includes route/API, service, model,
  worker, script, test, UI, and cross-domain caller inventories, plus direct
  sink/import checks.
- **Dependencies:** can proceed in parallel with Assignment lifecycle/review
  changes. The Assessment mapping is blocked by and references #1564; no
  Assignment-chain lock is introduced.
