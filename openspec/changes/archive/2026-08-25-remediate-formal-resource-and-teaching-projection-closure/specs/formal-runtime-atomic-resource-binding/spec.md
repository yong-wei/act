## ADDED Requirements

### Requirement: Shared coordination allocation matches the downstream identity contract
Before any remediation inner artifact is generated, the system SHALL seal the same immutable coordination allocation record required by the downstream coordinated cutover and SHALL reuse one schema and validator for both paths. The record SHALL contain an opaque unique coordination run ID, exact Authority capture, compatibility result, sealed target-course active-domain scope, formal successor resource denominator, policy versions, and implementation identities. Remediation MAY add source, processor, terminology, locale, validator, and course-owner identities, but SHALL NOT omit or reinterpret a downstream-required field.

#### Scenario: Shared allocation is complete
- **WHEN** the offline remediation run begins
- **THEN** it SHALL seal one allocation containing every downstream-required identity before generating resource or teaching artifacts
- **AND** the downstream coordinator SHALL reopen that exact allocation rather than create another record

#### Scenario: Required allocation field is absent
- **WHEN** the run ID, Authority capture, compatibility result, sealed course scope, resource denominator, policy versions, or implementation identities are missing or drifted
- **THEN** remediation SHALL stop before generating inner artifacts
- **AND** no handoff SHALL claim compatibility with the coordinated cutover

### Requirement: Remediation completion requires materialized source-backed evidence
The formal resource workflow SHALL derive completion from a sealed execution over the exact captured successor resource denominator and shared coordination allocation. Every denominator row in a completed run SHALL resolve to a materialized resource record, processing receipt, and final `INCLUDED` or `EXCLUDED` disposition. Every included resource SHALL also have reopened atom and binding ledgers in which each atom is `BOUND` or evidenced `NON_TEACHING`, and every included teaching resource SHALL contain at least one `BOUND` atom. Every production-active baseline teaching resource SHALL remain `INCLUDED` unless the course owner records an exact evidence-bound retirement; a technical failure SHALL leave remediation incomplete and SHALL NOT become exclusion or retirement. Framework APIs, caller-supplied hashes, fixtures, synthetic qualification examples, hand-authored completion flags, and inventory rows without reopened outputs SHALL NOT count as processed resources.

#### Scenario: Real denominator closes
- **WHEN** the remediation run processes the captured successor denominator
- **THEN** every logical resource SHALL be conserved from the input manifest through its final `INCLUDED` or `EXCLUDED` disposition and summary
- **AND** every included teaching resource SHALL have at least one reopened `BOUND` formal atom, binding, and governed launch anchor while other atoms are bound or evidenced as non-teaching

#### Scenario: Only framework evidence exists
- **WHEN** builders, validators, fixtures, or caller-provided artifact hashes exist but no actual corpus outputs can be reopened from the captured run
- **THEN** the remediation state SHALL remain incomplete
- **AND** no formal resource envelope or downstream completion claim SHALL be emitted

#### Scenario: Canonical node has no resource
- **WHEN** a Canonical node has no resource row in the captured denominator
- **THEN** the node MAY remain in the Teaching Projection without a resource binding
- **AND** the workflow SHALL NOT create a placeholder resource or treat that node as a denominator failure

#### Scenario: Active-baseline resource has a technical failure
- **WHEN** a production-active baseline teaching resource fails source, recognition, segmentation, mapping, anchor, launcher, or another technical gate without an explicit course-owner retirement
- **THEN** the remediation run SHALL remain incomplete and SHALL emit no handoff bundle
- **AND** the resource SHALL remain in the denominator with its unresolved failure rather than receive a final `EXCLUDED` disposition

#### Scenario: New resource has a technical failure
- **WHEN** a resource from the explicit successor delta fails a formal gate
- **THEN** it MAY receive a final `EXCLUDED` disposition and remain development-only
- **AND** its failure SHALL NOT remove or weaken any active-baseline resource

#### Scenario: Active-baseline resource is explicitly retired
- **WHEN** the course owner records an exact resource, active release, reason, evidence, decision identity, and invalidation rule for retirement
- **THEN** that resource MAY receive the successor exclusion represented by the immutable retirement ledger
- **AND** the retirement SHALL NOT be represented as technical binding success or failure

### Requirement: Resource processing is provenance-bound and incrementally reproducible
Every reusable processing result SHALL bind the complete semantic dependency identity, including allocation and capture, source and atom hashes, Canonical semantic revision, role and scope, processor and validator versions, model/runtime/quantization where applicable, hotword manifest, segmentation and alignment rules, mapping qualification, anchor contract, and launcher identity. Reuse SHALL require an exact complete-key match and successful reopening of the immutable prior output.

#### Scenario: Complete dependency identity is unchanged
- **WHEN** an incremental run receives an exact prior dependency key and the referenced output reopens and validates
- **THEN** the workflow SHALL reuse that output without reprocessing the resource
- **AND** the new ledger SHALL retain the prior evidence identity and deterministic semantic hash

#### Scenario: One dependency drifts
- **WHEN** any source, atom, Canonical revision, role, scope, processor, model, hotword, segmentation, alignment, mapping, anchor, launcher, or validator dependency changes
- **THEN** the affected output and every derivative SHALL become stale and be recomputed or explicitly excluded
- **AND** unrelated resources with complete unchanged keys MAY remain reusable

#### Scenario: Resource is removed from the successor denominator
- **WHEN** a previously processed resource is explicitly removed by the captured successor input policy
- **THEN** the new ledger SHALL record an auditable removal or retirement disposition
- **AND** the resource SHALL NOT silently disappear from accounting

### Requirement: The remediation candidate is immutable and non-selectable
The completed remediation run SHALL seal one immutable handoff bundle containing the formal atoms, bindings, disposition ledger, resource envelope, validation reports, source and processor receipts, and exact shared coordination allocation identity. The downstream coordinated cutover SHALL reopen and reuse that same allocation and SHALL NOT create a second allocation for these inner artifacts. The bundle SHALL be marked non-selectable and SHALL NOT mutate production Runtime Release, Authority, Teaching Projection, domain, or consumer selectors.

#### Scenario: Remediation bundle passes validation
- **WHEN** all included resources, exclusions, non-teaching atoms, hashes, anchors, qualifications, and denominator totals reopen and validate
- **THEN** the system SHALL seal a non-selectable remediation handoff manifest over their exact artifact identities
- **AND** downstream coordination MAY consume it only by reopening the recorded artifacts

#### Scenario: A production selector differs after remediation
- **WHEN** validation observes that any production selector or active runtime identity changed during this remediation
- **THEN** the remediation SHALL fail
- **AND** the candidate SHALL remain unauthorized for downstream use
