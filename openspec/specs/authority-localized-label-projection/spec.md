# authority-localized-label-projection Specification

## Purpose
Resolve Authority presentation labels from an admitted snapshot and language. Historical `zh-CN` projection may use bounded overlay and display_name fallback. Complete-locale qualification uses only the release-declared language component and never falls back across languages.
## Requirements
### Requirement: Localized labels resolve from one admitted Authority profile

The label resolver MUST use the selected snapshot, stable entity ID, exact
`zh-CN` language, and admitted runtime Projection Profile. It MUST NOT search a
different release, profile, global registry, or localized string match.

#### Scenario: A canonical Chinese preferred row exists

- **WHEN** the selected entity has one validated `canonical_preferred` `zh-CN` row
- **THEN** its label SHALL be the primary learner-facing display label

#### Scenario: Only an alternative Chinese row exists

- **WHEN** the selected entity has a validated `alternative` row but no
  `canonical_preferred` row
- **THEN** the alternative SHALL be retained as an alias and the primary label
  SHALL fall back to the admitted Projection `display_name`

#### Scenario: No terminology row exists

- **WHEN** no admitted primary Chinese row exists for the entity
- **THEN** the resolver SHALL use the profile's reviewed `display_name` without
  changing entity identity

### Requirement: Localized presentation cannot change graph or teaching identity

Labels and aliases MUST NOT alter canonical IDs, node keys, relation endpoints,
Projection hashes, Teaching Projection predicates, prerequisites, card/media
association, or mapping decisions.

#### Scenario: Chinese and English names appear similar

- **WHEN** two objects have similar localized or fallback text
- **THEN** the system MUST continue to resolve graph and teaching records only by
  their declared identities

### Requirement: Unsafe system identity is never a display fallback

Canonical IDs, relation IDs, Bundle or Release strings, terminology assertion
IDs, hashes, source paths, and machine slugs MUST NOT appear in learner-visible
text, accessible names, titles, URLs, analytics labels, or errors.

#### Scenario: A projected display name is an unsafe identifier

- **WHEN** the primary and fallback candidates fail the human-readable label policy
- **THEN** the affected presentation response SHALL fail closed with a bounded
  human message and SHALL NOT reveal the rejected value

### Requirement: Formula display labels preserve only trusted reviewed structure

The resolver MUST use the immutable Authority object's trusted `canonicalType`
and the validated runtime profile when qualifying a Formula display label. It
MUST NOT infer Formula status from payload fields or label text. Raw LF and CRLF
MUST be preserved only for a Formula under a trusted runtime profile. TAB, NUL,
isolated CR, all other C0 controls, and DEL MUST be rejected without rewriting
the remaining text. The complete original label MUST be checked for unsafe IDs,
URI and drive/POSIX/relative path forms, known system directories, hashes,
release tokens, and slugs before a trusted Formula receives its narrow `/` and
`\\` notation exception. Path recognition MUST apply at any position in the
label and MUST NOT depend on a general command whitelist or a TeX parser. A bounded
ordinary relative candidate consists of segments matching
`[A-Za-z0-9._-]+` joined by `/` or `\\`. The candidate MUST cover the maximal
continuous ASCII path-shaped span, and each side MUST be a string boundary or
any character outside `[A-Za-z0-9._-]`; it MUST NOT be reduced to a merely
safe-looking subspan. Three or more such segments MUST be rejected unless all
segments are single-character mathematical atoms; a two-segment candidate MUST
be rejected when its final segment has an alphabetic extension. Non-Formula
objects and untrusted runtime profiles MUST continue to reject all slash and
backslash labels. The generic safety API MUST reject every `./` and `.\\` token
without a dotted-token exception, and MUST scan each token from its own dot
regardless of the preceding character. The resolver MAY retain an original
display name only through an explicit versioned, record-bound Formula fallback
pin after classification as the sole ambiguous `.` + `\\` token failure. Such
a pin MUST bind the admitted runtime profile ID and SHA-256, snapshot ID/hash,
release ID, canonical Formula ID, and original displayName UTF-8 SHA-256. It
MUST be considered only in the immutable object's display-name fallback branch;
preferred or alternative rows, ordinary types, non-admitted evidence, and any
binding or failure-class drift MUST fail closed. Unknown/case/spacing variants,
missing delimiters, concatenated characters, additional commands or slashes,
path/UNC tails, and hard URI, absolute, relative, identity, or control failures
MUST remain unavailable. The resolver MUST continue scanning all other embedded
path candidates.

#### Scenario: A trusted Formula contains reviewed line breaks

- **WHEN** an admitted runtime profile resolves an object whose `canonicalType`
  is exactly `Formula` and whose display name contains LF or CRLF
- **THEN** the resolver SHALL return the original label bytes unchanged

#### Scenario: A trusted Formula uses non-leading LaTeX notation

- **WHEN** an admitted runtime profile resolves a `Formula` whose reviewed
  display name begins with ordinary mathematical text and contains LaTeX
  commands such as `y(t)=\\frac{A}{2}` or `G(s)=\\frac{U(s)}{\\Omega(s)}`
- **THEN** the resolver SHALL retain the original display name
- **AND WHEN** the same value is resolved without the trusted Formula context
- **THEN** the resolver SHALL fail closed

#### Scenario: A path-shaped or untrusted formula candidate is supplied

- **WHEN** a label is POSIX, drive-qualified, URL/file-URI, dot-segment,
  home-relative, or an ordinary relative multi-segment path; when any of those
  path forms is embedded in a Formula value; when a rooted or UNC value lacks
  the trusted Formula context; or when that Formula value has explicit
  directory structure and an ordinary filename
- **THEN** the resolver SHALL fail closed without exposing the rejected value

#### Scenario: A reviewed Formula has an extension-like mathematical tail

- **WHEN** a trusted Formula value has no explicit path structure but one
  mathematical token resembles a filename extension
- **THEN** the resolver SHALL retain the original reviewed value; a suffix
  alone MUST NOT classify the Formula as a path

#### Scenario: A v0.18 Formula fallback pin matches one admitted record

- **WHEN** the immutable Formula fallback is one of the ten scanned v0.18
  ambiguity records and its profile ID/SHA-256, snapshot ID/hash, release ID,
  canonical ID, and original displayName UTF-8 SHA-256 match a versioned pin
- **THEN** the resolver SHALL retain the original display name only in the
  fallback branch
- **AND WHEN** the generic API is called, or any binding, type/ID, displayName,
  preferred/alternative row, admission state, or failure class differs
- **THEN** the resolver SHALL fail closed without exposing the rejected value

#### Scenario: Bounded relative candidates are structurally classified

- **WHEN** a trusted Formula contains a bounded candidate such as
  `x=folder/subdir/file`, `x=foo\\bar\\baz`, or a parenthesized, quoted,
  whitespace-delimited, comma-delimited, or semicolon-delimited equivalent
- **THEN** the resolver SHALL fail closed
- **AND WHEN** the candidate is `A/B/C`, `a/b/c`, or another sequence whose
  segments are all single-character mathematical atoms
- **THEN** the resolver SHALL retain the original reviewed value
- **AND WHEN** a two-segment candidate ends in an alphabetic extension
- **THEN** the resolver SHALL fail closed
- **AND WHEN** the same candidate is evaluated without the trusted Formula
  context
- **THEN** the resolver SHALL fail closed regardless of its structure

#### Scenario: Unicode context forms a candidate boundary

- **WHEN** a trusted Formula contains `“folder/subdir/file”`,
  `‘foo\\bar\\baz’`, `《folder/subdir/file》`, `—folder/subdir/file—`, or
  `前folder/subdir/file后`
- **THEN** the resolver SHALL fail closed
- **AND WHEN** a trusted Formula contains `中文A/B/C中文`
- **THEN** the resolver SHALL retain the reviewed value because all extracted
  segments are single-character mathematical atoms
- **AND WHEN** a path-shaped value uses Unicode filename segments rather than
  the ASCII candidate grammar
- **THEN** this candidate-boundary rule SHALL NOT be interpreted as a Unicode
  filename parser or a new Unicode path acceptance feature

#### Scenario: Two-segment rooted and UNC forms are distinguished

- **WHEN** a trusted Formula value has a rooted ordinary filename with an
  alphabetic extension, or a double-rooted ordinary UNC server/share pair
- **THEN** the resolver SHALL fail closed
- **AND WHEN** a trusted Formula has a single command segment with an
  extension-like tail, or a single-root two-segment expression without a
  filename structure
- **THEN** the resolver SHALL retain the reviewed value

#### Scenario: Formula-looking payload text cannot grant an exception

- **WHEN** payload fields claim `Formula` while the trusted object
  `canonicalType` is missing, unknown, or non-Formula
- **THEN** the resolver SHALL apply the non-Formula safety policy

### Requirement: Terminology coverage remains additive

The renderer MUST consume the versioned label projection generically so a later
admitted snapshot can add reviewed terminology rows without a renderer code
change. Missing Chinese coverage alone MUST NOT invalidate Authority identity.

#### Scenario: A later snapshot adds a reviewed label

- **WHEN** the newly selected snapshot passes admission and contains a new valid row
- **THEN** the next materialized presentation SHALL expose it without modifying
  node or relation identity

### Requirement: Snapshot-bound reviewed overlay may follow the admitted index

After loading admitted runtime-profile `canonical_preferred` rows, the resolver
MAY merge a reviewed overlay that is bound to the same release and snapshot.
It MUST NOT search another release, profile, or unbound registry. The sealed
terminology index count recorded in the bound release's admission evidence MUST
remain the admission invariant for that release: the sealed v0.18 index keeps
its recorded count of 1909, and the v0.22 candidate uses the count recorded
when its Chinese terminology component v0.5 is admitted. An index count MUST
NOT be copied from a different release. After merge, one entity ID MUST have at
most one zh-CN `canonical_preferred` row.

#### Scenario: Overlay supplies a missing preferred row

- **WHEN** the admitted index has no `canonical_preferred` row for an entity
  and the snapshot-bound overlay has one safe zh-CN preferred row
- **THEN** the resolver SHALL use the overlay label as the primary display label

#### Scenario: Overlay replaces an unsafe admitted preferred row

- **WHEN** the admitted index has a classifier-unsafe zh-CN `canonical_preferred`
  row and the snapshot-bound overlay has a classifier-safe preferred row for
  the same entity
- **THEN** the resolver SHALL use the overlay label and MUST NOT keep both rows

#### Scenario: Overlay omits unsafe alternatives on overlay entities

- **WHEN** an overlay entity also has a classifier-unsafe admitted alternative
- **THEN** context construction SHALL omit that alternative so the reviewed
  preferred label can resolve

#### Scenario: Two preferred rows remain after merge

- **WHEN** merge would leave two zh-CN `canonical_preferred` rows for one entity
- **THEN** context construction MUST fail closed

#### Scenario: An index count from another release is supplied

- **WHEN** a resolver context for one release is constructed with an index
  whose sealed count matches a different release's admission evidence instead
  of its own
- **THEN** context construction MUST fail closed

### Requirement: Complete-locale qualification uses only release-declared language content
For a release evaluated under the complete-locale contract, the localized resolver SHALL accept primary labels, aliases, descriptions, type terms, relation terms, direction explanations, and readable source text only from the language component declared by that exact admitted release envelope. ACT snapshot overlays, record pins, another release, a global registry, or generated translation MUST NOT contribute to the complete-locale coverage numerator.

#### Scenario: Historical overlay supplies a missing Chinese label
- **WHEN** an already admitted historical release can resolve a label through its existing snapshot-bound overlay but the release-declared language component lacks that mandatory record
- **THEN** the historical presentation SHALL retain only its existing bounded behavior while that release remains admitted
- **AND** that record SHALL count as missing for complete Chinese qualification of a future new-graph release

#### Scenario: Release language component supplies every record
- **WHEN** all mandatory records resolve safely from the exact release-declared `zh-CN` component
- **THEN** those records SHALL contribute to the Chinese completeness result
- **AND** no local overlay or generated value SHALL be consulted

### Requirement: Locale resolution never falls back across languages
Every localized presentation request SHALL resolve against one explicitly admitted locale. A missing value in that locale MUST produce a bounded unavailable result for its required surface or fail locale qualification; it MUST NOT fall back to another locale, a language-ambiguous `display_name`, a raw enum, or an internal identity.

#### Scenario: Chinese value is missing and English display name exists
- **WHEN** a Chinese presentation request lacks an admitted Chinese record but the underlying Authority object has an English or language-ambiguous `display_name`
- **THEN** the resolver SHALL treat the Chinese value as unavailable
- **AND** it SHALL not expose the other-language value in the Chinese surface

#### Scenario: Same object is requested in two ready locales
- **WHEN** a bilingual-ready object is resolved once for `zh-CN` and once for `en`
- **THEN** each response SHALL use only its requested locale's admitted presentation record
- **AND** both responses SHALL retain the same canonical object identity and relation endpoints

### Requirement: Every active graph surface resolves one locale consistently
Root, domain, relation-family, neighborhood, search, detail, accessibility, card-metadata, infograph-metadata, and source surfaces SHALL use the same selected locale and locale-profile identity for one active graph state. A response or cache entry from another locale MUST NOT be merged into the selected-locale presentation.

#### Scenario: User changes language with cached shards
- **WHEN** logical graph shards are already loaded and the user changes to another ready locale
- **THEN** the client SHALL reuse stable graph identities and topology while refreshing or selecting display records bound to the new locale profile
- **AND** stale visible or accessible text from the previous locale SHALL not remain attached to the active graph state

### Requirement: Language-neutral mathematical content requires trusted classification
A mathematical expression SHALL be shared across qualified locales only when the immutable Authority type or release locale manifest explicitly classifies it as language-neutral governed math. The resolver MUST NOT infer language neutrality from punctuation, TeX commands, ASCII-only content, or visual similarity.

#### Scenario: Trusted Formula is language-neutral
- **WHEN** a Formula expression is explicitly covered by the trusted Formula and locale-manifest contract
- **THEN** the same expression SHALL be projected for Chinese and English LaTeX rendering
- **AND** its localized name, explanation, accessibility text, and surrounding prose SHALL still resolve independently per locale

#### Scenario: Ordinary text resembles a formula
- **WHEN** an unclassified object label or description contains symbols or TeX-like text
- **THEN** it SHALL remain an ordinary locale-specific record
- **AND** it SHALL not bypass the selected locale's completeness requirement

### Requirement: Governed rich titles take precedence over plain Formula labels
When the selected Authority release provides a qualified localized rich-text title, the label projection SHALL preserve that title's explicit text and math spans for user-facing presentation. The existing plain display label SHALL remain a non-mathematical compatibility, search, and unavailable-state input and MUST NOT be parsed as TeX. Identity and association SHALL continue to use stable internal keys.

#### Scenario: Formula title has qualified inline spans
- **WHEN** a presentable Formula object has a same-release localized rich-text title with qualified math spans
- **THEN** canvas, search, preview, accessibility, and inspector projections SHALL use that rich title
- **AND** the plain display label SHALL NOT be independently parsed or displayed as a competing formula

#### Scenario: Rich title is unavailable
- **WHEN** a formulaized title cannot produce a meaningful reviewed presentation after its math failures are applied
- **THEN** the ordinary product graph SHALL treat the object as having an unavailable governed name
- **AND** only the development-only unavailable-name artifact MAY expose its bounded unavailable state

