## 1. Shared graph presentation contract

- [x] 1.1 Extract or extend shared canvas viewport, node-label, relation-legend, focus, and stable-inspector presentation contracts without importing Legacy data DTOs into the active Authority state.
- [x] 1.2 Add structural tests proving the new graph uses the shared presentation contracts while active and old API responses, caches, selection, and view state remain independent.
- [x] 1.3 Rename ordinary graph-version controls and accessible names to `新版` and `旧版`, retaining internal Authority/Legacy names only in controlled diagnostics, logs, routes, and test hooks.

## 2. Root and domain canvas

- [x] 2.1 Replace fixed root-entry text placement with measured bounded multiline wrapping and content-aware collision radii for names and summaries.
- [x] 2.2 Repack root entries deterministically across desktop and mobile viewports and add regressions for complete labels, collision bounds, and zero root connector geometry.
- [x] 2.3 Render ordinary Authority objects as compact typed glyphs with wrapped semantic labels below the glyph and remove visible type captions from glyph interiors.
- [x] 2.4 Preserve full-workspace pan, zoom, node focus, established coordinates, and responsive controls when filters or selection state change.

## 3. Teaching and engineering relation presentation

- [x] 3.1 Make the domain-default path materialize both endpoints of every admitted teaching relation and render visible directed edge geometry whenever teaching coverage is non-empty.
- [x] 3.2 Keep truthful empty/partial teaching states without synthesizing edges, while preserving object selection and later engineering-family requests.
- [x] 3.3 Reuse the compact relation filter/legend interaction for structure, derivation-and-representation, application-and-analysis, and association shards without replacing the default teaching skeleton.
- [x] 3.4 Add relation tests for exact layer, predicate, direction, endpoint resolution, family loading, retained coordinates, and selected-node focus.

## 4. Governed detail and resource projection

- [x] 4.1 Extend the active node-detail contract and server projector with bounded one-hop neighbor actions, Knowledge Card/infograph state, and role-filtered typed resource bindings tied to the exact shard envelope.
- [x] 4.2 Project only existing route, registry, or feature-owned launch descriptors and reject hidden-role, unbound, drifted, path-bearing, or guessed targets.
- [x] 4.3 Add API and contract tests for identity match, optional-content drift, missing resources, role projection, safe launch descriptors, and unchanged base semantic detail.

## 5. Stable inspector and mathematical content

- [x] 5.1 Replace the active layout column detail with the established desktop overlay and mobile focus-contained drawer without changing graph layout width, pan, zoom, coordinates, filters, or cached shards.
- [x] 5.2 Present identity and explanation first, governed knowledge media and typed resources next, then clickable teaching/engineering neighbors and permitted source/status content.
- [x] 5.3 Route resource actions through the existing source-owned launchers and preserve return/focus behavior without embedding feature business runtimes in the inspector.
- [x] 5.4 Project trusted Formula expressions and declared Knowledge Card math nodes explicitly and render them with the existing LaTeX/KaTeX components; fail only the unsafe content block.
- [x] 5.5 Add stale-detail, cross-domain neighbor, inspector scroll/disclosure, close/focus return, resource-launch, and inline/block math regressions.

## 6. Product acceptance

- [x] 6.1 Capture authenticated desktop/mobile, light/dark, root/domain, default-teaching, engineering-filter, selected-node, resource, and formula states from one frozen revision.
- [ ] 6.2 Run focused knowledge API/client tests, accessibility checks, visual evidence gates, `npm run typecheck`, `npm run lint`, `npm run test`, and the production build on the final revision.
- [ ] 6.3 Run `openspec validate align-active-authority-with-legacy-graph-experience --type change --strict` and record any intentionally deferred upstream localization scope without claiming translation completion.

## Deferred upstream scope

- Localization completeness and 中英文切换 remain a later dependent change. This issue does not claim translation completion.
