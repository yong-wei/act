## Why

All 1,242 Formula objects in the active v0.37 domain shards have governed formula-render records, but none receives an available canvas `richTitle` or a `mathematics` projection. The canvas therefore renders a prose label while the actual formula remains detail-only, despite the existing specification requiring governed mathematics on 2D and 3D labels.

## What Changes

- Add an exact-release, bounded formula presentation projection to domain overview, search result, neighborhood, hover, accessibility, and canvas view models without copying the complete formula corpus into responses.
- Render the governed formula expression through the shared strict KaTeX configuration in both 2D and 3D while retaining an optional human title as secondary accessible context.
- Keep formula identity, locale, macro profile, render hash, display mode, and unavailable disposition bound to the same Authority and locale qualification as the containing shard.
- Prohibit raw TeX, prose-to-TeX guessing, delimiter scanning, plain-text mathematical approximations, per-frame KaTeX execution, and detail-request fan-out for visible labels.
- Add complete Formula-node denominator tests and real bilingual formula fixtures across overview disclosure, one-hop expansion, search, zoom LOD, mode switching, hover, keyboard focus, and detail.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `governed-rich-text-math-presentation`: Extend the bounded governed formula projection to graph-label surfaces without weakening safety or identity checks.
- `active-authority-legacy-force-runtime`: Require formula labels to use the shared semantic DOM layer anchored to live force coordinates.
- `active-authority-semantic-graph-presentation`: Define Formula canvas identity as rendered mathematics plus bounded human context, not prose-only substitution.
- `authority-domain-shard-delivery`: Carry only the formula projection needed by materialized nodes and prove exact-release closure.

## Impact

- Affects governed-math attachment/projection, shard public contracts, active graph adapters, semantic label layers, search/preview/detail models, and KaTeX regression tests.
- Depends on `establish-three-level-authority-graph-navigation`; formulas enter the canvas only through bounded search or one-hop disclosure.
- Does not edit upstream formula content, ActKG Schema, Authority topology, or locale values.
