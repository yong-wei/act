# current-course-coverage-review Specification

## Purpose
TBD - created by archiving change establish-current-course-coverage-review. Update Purpose after archive.
## Requirements
### Requirement: Current worklist covers the admitted candidate exactly once
The system MUST derive the CourseCoverage worklist from the complete membership of the currently admitted Aggregate and its accepted Delta chain. Every reviewable Canonical object MUST appear exactly once and bind its current revision, entity type, semantic digest, source coverage, module membership, relation-neighborhood digest, evidence references, worklist input digest, Release/Delta identities and authoring revision. Historical item counts MUST NOT define the denominator.

For this requirement, `canonicalRevision` means the SHA-256 digest of the deterministic semantic object payload: Canonical ID, entity type, semantic/display labels, description, concept kind, release tier, publication/review status and source-coverage count. It MUST exclude generation time, packaging paths and any current role, verdict, approval or outcome.

#### Scenario: Current candidate membership is complete
- **WHEN** the admitted candidate and accepted Delta identities are unchanged during generation
- **THEN** the worklist SHALL contain every reviewable Canonical object exactly once and report `N_current` from the generated membership

#### Scenario: Member is duplicated, missing or unbound
- **WHEN** a Canonical member has zero or multiple rows or lacks a required current identity
- **THEN** worklist assembly SHALL fail without emitting a current review manifest

### Requirement: Historical decisions are non-authoritative review context
The system MAY include historical Coverage decisions only as provenance-bearing `priorDecisionRefs`. It MUST NOT copy a historical role, verdict or approval into the current decision surface. Profile-only status and evidence insufficiency MUST remain explicit in the current worklist and denominator.

#### Scenario: Prior decision exists for an unchanged label
- **WHEN** a historical decision references the same Canonical ID but another Release or worklist digest
- **THEN** the row SHALL expose it only as a prior reference and SHALL require a new current decision

#### Scenario: Profile-only evidence is insufficient
- **WHEN** an object has only Canonical profile metadata and no independent course evidence
- **THEN** the worklist SHALL retain the object, mark the evidence boundary and require the later review batch to resolve or block it

#### Scenario: Evidence source classification is explicit
- **WHEN** a prior evidence reference is loaded
- **THEN** only lesson authoring files and syllabus blueprint/main files SHALL count as `independent-course`; canonical metadata and topic lexicon SHALL remain aggregate provenance, and each evidence reference SHALL declare whether its digest covers raw bytes, selector evidence or a semantic payload

### Requirement: Review batches are deterministic and membership complete
The system MUST generate a review-batch manifest from the current worklist using stable semantic grouping and deterministic splitting. Each batch MUST bind one worklist digest, an exact ordered member list and member digest, review policy, source and type counts, profile-only members and required reviewer stages. Batch membership MUST be mutually exclusive and its union MUST equal the worklist denominator.

#### Scenario: Manifest is regenerated from identical input
- **WHEN** the same admitted candidate, worklist and authoring revision are used
- **THEN** every batch ID, member order, member digest and policy SHALL be byte-identical

#### Scenario: Batch membership overlaps or omits an item
- **WHEN** any Canonical item appears in multiple batches or in no batch
- **THEN** manifest generation SHALL fail and no review child change SHALL be eligible for registration

### Requirement: Review child changes are created only from the frozen manifest
Each later `review-course-coverage-<batch-id>` change MUST use a batch ID and exact member digest from the current manifest. The batch change MUST NOT add, drop or replace members. The current CourseCoverage gate MUST remain blocked until every manifest batch has an accepted decision assembly for the same worklist digest.

#### Scenario: Buddy child matches a manifest batch
- **WHEN** a proposed review child names an exact batch ID and member digest from the current manifest
- **THEN** it MAY be registered as a review work item blocked by this change

#### Scenario: Proposed child uses a provisional or historical batch
- **WHEN** a proposed child is not present in the current manifest or uses another member digest
- **THEN** registration and Coverage assembly SHALL reject it

### Requirement: Candidate drift invalidates the worklist and batches
The system MUST compare the admitted Aggregate, Release, Delta, worklist input and authoring revisions before publishing the manifest and before assembling decisions. The input fingerprint MUST include the ACTIVE Coverage artifact bytes, the module-membership source-file set and digests, the derived membership digest, the authoring revision and every actual authoring-input path/digest. Each actual input byte digest MUST equal `git show <authoringRevision>:<path>`; the worklist MUST be rebuilt after the pre-publication reread. Any drift MUST invalidate the worklist and every dependent unfinished batch. No production CourseCoverage selector or other authority selector may change in this change.

#### Scenario: Aggregate changes before manifest publication
- **WHEN** the latest admitted identity differs from the worklist input identity
- **THEN** the generator SHALL reject the worklist and require regeneration from the new candidate

#### Scenario: Worklist and manifest are valid
- **WHEN** all denominator, digest, evidence and batch-closure checks pass
- **THEN** the system SHALL atomically publish all review-input files while leaving CourseCoverage and production selectors unchanged; a partial or differing immutable output set SHALL fail without modification

#### Scenario: Authoring bytes differ from the selected revision
- **WHEN** any actual input path is absent at or differs from `git show <authoringRevision>:<path>`
- **THEN** generation SHALL fail before publication and SHALL NOT emit a current review output set

### Requirement: Frozen batch receipts distinguish review-stage terminality from CourseCoverage authority

Every frozen batch review MUST use independently authored stage records. Deterministic runtime code MAY validate bindings, calculate digests, detect conflicts, and assemble a receipt, but MUST NOT derive `INCLUDE`, `EXCLUDE`, or `DEFER` from risk flags, labels, profiles, or other input metadata. A review-stage terminal DEFER MUST remain unresolved for CourseCoverage authority and MUST keep the aggregate Coverage gate blocked.

#### Scenario: Independent reviewers agree evidence is insufficient

- **WHEN** Primary and required Challenger independently record role-free DEFER conclusions for a member
- **THEN** the batch receipt SHALL record `DEFERRED_EVIDENCE_BLOCKED` while the member remains unresolved for CourseCoverage authority

#### Scenario: Deterministic receipt assembly runs

- **WHEN** the batch assembler validates and merges stage records
- **THEN** it SHALL preserve authored conclusions without generating a conclusion or writing CURRENT, ACTIVE, selector, or writer-fence authority

### Requirement: Batch eddd24f003650f02d99f5b66 has an immutable review boundary

The review child MUST process only the exact ordered members at `batch-manifest.json#/batches/0/members`, binding batchId `eddd24f003650f02d99f5b66`, sequence `0`, semanticGroupKey `ctr:release:classical-control-design-engineering-v0.1::entityType:DomainConcept`, member count `96`, memberDigest `451c6c53491105d2c4e94d0b9bf981cfce6f5996eecdda1a849d4ba9fdb165fd`, worklistInputDigest `55d9a896cccc5e55d0cb754187ccdc06ef8f6a845b5152f0c0106620039662c2`, worklistDigest `bd80f5e20ad0713dd4203e5336328b5c919d44b98a376d8b5d3cf6835a398489`, and manifestDigest `2f5fa8f4b9e1d7fa75c7d2be5f2629be792e0fb35907e678f8ff3a3fa2a6c818`.

#### Scenario: Frozen batch eddd24f003650f02d99f5b66 is unchanged

- **WHEN** all bound fields and canonical revisions match the manifest slice
- **THEN** the child SHALL admit exactly that ordered member set and no other member

#### Scenario: Batch eddd24f003650f02d99f5b66 drifts

- **WHEN** any member, order, digest, or revision differs
- **THEN** review and receipt assembly SHALL fail closed without changing production selector or writer fence

### Requirement: Batch eddd24f003650f02d99f5b66 produces independent review-stage conclusions

Primary and Challenger MUST issue independent conclusions; Challenger MUST run for profileOnly, new, changed, or highRisk members. Every conflict MUST enter Third, and Third MUST be terminal. `INCLUDE` and `EXCLUDE` MUST carry a valid CourseCoverage role and sufficient independent current-course evidence. `DEFER` MUST carry no CourseCoverage role and MUST be represented as the review-stage terminal state `DEFERRED_EVIDENCE_BLOCKED`.

#### Scenario: Conflict occurs in batch eddd24f003650f02d99f5b66

- **WHEN** Primary and Challenger conclusions differ for a member
- **THEN** Third SHALL record the terminal conclusion and rationale in the receipt

#### Scenario: Batch eddd24f003650f02d99f5b66 has no conflict

- **WHEN** required stages agree and every member has a review-stage terminal conclusion
- **THEN** the receipt SHALL preserve each stage's independent rationale and terminal conclusion in machine-readable `stageRecords`, including the ordered decision records and each stage document digest; the embedded records SHALL close to the supplied stage documents

#### Scenario: Evidence remains insufficient

- **WHEN** independent reviewers conclude that the frozen evidence cannot support inclusion or exclusion
- **THEN** the receipt SHALL record `DEFERRED_EVIDENCE_BLOCKED`, keep the member in the denominator, assign no CourseCoverage role, and keep the aggregate Coverage gate blocked

### Requirement: Batch eddd24f003650f02d99f5b66 emits a machine-mergeable receipt

The review receipt MUST be keyed by every batch binding digest, preserve exact ordered member references, and prove that no out-of-slice member or production authority was written. It MUST embed complete `stageRecords` for Primary, Challenger, and (when present) Third, including each stage's reviewer identity, input digest, ordered per-member conclusion, evidence selectors, rationale, decision digest, and document digest. Deterministic code MUST validate and assemble independently authored stage records and MUST NOT generate semantic conclusions. The receipt MUST contain a deterministic sibling `attestationPath` and a pre-publication production-boundary proof; the detached attestation is the authoritative post-publication closure and MUST bind the receipt digest, both boundary snapshots, the protected paths and its own digest.

#### Scenario: Receipt for batch eddd24f003650f02d99f5b66 is assembled

- **WHEN** all required stages are review-stage terminal and drift checks pass
- **THEN** the receipt SHALL be deterministic, machine-mergeable, scoped to `eddd24f003650f02d99f5b66`, and incapable of writing CURRENT or ACTIVE CourseCoverage authority

#### Scenario: Production authority is dirty before receipt publication

- **WHEN** a protected CourseCoverage selector, Canonical RAG selector, LearningFact writer-fence path, or Git `HEAD` is dirty or differs from its selected revision in the pre-publication snapshot
- **THEN** receipt publication SHALL fail closed and SHALL not emit a receipt claiming a clean production boundary from fixed boolean values

#### Scenario: Detached attestation closes the publication boundary

- **WHEN** the immutable receipt is published, the CLI captures a true post-receipt snapshot, publishes its deterministic sibling attestation, and replays an identical artifact set
- **THEN** the attestation SHALL bind the receipt digest, pre- and post-publication Git and protected-path snapshots, and its own digest; replay SHALL load and validate the receipt/attestation closure, and any failure after a new receipt is published SHALL attempt cleanup and surface cleanup failure

The current publication boundary SHALL use the v3 proof and v2 detached-attestation schemas. The v3 proof and attestation MUST persist the ordered per-path protected-authority digests and bind those rows to both snapshot digests. A v3 replay MUST compare every current protected-path byte and clean status with the persisted rows and MUST NOT require the capture commit object or call capture-commit ancestry/blob lookup; it MAY continue from a descendant commit or a squash/content-equivalent commit. Legacy v2 proof/v1 attestation pairs MAY replay only through the legacy readable capture-commit ancestry and blob checks. A missing source-artifact binding is tolerated only while replaying an already published legacy pair; new publication remains fail-closed when the binding is absent.

#### Scenario: Squash or content-equivalent continuation is replayed

- **WHEN** a v3 receipt/attestation pair is replayed from a commit whose protected paths are clean and byte-identical to the persisted ordered rows, but whose capture commit is not an ancestor or is unavailable locally
- **THEN** replay SHALL return the immutable pair without recomputing it; any protected-path byte or status drift SHALL fail closed

### Requirement: Batch c3fa63179e847ed1f2e2b6c1 has an immutable review boundary

The review child MUST process only the exact ordered members at `batch-manifest.json#/batches/1/members`, binding batchId `c3fa63179e847ed1f2e2b6c1`, sequence `0`, semanticGroupKey `ctr:release:classical-control-design-engineering-v0.1::entityType:Formula`, member count `98`, memberDigest `ceebf1c62b71689304b36603dbd3da2e76a5b15ac08102f969441021c7f3d933`, worklistInputDigest `55d9a896cccc5e55d0cb754187ccdc06ef8f6a845b5152f0c0106620039662c2`, worklistDigest `bd80f5e20ad0713dd4203e5336328b5c919d44b98a376d8b5d3cf6835a398489`, and manifestDigest `2f5fa8f4b9e1d7fa75c7d2be5f2629be792e0fb35907e678f8ff3a3fa2a6c818`.

#### Scenario: Frozen batch c3fa63179e847ed1f2e2b6c1 is unchanged

- **WHEN** all bound fields and canonical revisions match the manifest slice
- **THEN** the child SHALL admit exactly that ordered member set and no other member

#### Scenario: Batch c3fa63179e847ed1f2e2b6c1 drifts

- **WHEN** any member, order, digest, or revision differs
- **THEN** review and receipt assembly SHALL fail closed without changing production selector or writer fence

### Requirement: Batch c3fa63179e847ed1f2e2b6c1 produces independent terminal decisions

Primary and Challenger MUST issue independent conclusions; Challenger MUST run for profileOnly, new, changed, or highRisk members. Every conflict MUST enter Third, and Third MUST be terminal.

#### Scenario: Conflict occurs in batch c3fa63179e847ed1f2e2b6c1

- **WHEN** Primary and Challenger conclusions differ for a member
- **THEN** Third SHALL record the terminal conclusion and rationale in the receipt

#### Scenario: Batch c3fa63179e847ed1f2e2b6c1 has no conflict

- **WHEN** required stages agree and every member has a review-stage terminal conclusion
- **THEN** the receipt SHALL preserve each stage's independent rationale and terminal conclusion; a DEFER conclusion SHALL remain unresolved for CourseCoverage authority and keep the aggregate Coverage gate blocked

### Requirement: Batch c3fa63179e847ed1f2e2b6c1 emits a machine-mergeable receipt

The decision receipt MUST be keyed by every batch binding digest, preserve exact ordered member references, and prove that no out-of-slice member or production authority was written.

#### Scenario: Receipt for batch c3fa63179e847ed1f2e2b6c1 is assembled

- **WHEN** all required stages are terminal and drift checks pass
- **THEN** the receipt SHALL be deterministic, machine-mergeable, and scoped to `c3fa63179e847ed1f2e2b6c1`

### Requirement: Batch bdaa6aeec022a589b5f8fdb3 has an immutable review boundary

The review child MUST process only the exact ordered members at `batch-manifest.json#/batches/2/members`, binding batchId `bdaa6aeec022a589b5f8fdb3`, sequence `0`, semanticGroupKey `ctr:release:classical-control-design-engineering-v0.1::entityType:KnowledgeStatement`, member count `500`, memberDigest `ab17716fb40cce4d6c8793e51b094e20eb452d98b29a2b1a9f265d12bfc1e70d`, worklistInputDigest `55d9a896cccc5e55d0cb754187ccdc06ef8f6a845b5152f0c0106620039662c2`, worklistDigest `bd80f5e20ad0713dd4203e5336328b5c919d44b98a376d8b5d3cf6835a398489`, and manifestDigest `2f5fa8f4b9e1d7fa75c7d2be5f2629be792e0fb35907e678f8ff3a3fa2a6c818`.

#### Scenario: Frozen batch bdaa6aeec022a589b5f8fdb3 is unchanged

- **WHEN** all bound fields and canonical revisions match the manifest slice
- **THEN** the child SHALL admit exactly that ordered member set and no other member

#### Scenario: Batch bdaa6aeec022a589b5f8fdb3 drifts

- **WHEN** any member, order, digest, or revision differs
- **THEN** review and receipt assembly SHALL fail closed without changing production selector or writer fence

### Requirement: Batch db0c70336e831eda0052423c has an immutable review boundary

The review child MUST process only the exact ordered members at `batch-manifest.json#/batches/3/members`, binding batchId `db0c70336e831eda0052423c`, sequence `1`, semanticGroupKey `ctr:release:classical-control-design-engineering-v0.1::entityType:KnowledgeStatement`, member count `11`, memberDigest `619a093c3c0bfdfbf0097d8ec2ef420c3032619d3efe15caa06e417c16724f33`, worklistInputDigest `55d9a896cccc5e55d0cb754187ccdc06ef8f6a845b5152f0c0106620039662c2`, worklistDigest `bd80f5e20ad0713dd4203e5336328b5c919d44b98a376d8b5d3cf6835a398489`, and manifestDigest `2f5fa8f4b9e1d7fa75c7d2be5f2629be792e0fb35907e678f8ff3a3fa2a6c818`.

#### Scenario: Frozen batch db0c70336e831eda0052423c is unchanged

- **WHEN** all bound fields and canonical revisions match the manifest slice
- **THEN** the child SHALL admit exactly that ordered member set and no other member

#### Scenario: Batch db0c70336e831eda0052423c drifts

- **WHEN** any member, order, digest, or revision differs
- **THEN** review and receipt assembly SHALL fail closed without changing production selector or writer fence

### Requirement: Batch db0c70336e831eda0052423c produces independent terminal decisions

Primary and Challenger MUST issue independent conclusions; Challenger MUST run for profileOnly, new, changed, or highRisk members. Every conflict MUST enter Third, and Third MUST be terminal.

#### Scenario: Conflict occurs in batch db0c70336e831eda0052423c

- **WHEN** Primary and Challenger conclusions differ for a member
- **THEN** Third SHALL record the terminal conclusion and rationale in the receipt

#### Scenario: Batch db0c70336e831eda0052423c has no conflict

- **WHEN** required stages agree and every member has a review-stage terminal conclusion
- **THEN** the receipt SHALL preserve each stage's independent rationale and terminal conclusion; a DEFER conclusion SHALL remain unresolved for CourseCoverage authority and keep the aggregate Coverage gate blocked

### Requirement: Batch db0c70336e831eda0052423c emits a machine-mergeable receipt

The decision receipt MUST be keyed by every batch binding digest, preserve exact ordered member references, and prove that no out-of-slice member or production authority was written.

#### Scenario: Receipt for batch db0c70336e831eda0052423c is assembled

- **WHEN** all required stages are terminal and drift checks pass
- **THEN** the receipt SHALL be deterministic, machine-mergeable, and scoped to `db0c70336e831eda0052423c`

### Requirement: Batch 0498fbe339d4b1972a18216d has an immutable review boundary

The review child MUST process only the exact ordered members at `batch-manifest.json#/batches/5/members`, binding batchId `0498fbe339d4b1972a18216d`, sequence `0`, semanticGroupKey `ctr:release:discrete-time-control-analysis-engineering-v0.1::entityType:DomainConcept`, member count `126`, memberDigest `f79d89124c79490cd739787f2dbc171471c1381203d1ceb8a263f03a2fec04d6`, worklistInputDigest `55d9a896cccc5e55d0cb754187ccdc06ef8f6a845b5152f0c0106620039662c2`, worklistDigest `bd80f5e20ad0713dd4203e5336328b5c919d44b98a376d8b5d3cf6835a398489`, and manifestDigest `2f5fa8f4b9e1d7fa75c7d2be5f2629be792e0fb35907e678f8ff3a3fa2a6c818`.

#### Scenario: Frozen batch 0498fbe339d4b1972a18216d is unchanged

- **WHEN** all bound fields and canonical revisions match the manifest slice
- **THEN** the child SHALL admit exactly that ordered member set and no other member

#### Scenario: Batch 0498fbe339d4b1972a18216d drifts

- **WHEN** any member, order, digest, or revision differs
- **THEN** review and receipt assembly SHALL fail closed without changing production selector or writer fence

### Requirement: Batch 0498fbe339d4b1972a18216d produces independent terminal decisions

Primary and Challenger MUST issue independent conclusions; Challenger MUST run for profileOnly, new, changed, or highRisk members. Every conflict MUST enter Third, and Third MUST be terminal.

#### Scenario: Conflict occurs in batch 0498fbe339d4b1972a18216d

- **WHEN** Primary and Challenger conclusions differ for a member
- **THEN** Third SHALL record the terminal conclusion and rationale in the receipt

#### Scenario: Batch 0498fbe339d4b1972a18216d has no conflict

- **WHEN** required stages agree and every member has a review-stage terminal conclusion
- **THEN** the receipt SHALL preserve each stage's independent rationale and conclusion
- **AND** any `DEFER` conclusion SHALL remain role-free, leave CourseCoverage authority unresolved, and produce `DEFERRED_EVIDENCE_BLOCKED` with the aggregate coverage gate blocked

### Requirement: Batch 0498fbe339d4b1972a18216d emits a machine-mergeable receipt

The decision receipt MUST be keyed by every batch binding digest, preserve exact ordered member references, and prove that no out-of-slice member or production authority was written.

#### Scenario: Receipt for batch 0498fbe339d4b1972a18216d is assembled

- **WHEN** all required stages are terminal and drift checks pass
- **THEN** the receipt SHALL be deterministic, machine-mergeable, and scoped to `0498fbe339d4b1972a18216d`

### Requirement: Batch f0fcba2ac86dff72bfda451b has an immutable review boundary

The review child MUST process only the exact ordered members at `batch-manifest.json#/batches/7/members`, binding batchId `f0fcba2ac86dff72bfda451b`, sequence `0`, semanticGroupKey `ctr:release:discrete-time-control-analysis-engineering-v0.1::entityType:KnowledgeStatement`, member count `371`, memberDigest `b7b16635ebdbfa275212dae1da2be8175d8f23dfde1b47f401ee7086aee37bea`, worklistInputDigest `55d9a896cccc5e55d0cb754187ccdc06ef8f6a845b5152f0c0106620039662c2`, worklistDigest `bd80f5e20ad0713dd4203e5336328b5c919d44b98a376d8b5d3cf6835a398489`, and manifestDigest `2f5fa8f4b9e1d7fa75c7d2be5f2629be792e0fb35907e678f8ff3a3fa2a6c818`.

#### Scenario: Frozen batch f0fcba2ac86dff72bfda451b is unchanged

- **WHEN** all bound fields and canonical revisions match the manifest slice
- **THEN** the child SHALL admit exactly that ordered member set and no other member

#### Scenario: Batch f0fcba2ac86dff72bfda451b drifts

- **WHEN** any member, order, digest, or revision differs
- **THEN** review and receipt assembly SHALL fail closed without changing production selector or writer fence

### Requirement: Batch f0fcba2ac86dff72bfda451b produces independent terminal decisions

Primary and Challenger MUST issue independent conclusions; Challenger MUST run for profileOnly, new, changed, or highRisk members. Every conflict MUST enter Third, and Third MUST be terminal.

#### Scenario: Conflict occurs in batch f0fcba2ac86dff72bfda451b

- **WHEN** Primary and Challenger conclusions differ for a member
- **THEN** Third SHALL record the terminal conclusion and rationale in the receipt

#### Scenario: Batch f0fcba2ac86dff72bfda451b has no conflict

- **WHEN** required stages agree and every member has a review-stage terminal conclusion
- **THEN** the receipt SHALL preserve each stage's independent rationale and conclusion
- **AND** any `DEFER` conclusion SHALL remain role-free, leave CourseCoverage authority unresolved, and produce `DEFERRED_EVIDENCE_BLOCKED` with the aggregate coverage gate blocked

### Requirement: Batch f0fcba2ac86dff72bfda451b emits a machine-mergeable receipt

The decision receipt MUST be keyed by every batch binding digest, preserve exact ordered member references, and prove that no out-of-slice member or production authority was written.

#### Scenario: Receipt for batch f0fcba2ac86dff72bfda451b is assembled

- **WHEN** all required stages are terminal and drift checks pass
- **THEN** the receipt SHALL be deterministic, machine-mergeable, and scoped to `f0fcba2ac86dff72bfda451b`

### Requirement: Batch ccaed21f450591f642fa7ef7 has an immutable review boundary

The review child MUST process only the exact ordered members at `batch-manifest.json#/batches/9/members`, binding batchId `ccaed21f450591f642fa7ef7`, sequence `0`, semanticGroupKey `ctr:release:frequency-domain-analysis-engineering-v0.1::entityType:DomainConcept`, member count `96`, memberDigest `33462c99375f663611af4b05fae10f0c82e9eef3117214ccbd6c67a39c1c525a`, worklistInputDigest `55d9a896cccc5e55d0cb754187ccdc06ef8f6a845b5152f0c0106620039662c2`, worklistDigest `bd80f5e20ad0713dd4203e5336328b5c919d44b98a376d8b5d3cf6835a398489`, and manifestDigest `2f5fa8f4b9e1d7fa75c7d2be5f2629be792e0fb35907e678f8ff3a3fa2a6c818`.

#### Scenario: Frozen batch ccaed21f450591f642fa7ef7 is unchanged

- **WHEN** all bound fields and canonical revisions match the manifest slice
- **THEN** the child SHALL admit exactly that ordered member set and no other member

#### Scenario: Batch ccaed21f450591f642fa7ef7 drifts

- **WHEN** any member, order, digest, or revision differs
- **THEN** review and receipt assembly SHALL fail closed without changing production selector or writer fence

### Requirement: Batch ccaed21f450591f642fa7ef7 produces independent terminal decisions

Primary and Challenger MUST issue independent conclusions; Challenger MUST run for profileOnly, new, changed, or highRisk members. Every conflict MUST enter Third, and Third MUST be terminal.

#### Scenario: Conflict occurs in batch ccaed21f450591f642fa7ef7

- **WHEN** Primary and Challenger conclusions differ for a member
- **THEN** Third SHALL record the terminal conclusion and rationale in the receipt

#### Scenario: Batch ccaed21f450591f642fa7ef7 has no conflict

- **WHEN** required stages agree and every member has a review-stage terminal conclusion
- **THEN** the receipt SHALL preserve each stage's independent rationale and conclusion
- **AND** any `DEFER` conclusion SHALL remain role-free, leave CourseCoverage authority unresolved, and produce `DEFERRED_EVIDENCE_BLOCKED` with the aggregate coverage gate blocked

### Requirement: Batch ccaed21f450591f642fa7ef7 emits a machine-mergeable receipt

The decision receipt MUST be keyed by every batch binding digest, preserve exact ordered member references, and prove that no out-of-slice member or production authority was written.

#### Scenario: Receipt for batch ccaed21f450591f642fa7ef7 is assembled

- **WHEN** all required stages are terminal and drift checks pass
- **THEN** the receipt SHALL be deterministic, machine-mergeable, and scoped to `ccaed21f450591f642fa7ef7`

### Requirement: Batch 6cd127ac1e695df52b4dbaa5 has an immutable review boundary

The review child MUST process only the exact ordered members at `batch-manifest.json#/batches/11/members`, binding batchId `6cd127ac1e695df52b4dbaa5`, sequence `0`, semanticGroupKey `ctr:release:frequency-domain-analysis-engineering-v0.1::entityType:KnowledgeStatement`, member count `407`, memberDigest `93ab74af657df935220a7f5302922792ce64e5e3a9ca8474c7683f87984f87c8`, worklistInputDigest `55d9a896cccc5e55d0cb754187ccdc06ef8f6a845b5152f0c0106620039662c2`, worklistDigest `bd80f5e20ad0713dd4203e5336328b5c919d44b98a376d8b5d3cf6835a398489`, and manifestDigest `2f5fa8f4b9e1d7fa75c7d2be5f2629be792e0fb35907e678f8ff3a3fa2a6c818`.

#### Scenario: Frozen batch 6cd127ac1e695df52b4dbaa5 is unchanged

- **WHEN** all bound fields and canonical revisions match the manifest slice
- **THEN** the child SHALL admit exactly that ordered member set and no other member

#### Scenario: Batch 6cd127ac1e695df52b4dbaa5 drifts

- **WHEN** any member, order, digest, or revision differs
- **THEN** review and receipt assembly SHALL fail closed without changing production selector or writer fence

### Requirement: Batch 6cd127ac1e695df52b4dbaa5 produces independent terminal decisions

Primary and Challenger MUST issue independent conclusions; Challenger MUST run for profileOnly, new, changed, or highRisk members. Every conflict MUST enter Third, and Third MUST be terminal.

#### Scenario: Conflict occurs in batch 6cd127ac1e695df52b4dbaa5

- **WHEN** Primary and Challenger conclusions differ for a member
- **THEN** Third SHALL record the terminal conclusion and rationale in the receipt

#### Scenario: Batch 6cd127ac1e695df52b4dbaa5 has no conflict

- **WHEN** required stages agree and every member has a review-stage terminal conclusion
- **THEN** the receipt SHALL preserve each stage's independent rationale and conclusion
- **AND** any `DEFER` conclusion SHALL remain role-free, leave CourseCoverage authority unresolved, and produce `DEFERRED_EVIDENCE_BLOCKED` with the aggregate coverage gate blocked

### Requirement: Batch 6cd127ac1e695df52b4dbaa5 emits a machine-mergeable receipt

The decision receipt MUST be keyed by every batch binding digest, preserve exact ordered member references, and prove that no out-of-slice member or production authority was written.

#### Scenario: Receipt for batch 6cd127ac1e695df52b4dbaa5 is assembled

- **WHEN** all required stages are terminal and drift checks pass
- **THEN** the receipt SHALL be deterministic, machine-mergeable, and scoped to `6cd127ac1e695df52b4dbaa5`

### Requirement: Batch 4fe2a9542cff584574ec2299 has an immutable review boundary

The review child MUST process only the exact ordered members at `batch-manifest.json#/batches/4/members`, binding batchId `4fe2a9542cff584574ec2299`, sequence `0`, semanticGroupKey `ctr:release:classical-control-design-engineering-v0.1::entityType:SystemModel`, member count `13`, memberDigest `1483d702fd4044daee524cca5c6487c72db1048bcbe87765b8e998bfcbb87bef`, worklistInputDigest `55d9a896cccc5e55d0cb754187ccdc06ef8f6a845b5152f0c0106620039662c2`, worklistDigest `bd80f5e20ad0713dd4203e5336328b5c919d44b98a376d8b5d3cf6835a398489`, and manifestDigest `2f5fa8f4b9e1d7fa75c7d2be5f2629be792e0fb35907e678f8ff3a3fa2a6c818`.

#### Scenario: Frozen batch 4fe2a9542cff584574ec2299 is unchanged

- **WHEN** all bound fields and canonical revisions match the manifest slice
- **THEN** the child SHALL admit exactly that ordered member set and no other member

#### Scenario: Batch 4fe2a9542cff584574ec2299 drifts

- **WHEN** any member, order, digest, or revision differs
- **THEN** review and receipt assembly SHALL fail closed without changing production selector or writer fence

### Requirement: Batch 4fe2a9542cff584574ec2299 produces independent terminal decisions

Primary and Challenger MUST issue independent conclusions; Challenger MUST run for profileOnly, new, changed, or highRisk members. Every conflict MUST enter Third, and Third MUST be terminal.

#### Scenario: Conflict occurs in batch 4fe2a9542cff584574ec2299

- **WHEN** Primary and Challenger conclusions differ for a member
- **THEN** Third SHALL record the terminal conclusion and rationale in the receipt

#### Scenario: Batch 4fe2a9542cff584574ec2299 has no conflict

- **WHEN** required stages agree and every member has a review-stage terminal conclusion
- **THEN** the receipt SHALL preserve each stage's independently authored source binding, rationale, and conclusion
- **AND** any `DEFER` conclusion SHALL remain role-free, leave CourseCoverage authority unresolved, and produce `DEFERRED_EVIDENCE_BLOCKED` with the aggregate coverage gate blocked

### Requirement: Batch 4fe2a9542cff584574ec2299 emits a machine-mergeable receipt

The decision receipt MUST be keyed by every batch binding digest, preserve exact ordered member references, bind the independent stage-source artifacts, and prove that no out-of-slice member or production authority was written. Its v3 proof and v2 detached attestation MUST preserve ordered protected-path digests for squash-safe identical replay.

#### Scenario: Receipt for batch 4fe2a9542cff584574ec2299 is assembled

- **WHEN** all required stages are terminal and drift checks pass
- **THEN** the receipt SHALL be deterministic, machine-mergeable, and scoped to `4fe2a9542cff584574ec2299`

### Requirement: Batch a7a2bc4b76204034bcf56862 has an immutable review boundary

The review child MUST process only the exact ordered members at `batch-manifest.json#/batches/13/members`, binding batchId `a7a2bc4b76204034bcf56862`, sequence `0`, semanticGroupKey `ctr:release:stability-analysis-engineering-v0.1::entityType:DomainConcept`, member count `31`, memberDigest `e1bf8070ee6a7aea245df5e780c2732ce08262e9a28d6dd15db09a71c05a4084`, worklistInputDigest `55d9a896cccc5e55d0cb754187ccdc06ef8f6a845b5152f0c0106620039662c2`, worklistDigest `bd80f5e20ad0713dd4203e5336328b5c919d44b98a376d8b5d3cf6835a398489`, and manifestDigest `2f5fa8f4b9e1d7fa75c7d2be5f2629be792e0fb35907e678f8ff3a3fa2a6c818`.

#### Scenario: Frozen batch a7a2bc4b76204034bcf56862 is unchanged

- **WHEN** all bound fields and canonical revisions match the manifest slice
- **THEN** the child SHALL admit exactly that ordered member set and no other member

#### Scenario: Batch a7a2bc4b76204034bcf56862 drifts

- **WHEN** any member, order, digest, or revision differs
- **THEN** review and receipt assembly SHALL fail closed without changing production selector or writer fence

### Requirement: Batch a7a2bc4b76204034bcf56862 produces independent terminal decisions

Primary and Challenger MUST issue independent conclusions; Challenger MUST run for profileOnly, new, changed, or highRisk members. Every conflict MUST enter Third, and Third MUST be terminal.

#### Scenario: Conflict occurs in batch a7a2bc4b76204034bcf56862

- **WHEN** Primary and Challenger conclusions differ for a member
- **THEN** Third SHALL record the terminal conclusion and rationale in the receipt

#### Scenario: Batch a7a2bc4b76204034bcf56862 has no conflict

- **WHEN** required stages agree and every member has a review-stage terminal conclusion
- **THEN** the receipt SHALL preserve each stage's independent rationale and conclusion
- **AND** any `DEFER` conclusion SHALL remain role-free, leave CourseCoverage authority unresolved, and produce `DEFERRED_EVIDENCE_BLOCKED` with the aggregate coverage gate blocked

### Requirement: Batch a7a2bc4b76204034bcf56862 emits a machine-mergeable receipt

The decision receipt MUST be keyed by every batch binding digest, preserve exact ordered member references, bind the independent Primary/Challenger stage-source artifacts through each normalized stage document and provenance record, and prove that no out-of-slice member or production authority was written. Its v3 production-boundary proof and v2 detached attestation MUST preserve ordered protected-path digests for squash-safe identical replay.

#### Scenario: Receipt for batch a7a2bc4b76204034bcf56862 is assembled

- **WHEN** all required stages are terminal and drift checks pass
- **THEN** the receipt SHALL be deterministic, machine-mergeable, and scoped to `a7a2bc4b76204034bcf56862`

### Requirement: Batch babc4b83475400c53b2f46d7 has an immutable review boundary

The review child MUST process only the exact ordered members at `batch-manifest.json#/batches/6/members`, binding batchId `babc4b83475400c53b2f46d7`, sequence `0`, semanticGroupKey `ctr:release:discrete-time-control-analysis-engineering-v0.1::entityType:Formula`, member count `118`, memberDigest `63c8c031da440ea2ee55bc74154b8f1877e2779a4b658ada16277851a68ff151`, worklistInputDigest `55d9a896cccc5e55d0cb754187ccdc06ef8f6a845b5152f0c0106620039662c2`, worklistDigest `bd80f5e20ad0713dd4203e5336328b5c919d44b98a376d8b5d3cf6835a398489`, manifestDigest `2f5fa8f4b9e1d7fa75c7d2be5f2629be792e0fb35907e678f8ff3a3fa2a6c818`, and raw manifest artifact SHA-256 `786a305f3c6de217c6cc561a4e5200517615a651e346bf4bff73c9bdb54593e8`.

#### Scenario: Frozen batch babc4b83475400c53b2f46d7 is unchanged

- **WHEN** all bound fields and canonical revisions match the manifest slice
- **THEN** the child SHALL admit exactly that ordered member set and no other member

#### Scenario: Batch babc4b83475400c53b2f46d7 drifts

- **WHEN** any member, order, digest, or revision differs
- **THEN** review and receipt assembly SHALL fail closed without changing production selector or writer fence

### Requirement: Batch babc4b83475400c53b2f46d7 produces independent terminal decisions

Primary and Challenger MUST issue independent conclusions; Challenger MUST run for profileOnly, new, changed, or highRisk members. Every conflict MUST enter Third, and Third MUST be terminal.

#### Scenario: Conflict occurs in batch babc4b83475400c53b2f46d7

- **WHEN** Primary and Challenger conclusions differ for a member
- **THEN** Third SHALL record the terminal conclusion and rationale in the receipt

#### Scenario: Batch babc4b83475400c53b2f46d7 has no conflict

- **WHEN** Primary and required Challenger independently agree on all 118 ordered members and no conflict is present
- **THEN** the receipt SHALL preserve each stage's independent source binding, rationale, evidence selectors, canonical decision digests, and document digest, with no Third stage
- **AND** every member SHALL remain a role-free `DEFER` with insufficient evidence and review-stage terminal state `DEFERRED_EVIDENCE_BLOCKED`; CourseCoverage authority SHALL remain unresolved and the aggregate Coverage gate SHALL remain blocked

### Requirement: Batch babc4b83475400c53b2f46d7 emits a machine-mergeable receipt

The decision receipt MUST be keyed by every batch binding digest, preserve exact ordered member references, bind the Primary and Challenger raw source artifacts and normalized stage documents through `review-provenance.json`, and prove that no out-of-slice member or production authority was written. The Primary writer session MUST be `50b93f16-c3e7-4a45-b9d2-d9b9d65df0f2`; the Challenger writer session MUST be `221b9aa4-9a64-4698-9dd9-38b09e6f4332`, and provenance MUST state that Challenger did not read Primary. The current publication boundary MUST use the v3 proof and v2 detached-attestation schemas and preserve ordered protected-path digests for squash-safe content-equivalent replay.

#### Scenario: Receipt for batch babc4b83475400c53b2f46d7 is assembled

- **WHEN** all required stages are terminal and drift checks pass
- **THEN** the receipt SHALL be deterministic, machine-mergeable, and scoped to `babc4b83475400c53b2f46d7`, with `receiptDigest` `a6736d12049c2132a2d22fce2d7619e533200fec561e56eaf2809ae87d04cc6a` and detached `attestationDigest` `5888a709321f639dd5473f8ddc9c40b3df1851d015d0ae9387daa471e0ee28e7`
- **AND** replay SHALL accept a squash/content-equivalent continuation when protected-path bytes and clean status match the persisted ordered rows, without requiring capture-commit ancestry or deriving any semantic conclusion

### Requirement: Batch 99ffc86682c95d2c087c8754 has an immutable review boundary

The review child MUST process only the exact ordered members at `batch-manifest.json#/batches/15/members`, binding batchId `99ffc86682c95d2c087c8754`, sequence `0`, semanticGroupKey `ctr:release:stability-analysis-engineering-v0.1::entityType:KnowledgeStatement`, member count `174`, memberDigest `52fec2d28fa1a6934510c46427e9edd6196b21e0dee0cf193f7754f3bacc8e3b`, worklistInputDigest `55d9a896cccc5e55d0cb754187ccdc06ef8f6a845b5152f0c0106620039662c2`, worklistDigest `bd80f5e20ad0713dd4203e5336328b5c919d44b98a376d8b5d3cf6835a398489`, and manifestDigest `2f5fa8f4b9e1d7fa75c7d2be5f2629be792e0fb35907e678f8ff3a3fa2a6c818`.

#### Scenario: Frozen batch 99ffc86682c95d2c087c8754 is unchanged

- **WHEN** all bound fields and canonical revisions match the manifest slice
- **THEN** the child SHALL admit exactly that ordered member set and no other member

#### Scenario: Batch 99ffc86682c95d2c087c8754 drifts

- **WHEN** any member, order, digest, or revision differs
- **THEN** review and receipt assembly SHALL fail closed without changing production selector or writer fence

### Requirement: Batch 99ffc86682c95d2c087c8754 produces independent terminal decisions

Primary and Challenger MUST issue independent conclusions; Challenger MUST run for profileOnly, new, changed, or highRisk members. Every conflict MUST enter Third, and Third MUST be terminal.

#### Scenario: Conflict occurs in batch 99ffc86682c95d2c087c8754

- **WHEN** Primary and Challenger conclusions differ for a member
- **THEN** Third SHALL record the terminal conclusion and rationale in the receipt

#### Scenario: Batch 99ffc86682c95d2c087c8754 has no conflict

- **WHEN** required stages agree and every member has a review-stage terminal conclusion
- **THEN** the receipt SHALL preserve each stage's independent rationale and review-stage terminal conclusion
- **AND** any `DEFER` conclusion SHALL remain role-free, leave CourseCoverage authority unresolved, and produce `DEFERRED_EVIDENCE_BLOCKED` with the aggregate coverage gate blocked

### Requirement: Batch 99ffc86682c95d2c087c8754 emits a machine-mergeable receipt

The decision receipt MUST be keyed by every batch binding digest, preserve exact ordered member references, bind the independent Primary/Challenger stage-source artifacts through each normalized stage document and provenance record, and prove that no out-of-slice member or production authority was written. Its v3 production-boundary proof and v2 detached attestation MUST preserve ordered protected-path digests for squash-safe identical replay.

#### Scenario: Receipt for batch 99ffc86682c95d2c087c8754 is assembled

- **WHEN** all required stages are terminal and drift checks pass
- **THEN** the receipt SHALL be deterministic, machine-mergeable, and scoped to `99ffc86682c95d2c087c8754`
