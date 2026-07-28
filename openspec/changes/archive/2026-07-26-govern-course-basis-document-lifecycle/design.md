## Context

The current course-basis contract requires manual confirmation after extraction. The interview replaces that early freeze with editable submitted content and an atomic freeze when a preparation resource pack first uses content. Referenced versions remain immutable and auditable.

## Goals / Non-Goals

**Goals:**

- Make source documents readable and manageable throughout their lifecycle.
- Freeze exactly the version whose content is first adopted.
- Give deletion failures a truthful reason and resolution path.

**Non-Goals:**

- Add OCR or new import formats.
- Rebuild retrieval or the editor.
- Permit deletion of referenced historical evidence.

## Decisions

### 1. Distinguish editable readiness from frozen eligibility

A successful extraction becomes `可编辑`. Selection records intent only. The first operation that adopts content into knowledge points, goals, retrieval evidence, or generation performs a transaction that confirms the current content hash, freezes the version, and binds the adopting record.

### 2. Create a new version after freeze

Edits before first use update the mutable submitted version with a new content hash and anchors. Editing a frozen version creates the next positive version; the frozen version and citations never change.

### 3. Centralize reference checks

Course-basis and document deletion services query task sources, plan revisions, resource packs, and courseware/publication references. Unreferenced records may be physically deleted; referenced records may only be disabled and remain readable to authorized historical views.

### 4. Present one document, retain structural anchors

The UI renders the normalized document continuously while stable internal anchors remain available for navigation, citations, and retrieval. Extraction segments are not exposed as the primary reading UI.

## Risks / Trade-offs

- [Two adopters race to freeze different content] → Lock the mutable version and bind one content hash transactionally.
- [Reference inventory misses a consumer] → Cover every persisted foreign reference and enforce database constraints where possible.
- [Status labels diverge] → Map internal states through one Chinese presentation contract.

## Migration Plan

Map confirmed versions to `已冻结`, successful unconfirmed versions to `可编辑`, retired versions to `已停用`, and preserve failures. Existing citations remain unchanged. Enable first-use freeze only after all adoption paths use the shared transaction.

## Open Questions

None.
