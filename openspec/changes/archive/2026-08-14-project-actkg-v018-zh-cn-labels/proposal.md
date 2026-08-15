## Why

The active v0.9 presentation often falls back to machine-oriented semantic
names. v0.18 supplies a reviewed `zh-CN` terminology index and human-oriented
Projection v3 display fields, but those fields must remain a presentation layer:
changing canonical IDs or matching teaching references by translated text would
corrupt identity and authority boundaries.

## What Changes

- Add a localized Authority-label resolver keyed only by stable v0.18 entity ID,
  the exact `zh-CN` language, and the admitted runtime Projection Profile.
- Use `canonical_preferred` terminology rows as primary Chinese labels, retain
  `alternative` rows as aliases, and fall back to the Projection v3
  `display_name` when no primary Chinese label exists.
- Keep labels out of node identity, relation endpoints, Teaching Projection
  predicates, hashes, and mapping decisions.
- Prevent raw canonical IDs, relation IDs, Bundle or Release strings, hashes,
  and machine slugs from becoming learner-visible labels or inspector text.
- Make label-index coverage additive: later admitted terminology rows can appear
  after candidate rebuild without a renderer change or a cutover blocker.

## Capabilities

### New Capabilities

- `authority-localized-label-projection`: derive deterministic human-facing
  labels and aliases from an admitted Authority projection without changing graph identity.

### Modified Capabilities

- `active-authority-semantic-graph-presentation`: render the v0.18 localized
  display projection in graph nodes, search, accessibility text, and inspector content.

## Impact

- Affects Authority projection DTOs, label resolution, shard materialization,
  graph presentation, inspector/search behavior, and product QA evidence.
- Depends on `import-actkg-v018-authority-candidate`.
- Does not translate missing terms heuristically or make terminology coverage a
  prerequisite for Authority admission.
