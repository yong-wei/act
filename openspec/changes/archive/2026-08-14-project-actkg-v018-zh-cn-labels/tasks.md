## 1. Localized resolver contract

- [x] 1.1 Add fixtures for `canonical_preferred`, `alternative`, Projection
  `display_name`, formula expression, missing, duplicate, unsafe, and profile-drift cases.
- [x] 1.2 Implement a pure resolver bound to snapshot, entity ID, `zh-CN`, and
  admitted runtime profile with primary-label, alias, and fallback separation.
- [x] 1.3 Add negative tests proving labels cannot change identity, relations,
  teaching mappings, card/media association, or hashes.
- [x] 1.4 Bind Formula display qualification to the trusted runtime profile and
  immutable `canonicalType`; preserve reviewed LF/CRLF bytes, reject forbidden
  controls and path structures, and never infer type from payload or text.

## 2. Progressive presentation integration

- [x] 2.1 Add resolved presentation records to root, domain, family,
  neighborhood, search, and node-detail shard materialization.
- [x] 2.2 Update graph nodes, accessibility text, search, inspector, knowledge
  card, and infograph surfaces to consume the shared record.
- [x] 2.3 Fail closed on unsafe fallback and prohibit IDs, hashes, release strings,
  machine slugs, paths, and assertion IDs in human-facing output.
- [x] 2.4 Preserve current v0.9 rendering and historical Legacy behavior when the
  selected snapshot has no v2 label artifact.

## 3. Verification

- [x] 3.1 Run resolver, shard, graph, inspector, search, accessibility, and
  no-system-string unit/integration tests.
- [x] 3.2 Capture authenticated role and responsive current-active v0.9
  compatibility QA, including role isolation, focus recovery, responsive
  geometry, and independent visual review. Candidate-specific v0.18 Chinese,
  fallback, formula, card, and infograph visual acceptance remains an explicit
  runtime-publication or activation gate before any selector change; this
  display-only change does not activate the candidate to obtain screenshots.
- [x] 3.3 Run typecheck, lint, commercial UI governance, strict OpenSpec
  validation, and stable-revision review.
- [x] 3.4 Scan the v0.18 Formula display set, including multiline and
  extension-like numeric tails, and verify focused safety regressions plus
  strict archived-change and spec validation.
- [x] 3.5 Reject the two-segment rooted filename and UNC server/share forms
  while retaining the documented Formula-only no-extension ambiguity.
- [x] 3.6 Restore the 320px current-active graph's title/control separation and
  initial SVG/node visibility; fail closed in product QA and refresh the
  authenticated visual-review evidence for the repaired revision.
- [x] 3.7 Re-qualify the controlled v0.18 Formula display set after allowing
  non-leading LaTeX separators; check complete-string embedded path rejection,
  trusted Formula scoping, and strict archived-change/spec validation.
- [x] 3.8 Repair the #1408 Formula path recurrence with maximal bounded
  candidate extraction and structural classification; cover ASCII and Unicode
  quote/book-title/em-dash/Chinese boundaries, maximal-candidate traps,
  single-atom positives, and reverse-context regressions without expanding
  scope.
