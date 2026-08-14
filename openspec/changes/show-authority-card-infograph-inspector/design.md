## Context

Authority knowledge cards and accepted infographs are tracked and exported, but active node detail does not yet expose them as the primary learning detail. The old graph's stable inspector behavior is already familiar and has responsive focus contracts that should be retained.

## Goals / Non-Goals

**Goals:** load human-readable node detail, eligible Knowledge Card content and accepted infographs on selection; preserve authorization, review and focus behavior.

**Non-Goals:** publish blocked drafts, preload media with graph shards, edit cards in the workspace, or expose internal paths and identities.

## Decisions

1. **Resolve content server-side by selected canonical object.** The detail service maps the object to exported card and infograph records, applies role and review gates, and returns a sanitized product DTO. The client never constructs filesystem paths.
2. **Load detail after selection.** Root and domain shards contain only a detail-availability summary. Card Markdown and infograph media metadata arrive in the node-detail request; image bytes use the existing authorized media route and cache policy.
3. **Use one stable inspector.** Desktop uses a side panel and mobile uses the existing focus-contained sheet. Selection updates content without remounting the graph; close or Escape returns focus to the originating node or canvas.
4. **Represent optional content by omission.** Only accepted content renders. Missing content, blocked card drafts and unavailable media leave no card or infograph panel; raw review enums, local paths, hashes and object IDs never enter DOM, accessibility, tooltip or copy surfaces.
5. **Keep graph topology primary.** The Knowledge Card and infograph are detail content, not replacement cards on the canvas.
6. **Bind exported learning content through the active Teaching Projection.** A node can use an exported card only when the active, passed Teaching Projection selects that canonical object and its Authority release-set/snapshot identity exactly matches the sealed node-detail shard. Runtime hashes verify the selected card and infograph bytes; the product never falls back to authoring files or constructs asset paths from client input.
7. **Optional media requires a valid composite envelope binding.** The selected object must be present in the current Authority UI model and in a Teaching Projection that the same Authority shard envelope binds as available and passed. A detail-only route response or a separately current card index is insufficient; when that binding is unavailable, the inspector and capture must not read or display independently current projection/card inputs.

## Risks / Trade-offs

- [Large images delay interaction] → Return responsive media metadata and load the selected image lazily with bounded dimensions.
- [Stale detail races after rapid selection] → Bind responses to the current selection token and discard stale responses.
- [Card availability differs by review state] → Test accepted content and omission for missing, blocked and media-error paths separately without leaking internal status.

## Migration Plan

Add sanitized detail projection and tests, integrate it into the layered workspace inspector, refresh browser evidence, and retain the previous semantic-only detail as rollback fallback.
