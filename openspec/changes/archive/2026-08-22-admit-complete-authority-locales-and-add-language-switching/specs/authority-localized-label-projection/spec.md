## ADDED Requirements

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
