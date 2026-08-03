## Why

Knowledge cards are currently addressed through legacy graph IDs and are treated as if they were graph entities. The Teaching Projection needs cards to be ordinary ACT teaching resources keyed by Canonical ID so steps can resolve an optional card without making card presence equivalent to node existence.

## Series Dependencies

- Depends on: `introduce-versioned-act-teaching-projection`, `project-active-course-resources-to-canonical`, `publish-core-teaching-prerequisites`.

## What Changes

- Migrate cards through an old-ID-to-Canonical crosswalk and define `canonicalId → at most one ACTIVE card`.
- Change step references to `step → canonicalId → optional card`; only core nodes with `cardPolicy: REQUIRED` gate on a card.
- Auto-migrate one-to-one records, classify duplicate/split/unmapped/course-specific cases, and retain legacy fallback until hit count is zero.
- Reject new authoring that writes legacy graph IDs while preserving legacy audit/crosswalk files.
- Keep non-core nodes cardless and usable through Authority, handouts,教材 resources, or other projected resources.

## Capabilities

### New Capabilities

None. Cards are integrated as Teaching Projection resources and existing ResourceNode/RAG governance is modified.

### Modified Capabilities

- `resource-node-registry`: Canonical-keyed cards are governed teaching resources with one active card per Canonical ID.
- `learning-evidence-rag-corpus`: card retrieval and citation retain Canonical/resource/projection provenance and optional absence semantics.

## Impact

- Card authoring frontmatter, card index/runtime lookup, interactive step references, crosswalk and fallback telemetry.
- No ActKG entity mutation, new Prisma table, or global Authority gate.
