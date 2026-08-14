## Context

The v0.18 runtime projection already carries a `display_name` for every visible
node. Its multilingual index contains 1,909 unique `zh-CN` entity rows: 1,444
`canonical_preferred` and 465 `alternative`. The current ACT renderer falls
back to semantic names and therefore can expose machine-oriented slugs.

## Goals / Non-Goals

**Goals:**

- Render stable Chinese names where the admitted profile declares them.
- Preserve readable Projection v3 display names for the remaining nodes.
- Keep IDs available internally while eliminating them from human-facing text.
- Allow later terminology additions through candidate rebuilds without renderer changes.

**Non-Goals:**

- Translating or editing ActKG content in ACT.
- Using labels to match teaching references or create graph relations.
- Requiring a Chinese label for every Authority node.

## Decisions

### 1. Resolve labels from one admitted projection identity

The resolver accepts the validated snapshot, entity ID, exact `zh-CN` locale,
and admitted runtime profile. It never searches another release, profile, or
current global label registry.

### 2. Separate primary labels from aliases

A unique `canonical_preferred` row becomes the primary localized label.
`alternative` rows become aliases for search and detail display but do not
replace the primary name. When no primary row exists, the runtime Projection's
`display_name` is used. Formula expression presentation remains valid when it
is the profile's reviewed display name.

### 3. Keep presentation identity out of graph identity

DTOs carry an opaque internal node key and separate `displayLabel`, aliases,
type label, and explanation. Canonical IDs, terminology assertion IDs,
relation IDs, hashes, release strings, and source paths never become visible
text, accessible names, titles, URLs, analytics labels, or error messages.

### 4. Fail closed at the learner presentation boundary

If the selected label is empty, an unsafe identifier, or inconsistent with the
profile, the affected shard/detail response is unavailable with a bounded
human message. It must not fall back to raw IDs or machine slugs. Authority
admission remains separate; presentation qualification records the defect.

### 5. Reuse the resolver across progressive shards and details

Root, domain, family, neighborhood, search, node detail, knowledge-card, and
infograph views consume the same resolved presentation record. Card and media
association remains keyed by canonical identity, never localized text.

## Risks / Trade-offs

- Some v0.18 nodes will retain reviewed English or mathematical display names;
  complete Chinese coverage is not claimed.
- Suppressing unsafe fallback can make a defective node temporarily
  unavailable, which is preferable to exposing a system identifier.

## Migration Plan

1. Add label-index fixtures and resolver tests for preferred, alternative,
   fallback, missing, unsafe, and profile-drift cases.
2. Materialize resolved labels in v0.18 shards and detail records.
3. Move graph, search, accessibility, and inspector presentation to the resolver.
4. Refresh role, responsive, and no-system-string product QA evidence.

## Open Questions

- None. Additional reviewed label types require an explicit compatibility update.
