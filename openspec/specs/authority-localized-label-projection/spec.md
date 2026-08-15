# authority-localized-label-projection Specification

## Purpose
TBD - created by archiving change project-actkg-v018-zh-cn-labels. Update Purpose after archive.
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
