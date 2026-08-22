## 1. Locale readiness contracts

- [ ] 1.1 Define a versioned locale-manifest schema bound to the admitted composite release, Authority snapshot/release, language component, schema, denominator digest, and content digest.
- [ ] 1.2 Define ACT locale qualification receipts that recompute category denominators, exact coverage, uniqueness, safety, and identity without mutating any selector or active release.
- [ ] 1.3 Add complete, missing, duplicate, unsafe, cross-release, changed-denominator, changed-content, and unknown-schema fixtures for `zh-CN` and `en`.

## 2. Chinese and bilingual qualification

- [ ] 2.1 Implement the mandatory Chinese completeness audit for domains, objects, types, relations, directions, explanations, approved aliases, and user-readable sources.
- [ ] 2.2 Exclude ACT overlays, record pins, generated translation, ambiguous `display_name`, other releases, and global registries from complete-locale coverage while preserving their bounded historical behavior.
- [ ] 2.3 Implement independent English qualification against the same envelope and denominator, producing bilingual-ready only when both locale qualifications pass.
- [ ] 2.4 Add qualification tests proving partial English does not invalidate complete Chinese and cannot enable or leak partial English product text.

## 3. Locale-bound Authority projections

- [ ] 3.1 Extend localized presentation resolution to require one explicit admitted locale and reject every cross-language fallback for qualified releases.
- [ ] 3.2 Bind root, domain, relation-family, neighborhood, search, detail, accessibility, and optional-media metadata responses and cache keys to one locale-profile identity.
- [ ] 3.3 Separate stable topology/object caches from locale display caches so a language change reuses identities without merging text from another locale.
- [ ] 3.4 Permit shared mathematical expressions only through trusted Formula or manifest language-neutral classification, while keeping names, explanations, and accessible prose locale-specific.
- [ ] 3.5 Add API and cache tests for stale locale responses, cross-locale merge rejection, identity preservation, language-neutral math, and unknown-locale failure.

## 4. New graph language switching

- [ ] 4.1 Build a versioned ACT graph-interface catalog with complete Chinese and English values for registered controls, filters, legends, loading, empty, error, focus, and accessibility messages, rejecting unknown keys and Authority semantic overrides.
- [ ] 4.2 Add a `中文 / English` control to the new graph, default to Chinese, and expose English only when the active release and ACT graph-interface catalog are both bilingual-ready.
- [ ] 4.3 Preserve active domain, node selection, relation filters, loaded logical shards, coordinates, pan, zoom, inspector section, scroll, and resource bindings across language changes.
- [ ] 4.4 Keep English unavailable with a bounded Chinese explanation when qualification is absent or failed, with no partial-field fallback or hidden locale mutation.
- [ ] 4.5 Project optional ACT content by its declared language availability, omitting or marking a whole unavailable block instead of mixing another-language body into the selected locale.
- [ ] 4.6 Add client, keyboard, accessibility, race, state-retention, optional-content, interface-catalog, and repeated-switch regressions without writing learner or server state.

## 5. Verification and future-release boundary

- [ ] 5.1 Add deterministic DOM, ARIA, tooltip, copy-payload, and API scans proving one selected locale per graph state and no raw enum, identifier, path, or other-language fallback.
- [ ] 5.2 Run focused qualifier/resolver/shard/client tests, `npm run typecheck`, `npm run lint`, `npm run test`, and the production build on the final revision.
- [ ] 5.3 Run `openspec validate admit-complete-authority-locales-and-add-language-switching --type change --strict` and verify current production selectors and locale evidence remain byte-identical.
- [ ] 5.4 Document that adopting and activating the future graph-project translation release requires a separate exact-version OpenSpec after its immutable manifest and coverage evidence exist.
