## Context

The reflection task contract rejects prompt-shaped control characters and keeps candidate writeback bounded, while draft persistence makes source, assignment, intent and title immutable after creation. Neither boundary proves that the initial values describe a real platform task or evidence source. Both Copilot and portfolio pages reconstruct the candidate from URL text, and the create API accepts those strings as provenance.

## Goals / Non-Goals

**Goals:**

- Distinguish server-verified platform provenance from student-authored labels.
- Re-resolve platform source identity and learner authorization when constructing and saving a candidate.
- Preserve immutable provenance only after its trust class is established.
- Keep free reflection possible without misrepresenting its source.

**Non-Goals:**

- Promoting drafts to formal portfolio artifacts or LearningFacts.
- Persisting complete Copilot conversations.
- Allowing URL text to grant access to another learner's evidence or task.
- Replacing the existing explicit-save and candidate-only lifecycle.

## Decisions

### 1. Use a bounded server-owned source identity for verified provenance

Platform entry points carry a stable source kind and identifier. The server resolves the canonical display fields and verifies the current learner may use that source before model execution and again before draft creation. Display strings sent by the client are not authoritative.

### 2. Model student-authored provenance explicitly

When no platform source exists, a free reflection may store bounded student labels, but the record and UI identify them as student-provided. These values cannot occupy fields or states that claim platform verification.

### 3. Preserve immutable provenance after classification

The existing content-only update rule remains. Source identity, provenance kind, canonical platform fields and student-label classification are fixed at creation and returned consistently after refresh.

## Risks / Trade-offs

- [Risk] Existing links contain only display text. -> Provide an explicit unverified/student-authored compatibility state rather than silently treating text as verified.
- [Risk] Source records are deleted or access changes. -> Preserve the saved identity and snapshot with a limitation state; do not reclassify it as student-authored.
- [Risk] Added identity fields expand the model. -> Keep the minimum source kind/id/classification needed for authorization and audit.

## Migration Plan

Add the source identity/classification contract, update platform entry links, enforce server resolution at candidate and save boundaries, and migrate existing drafts to an explicit legacy-unverified classification if required. Preserve current draft content and lifecycle.

## Open Questions

None. The implementation may choose the smallest compatible storage representation, but verified and student-provided provenance must remain distinguishable.

