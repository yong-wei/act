# authority-locale-readiness-and-switching Specification

## Purpose
Define release-bound Chinese completeness, bilingual-ready qualification, and new-graph language switching. ACT consumes immutable locale manifests from the graph project and does not author Authority translations.

## Requirements
### Requirement: Authority releases declare immutable locale readiness evidence
Every future Authority release proposed for the new graph product SHALL provide a versioned locale manifest bound to the same Aggregate, Component Manifest, Authority snapshot/release, schema, and language-component identity as the admitted release envelope. ACT MUST recompute the declared denominator, coverage, uniqueness, safety, and digest evidence before recording a locale qualification receipt and MUST NOT accept an unbound boolean readiness claim.

#### Scenario: Locale manifest matches the admitted envelope
- **WHEN** ACT verifies a locale manifest whose release, snapshot, component, schema, denominator digest, and content digest all match the admitted immutable envelope
- **THEN** ACT SHALL calculate and record the locale qualification result against that exact envelope
- **AND** no production selector or active graph state SHALL change during qualification

#### Scenario: Locale evidence is missing or drifted
- **WHEN** a locale manifest is absent, references another release or component, has a denominator mismatch, or changes after admission
- **THEN** locale qualification SHALL fail closed and produce no ready locale capability
- **AND** ACT SHALL not search another release, global registry, local overlay, or runtime latest path for replacements

### Requirement: Complete Chinese coverage gates future new-graph release acceptance
A future Authority release SHALL be eligible for the new graph product only when exact `zh-CN` content completely covers every mandatory learner-facing domain, object, type, relation, direction, explanation, approved alias, and user-readable source record in its declared presentation denominator. Missing, duplicate, unsafe, or cross-language values MUST fail qualification; an already active pre-contract release SHALL remain unchanged until a separate authorized cutover.

#### Scenario: Chinese presentation is complete
- **WHEN** every mandatory presentation record resolves to exactly one safe `zh-CN` value from the release-declared language component and all denominator checks pass
- **THEN** the release SHALL be marked Chinese-ready for candidate product qualification
- **AND** the qualification receipt SHALL remain bound to that release and language-component identity

#### Scenario: One mandatory Chinese record is absent
- **WHEN** any mandatory domain name, object name, type term, relation term, direction explanation, concept explanation, alias set, or readable source record lacks a safe `zh-CN` value
- **THEN** the release SHALL not be Chinese-ready
- **AND** an English value, raw enum, internal identifier, another release, or ACT-authored translation SHALL not satisfy the missing record

### Requirement: English readiness is complete and independently qualified
English SHALL be an optional locale capability evaluated against the same mandatory denominator and identity rules as Chinese. A release SHALL be bilingual-ready only when both `zh-CN` and `en` qualifications pass for the same Authority envelope; incomplete English MUST NOT invalidate a Chinese-ready release but MUST keep English unavailable.

#### Scenario: Both locales are complete
- **WHEN** the same admitted Authority envelope passes complete `zh-CN` and `en` qualification
- **THEN** the release SHALL advertise Chinese and English as available display languages
- **AND** both language projections SHALL retain identical object, relation, teaching, source, and resource-binding identities

#### Scenario: English is partial
- **WHEN** Chinese qualification passes but any mandatory English record is missing, duplicate, unsafe, or drifted
- **THEN** the release SHALL remain Chinese-ready and SHALL not be bilingual-ready
- **AND** no partial English field SHALL appear in the product

### Requirement: New graph language switching preserves graph state and language integrity
The new graph SHALL provide a `中文 / English` display-language control and SHALL initialize in Chinese. The control SHALL enable English only when the active release is bilingual-ready and the ACT-owned graph interface catalog is complete for both languages; switching SHALL replace the locale presentation for the same active identities while preserving domain, selection, relation filters, loaded logical shards, layout, pan, zoom, inspector section, and resource bindings.

#### Scenario: User switches a bilingual-ready graph to English
- **WHEN** the active release is bilingual-ready and the user selects `English`
- **THEN** every Authority-sourced visible and accessible graph surface SHALL resolve from the active envelope's English projection
- **AND** the graph topology, selected object, relation filters, viewport, inspector state, and launch identities SHALL remain unchanged

#### Scenario: Active release is not bilingual-ready
- **WHEN** the active release is Chinese-ready but English qualification is absent or failed
- **THEN** Chinese SHALL remain selected and English SHALL be unavailable with a bounded Chinese explanation
- **AND** the UI SHALL not switch first and fill missing values from Chinese, raw English fallbacks, or another release

### Requirement: ACT graph interface text has complete Chinese and English catalogs
Fixed product text owned by ACT, including graph buttons, filters, legends, loading, empty, error, availability, focus, and accessibility messages, SHALL resolve from one versioned graph-interface locale catalog. Every registered key MUST have safe `zh-CN` and `en` values before English can be enabled, and the catalog MUST NOT contain or override Authority domain names, object names, relation semantics, concept explanations, aliases, or source content.

#### Scenario: Interface catalog is complete
- **WHEN** every registered graph-interface key has reviewed Chinese and English values
- **THEN** the interface-catalog portion of bilingual readiness SHALL pass
- **AND** selecting English SHALL switch fixed graph controls and statuses together with Authority-sourced English content

#### Scenario: One interface key lacks English
- **WHEN** a graph control, filter, legend, error, empty state, or accessible message lacks a reviewed English value
- **THEN** English SHALL remain unavailable even if the upstream Authority English projection is complete
- **AND** ACT SHALL not use the Chinese value or a raw key in an English graph state

#### Scenario: Interface catalog attempts to translate Authority content
- **WHEN** the ACT graph-interface catalog contains a domain, object, relation, explanation, alias, or source override
- **THEN** catalog validation SHALL fail closed
- **AND** the Authority release SHALL remain the only editable source for that semantic text

### Requirement: Optional local learning content does not create mixed-language graph detail
Optional ACT-owned Knowledge Cards, infographs, resource titles, and other learning content SHALL declare which display languages are available independently from Authority locale qualification. When an optional block lacks the selected language, the inspector SHALL omit that block or show a bounded selected-language unavailable state while preserving semantic graph exploration and resource identity.

#### Scenario: English graph lacks an English Knowledge Card
- **WHEN** the bilingual-ready Authority graph is displayed in English but an optional ACT Knowledge Card is available only in Chinese
- **THEN** the inspector SHALL omit the card body or identify the English card as unavailable
- **AND** it SHALL not insert the Chinese card body into the English semantic detail

#### Scenario: Resource can launch without localized optional content
- **WHEN** a registered resource binding remains authorized but its optional display content lacks the selected language
- **THEN** the stable resource identity and permitted launch action SHALL remain available with a bounded language state when the source-owned launcher does not require the missing optional body
- **AND** language availability SHALL not change the binding or invent a translated resource title

### Requirement: Locale selection does not mutate authority or learning truth
Changing the new graph display language SHALL be local presentation state. It MUST NOT write Authority selectors, activation manifests, locale qualification receipts, learner facts, progress, graph-version state, resource bindings, or user-profile truth.

#### Scenario: User changes language repeatedly
- **WHEN** the user alternates between available Chinese and English presentations
- **THEN** only locale-specific display requests and client presentation state SHALL change
- **AND** server-side Authority, teaching, resource, and learning records SHALL remain unchanged
