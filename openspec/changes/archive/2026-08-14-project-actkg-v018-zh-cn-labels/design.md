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

### 6. Sol DECIDE=A (2026-08-14)

The accepted direction is a pure, immutable resolver context bound to the
captured snapshot and one admitted runtime profile. Shards carry the resolved
primary label and aliases as presentation-only fields; the store rejects any
same-envelope canonical-id label drift before merge. v0.9 snapshots without
v2 evidence retain their existing `preferred_labels` projection and expose no
aliases.

### 7. QA timing boundary (2026-08-15)

Current authenticated product QA verifies the active v0.9 compatibility
surface, role isolation, responsive geometry, focus recovery, and no-system-
string boundary. It does not claim visual acceptance of the non-activated
v0.18 candidate. Candidate-specific Chinese labels, fallback formulae, cards,
and infographs remain an explicit runtime-publication or activation gate before
any Authority selector changes; this display-only change must not switch an
Active pointer merely to obtain screenshots.

### 8. Formula display and path boundary (2026-08-15)

Sol DECIDE=A: a raw LF or CRLF is preserved only when the resolver is bound to
the validated runtime profile and the immutable Authority object's trusted
`canonicalType` is exactly `Formula`. TAB, NUL, an isolated CR, every other C0
control, and DEL remain unsafe; no newline normalization is performed. Formula
display qualification is a narrow structure check, not a command whitelist or
TeX parser. The complete original string is checked first for IDs, URI and
drive/POSIX/relative path forms, known system directories, hashes, release
tokens, and slugs. Only after those checks may a trusted Formula retain `/` or
`\\` used by reviewed notation. Path evidence is checked at any position in the
value, including an assignment such as `x=folder/file.txt`, an embedded drive
path such as `f=C:\\Users\\a.txt`, or an embedded URI/UNC value. POSIX,
drive-qualified, URL/file-URI, dot-segment, home-relative, UNC, and ordinary
relative multi-segment paths remain unavailable. A path is identified from its
directory structure and ordinary filename, so a mathematical formula whose
final numeric token resembles an extension is not rejected by an independent
suffix rule. Canonical type is never inferred from payload or text, and
rejected labels remain bounded and cannot expose IDs or payloads.

### 9. Two-segment Formula ambiguity (2026-08-15)

Sol DECIDE=A: `\\Users\\file.txt` is rejected because the rooted second
segment has an ordinary alphabetic filename extension, and
`\\\\server\\share` is rejected as an explicit UNC server/share structure.
Neither rule applies to a single Formula command segment such as
`\\alpha.ext`. A single-root two-segment value without an ordinary filename,
such as `\\sin\\omega`, remains an explicitly accepted string-level ambiguity:
rejecting it would require a command whitelist or TeX parser and would break
reviewed Formula presentation. That residual case remains bounded by the
immutable Authority `canonicalType` and admitted runtime profile; it is not a
fallback for payload text.

### 10. Current-active mobile QA repair (2026-08-15)

Sol DECIDE=B: authenticated QA found that the pre-existing 320px active
Authority surface allowed the workspace mode controls to overlap the graph
title and placed no semantic node geometry in the initial viewport. The
affected screenshot bytes matched the parent revision, so this is not a
Formula-label regression; it is nevertheless a real current-active QA failure
and must be corrected before this delivery can honestly pass the visual gate.

The repair remains limited to the active graph presentation at widths below
640px: reserve header space for the workspace controls, keep the graph toolbar
and supporting rows horizontally reachable, and require a visible SVG plus at
least one semantic node in the initial viewport. The product-QA capture fails
closed on title/control overlap or absent first-viewport graph geometry. It
does not alter Authority identity, Legacy/candidate routing, activation,
release selection, or the governance gate's acceptance policy. The repaired
revision requires a new authenticated capture and independent visual review
bound to that exact source and screenshot set.

The same root cause was confirmed in the administrator
`role-admin-active-mobile` capture: its three-button mode switch wrapped to a
second line and reached the title, while the student and teacher two-button
captures remained clear. The responsive contract therefore belongs to the
shared workspace switch, not to a role-specific padding value. At widths below
640px it remains one horizontal, scrollable row with every mode button
non-shrinking and reachable; the role capture records and fails closed on the
same title overlap, visible SVG, and visible semantic-node checks for all three
authenticated roles.

### 11. Formula path recurrence repair (2026-08-15)

The accepted P1 recurrence was caused by classifying only the complete value
after splitting on separators. A prefix such as `x=` became part of the first
segment, so `x=folder/subdir/file` and `x=foo\bar\baz` were no longer
recognized as paths; the same bypass applied when parentheses or quotes
surrounded the candidate. The prior extension-oriented embedded check also
missed ordinary three-segment candidates without a filename suffix.

Sol DECIDE=A keeps the existing complete-string fail-closed checks for URI,
drive/POSIX, dot/home, UNC, known directories, IDs, release/hash tokens, and
slugs. It adds one bounded candidate extraction for ordinary relative segments
`[A-Za-z0-9._-]+` joined by `/` or `\\`. A candidate is considered only when
both sides are a string boundary or an obvious separator (whitespace, =,
brackets, quotes, comma, semicolon, or colon). Three or more ordinary
segments are rejected unless every segment is a single-character mathematical
atom; two
segments are rejected when the last segment has an alphabetic extension. Thus
A/B/C and a/b/c remain reviewed Formula values, while
`folder/subdir/file` and `foo\bar\baz` fail closed. The trusted Formula
canonical type and admitted runtime profile remain the only exception gate;
non-Formula and untrusted contexts continue to reject every slash or
backslash. No command whitelist,
TeX parser, or positive formula-feature allowlist is introduced.

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
