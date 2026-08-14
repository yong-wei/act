## 1. Localized resolver contract

- [ ] 1.1 Add fixtures for `canonical_preferred`, `alternative`, Projection
  `display_name`, formula expression, missing, duplicate, unsafe, and profile-drift cases.
- [ ] 1.2 Implement a pure resolver bound to snapshot, entity ID, `zh-CN`, and
  admitted runtime profile with primary-label, alias, and fallback separation.
- [ ] 1.3 Add negative tests proving labels cannot change identity, relations,
  teaching mappings, card/media association, or hashes.

## 2. Progressive presentation integration

- [ ] 2.1 Add resolved presentation records to root, domain, family,
  neighborhood, search, and node-detail shard materialization.
- [ ] 2.2 Update graph nodes, accessibility text, search, inspector, knowledge
  card, and infograph surfaces to consume the shared record.
- [ ] 2.3 Fail closed on unsafe fallback and prohibit IDs, hashes, release strings,
  machine slugs, paths, and assertion IDs in human-facing output.
- [ ] 2.4 Preserve current v0.9 rendering and historical Legacy behavior when the
  selected snapshot has no v2 label artifact.

## 3. Verification

- [ ] 3.1 Run resolver, shard, graph, inspector, search, accessibility, and
  no-system-string unit/integration tests.
- [ ] 3.2 Capture authenticated role and responsive product QA for Chinese,
  fallback, formula, card, and infograph cases and complete independent visual review.
- [ ] 3.3 Run typecheck, lint, commercial UI governance, strict OpenSpec
  validation, and stable-revision review.
