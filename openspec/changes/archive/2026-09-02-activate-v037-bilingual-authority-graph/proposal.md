## Why

The active graph is v0.37, but ACT's composite registry and published locale qualification remain pinned to v0.22 and contain no v0.37 manifest. Runtime qualification therefore returns `historical`, disables English, and existing tests explicitly expect that failure even though the admitted v0.37 bundle declares complete Chinese and English evidence.

## What Changes

- Admit the exact active v0.37 release/snapshot/catalog/language-component identity into the composite and locale qualification boundary without following `latest` or changing production selectors.
- Convert and independently verify the upstream v0.37 locale manifest and localized content against ACT's complete active presentation denominator, including all fifteen domains, all discoverable nodes, relations, directions, aliases, readable sources, rich text, formulas, and accessibility labels.
- Generate immutable offline qualification receipts and make runtime requests read only the verified receipt and bounded locale projection; ordinary requests must not traverse every shard/detail or rebuild the denominator.
- Make `中文 / English` perform an atomic presentation replacement across root, overview, search, filter panel, relation labels, formula labels, hover, inspector, card/resource availability and accessibility while preserving topology, force coordinates, camera, filters, selection and drawer position.
- Add fail-closed tests for absent registry entries, missing seven-domain coverage, cross-release manifests, partial refresh, mixed-language frames, stale request races, raw fallback, and tests that merely assert English remains disabled.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `authority-locale-readiness-and-switching`: Qualify and activate the exact v0.37 bilingual presentation with offline receipts and a complete live-switch contract.
- `authority-domain-shard-delivery`: Bind locale projections and receipts to every bounded root/domain/family/neighborhood/detail response.
- `active-authority-semantic-graph-presentation`: Require every visible and accessible active surface to switch together without changing graph state.

## Impact

- Affects the composite envelope registry, locale manifest adapter, offline qualification tooling, runtime receipt loader, shard projection, active locale refresh coordinator, interface catalog and bilingual browser tests.
- Depends on `establish-three-level-authority-graph-navigation` so the denominator covers every visible root and bounded follow-on path.
- Does not author translations, use ACT overlays, follow a mutable latest pointer, or mutate Authority/Teaching/resource selectors or learner state.
