## MODIFIED Requirements

### Requirement: Konling maps answer units to citations through governed section policies

Konling SHALL map every study-question answer section to an evidence-required or model-derived citation policy, bind per-unit citation markers to the section they appear in, and report per-section traceability coverage in citation metadata. Coverage denominators SHALL count only substantive answer units; structural lines (section lead-ins, short transitional phrases, pure math display lines, and dividers) MUST NOT dilute or inflate coverage.

#### Scenario: Evidence-required section carries per-unit citations

- **WHEN** a study-question answer includes an evidence-required section that is present in the answer
- **THEN** the citation guard SHALL report whether that section's substantive answer units carry server-verified citations, counting the section as covered only when every substantive answer unit in it carries a citation
- **AND** an uncovered evidence-required section SHALL downgrade the answer confidence with a section-scoped reason.

#### Scenario: Structural lines do not dilute coverage

- **WHEN** an evidence-required section contains section lead-ins ending with a colon, short transitional phrases without terminal punctuation, pure math display lines without prose, or dividers
- **THEN** those lines SHALL NOT count toward the required-unit denominator
- **AND** a section whose substantive conclusion lines all carry bindable markers SHALL be reported as covered.

#### Scenario: Model-derived sections stay distinguishable from source text

- **WHEN** a study-question answer includes model-derived sections such as derivation transformations or teaching elaborations
- **THEN** the response metadata SHALL identify those sections as model-derived so they are not presented as source quotations.

#### Scenario: Normative fail-closed answers keep coverage measurement honest

- **WHEN** a normative-content answer lacks eligible authority evidence and is marked verification-required
- **THEN** its sections SHALL NOT count toward traceability coverage requirements.

#### Scenario: Missing coverage reports its reason per unit

- **WHEN** a substantive answer unit in an evidence-required section carries no bindable citation
- **THEN** the coverage metadata SHALL classify the miss as no marker, an unassigned marker number, an unverified citation, or a citation without a target id
- **AND** the per-intent coverage record SHALL expose these missing-reason counts alongside the coverage ratio.

#### Scenario: Drifted and stacked markers do not inflate coverage

- **WHEN** valid citation markers appear only in model-derived sections or outside any section, or the same marker number is stacked repeatedly on one line
- **THEN** the citation guard SHALL emit diagnostic counts for the drift and the stacking
- **AND** unit coverage SHALL remain a per-substantive-unit boolean so stacked or drifted markers cannot inflate the coverage ratio.
