## ADDED Requirements

### Requirement: Konling classifies governed study-question intents
Konling SHALL classify generic learning-support questions into formula derivation, code debugging, concept comparison, normative content, open-ended explanation, or the existing fact-explanation fallback using the current user request and server-owned runtime context.

#### Scenario: Formula derivation is requested
- **WHEN** a learner requests a formula derivation
- **THEN** Konling SHALL require the answer to state assumptions or symbol definitions, material transformations, applicable conditions, and a result check.

#### Scenario: Code debugging is requested
- **WHEN** a learner requests help locating or fixing a code problem
- **THEN** Konling SHALL require the answer to distinguish observed failure, likely cause, minimal correction, and a verification method.

#### Scenario: Concept comparison is requested
- **WHEN** a learner requests a concept distinction or comparison
- **THEN** Konling SHALL require the answer to state comparison dimensions and at least one boundary, counterexample, or applicable condition.

### Requirement: Konling keeps expression preferences below evidence governance
Konling SHALL accept supported explanation-depth, example, formatting, and hint-strength preferences only as presentation constraints.

#### Scenario: Learner requests a custom explanation format
- **WHEN** a learner asks for a shorter explanation, a domain-specific example, a structured format, or hints instead of a full answer
- **THEN** Konling SHALL adapt the answer presentation
- **AND** it SHALL NOT relax the evidence, citation, or normative-content requirements of the resolved answer intent.

### Requirement: Konling marks normative answers as verified or verification-required
Konling SHALL treat requests for standards, prescribed formats, official rules, legal requirements, or other normative content as authoritative only when the answer is supported by server-verified eligible authority citations.

#### Scenario: Normative content has eligible authority evidence
- **WHEN** a normative-content answer has a server-verified authoritative citation with a usable target
- **THEN** Konling SHALL identify the answer as verified normative guidance and expose its source information through platform citation metadata.

#### Scenario: Normative content lacks eligible authority evidence
- **WHEN** a normative-content answer lacks a server-verified authoritative citation with a usable target
- **THEN** Konling SHALL mark the answer as verification-required
- **AND** it SHALL NOT present the content as a definitive standard, official rule, or required format.

### Requirement: Konling binds material answer units to governed citations
Konling SHALL bind material conclusions, derivation transformations, and code repair recommendations to server-verified citation targets when content citations are available for the resolved study-question intent.

#### Scenario: A material answer unit cites evidence
- **WHEN** Konling produces a cited material conclusion, transformation, or repair recommendation
- **THEN** the response metadata SHALL identify the answer unit, its supported citation target, and any source limitation.

#### Scenario: A proposed citation is not server-verified
- **WHEN** model output contains a citation marker that cannot be mapped to an eligible server-verified citation target
- **THEN** the marker SHALL NOT become a verified citation link or evidence binding.

### Requirement: Konling maps answer units to citations through governed section policies
Konling SHALL map every study-question answer section to an evidence-required or model-derived citation policy, bind per-unit citation markers to the section they appear in, and report per-section traceability coverage in citation metadata.

#### Scenario: Evidence-required section carries per-unit citations
- **WHEN** a study-question answer includes an evidence-required section that is present in the answer
- **THEN** the citation guard SHALL report whether that section's answer units carry server-verified citations, counting the section as covered only when every substantive answer unit in it carries a citation
- **AND** an uncovered evidence-required section SHALL downgrade the answer confidence with a section-scoped reason.

#### Scenario: Model-derived sections stay distinguishable from source text
- **WHEN** a study-question answer includes model-derived sections such as derivation transformations or teaching elaborations
- **THEN** the response metadata SHALL identify those sections as model-derived so they are not presented as source quotations.

#### Scenario: Normative fail-closed answers keep coverage measurement honest
- **WHEN** a normative-content answer lacks eligible authority evidence and is marked verification-required
- **THEN** its sections SHALL NOT count toward traceability coverage requirements.

### Requirement: Konling removes invalid citation markers from persisted answers
Konling SHALL report numeric citation markers that resolve to missing, out-of-range, or unverified citation numbers, and SHALL remove them from the persisted answer body whenever a study-question contract is active.

#### Scenario: An invalid numeric marker appears in the answer
- **WHEN** model output contains a numeric citation marker that is not a server-assigned, verified, target-bearing citation
- **THEN** the marker SHALL be listed in citation metadata as unverified
- **AND** it SHALL be removed from the persisted answer text while valid markers are preserved.
