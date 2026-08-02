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

### Requirement: Batch 3c6973d82b44357efc73f2f8 has an immutable review boundary

The review child MUST process only the exact ordered members at `batch-manifest.json#/batches/10/members`, binding batchId `3c6973d82b44357efc73f2f8`, sequence `0`, semanticGroupKey `ctr:release:frequency-domain-analysis-engineering-v0.1::entityType:Formula`, member count `232`, memberDigest `321f283c747e5068c1de2dcb0e69939afe0991c6154dc3d8db3e9f853f0455c8`, worklistInputDigest `55d9a896cccc5e55d0cb754187ccdc06ef8f6a845b5152f0c0106620039662c2`, worklistDigest `bd80f5e20ad0713dd4203e5336328b5c919d44b98a376d8b5d3cf6835a398489`, manifestDigest `2f5fa8f4b9e1d7fa75c7d2be5f2629be792e0fb35907e678f8ff3a3fa2a6c818`, and raw manifest artifact SHA-256 `786a305f3c6de217c6cc561a4e5200517615a651e346bf4bff73c9bdb54593e8`.

#### Scenario: Frozen batch 3c6973d82b44357efc73f2f8 is unchanged

- **WHEN** all bound fields and canonical revisions match the manifest slice
- **THEN** the child SHALL admit exactly that ordered member set and no other member

#### Scenario: Batch 3c6973d82b44357efc73f2f8 drifts

- **WHEN** any member, order, digest, or revision differs
- **THEN** review and receipt assembly SHALL fail closed without changing production selector or writer fence

### Requirement: Batch 3c6973d82b44357efc73f2f8 produces independent terminal decisions

Primary and Challenger MUST issue independent conclusions; Challenger MUST run for profileOnly, new, changed, or highRisk members. Every conflict MUST enter Third, and Third MUST be terminal.

#### Scenario: Conflict occurs in batch 3c6973d82b44357efc73f2f8

- **WHEN** Primary and Challenger conclusions differ for a member
- **THEN** Third SHALL record the terminal conclusion and rationale in the receipt

#### Scenario: Batch 3c6973d82b44357efc73f2f8 has no conflict

- **WHEN** Primary and required Challenger independently agree on all 232 ordered members and no conflict is present
- **THEN** the receipt SHALL preserve each stage's independent source binding, rationale, evidence selectors, canonical decision digests, and document digest, with no Third stage
- **AND** every member SHALL remain a role-free `DEFER` with insufficient evidence and review-stage terminal state `DEFERRED_EVIDENCE_BLOCKED`; CourseCoverage authority SHALL remain unresolved and the global gate SHALL remain blocked

### Requirement: Batch 3c6973d82b44357efc73f2f8 emits a machine-mergeable receipt

The decision receipt MUST be keyed by every batch binding digest, preserve exact ordered member references, and bind the Primary and Challenger raw source artifacts and normalized stage documents through `review-provenance.json`. The receipt MUST seal the provenance repository-relative path, raw-byte SHA-256, distinct stage sessions/scopes, source/document bindings, and Challenger non-read audit into `reviewProvenanceBinding`; any receipt with that binding MUST use the current v3 proof and v2 detached-attestation pair, and replay MUST fail closed if the provenance or binding is absent or any binding or audit field drifts. Any historical receipt without provenance binding, whether v2/v1 or v3/v2, MUST require an exact match of the tracked receipt path and digest plus detached-attestation path and digest; compatibility is limited to the eighteen tracked pairs from Issues 1190–1199, 1201–1203, 1205, 1207, 1213, 1214, and 1218. Field absence, batch identity, self-reported protocol version, or a recomputed digest MUST NOT grant compatibility. The Primary writer session MUST be `42eca660-ca20-49d4-b9df-93d9651ad3f2`; the Challenger writer session MUST be `37cc1c54-54d1-4cc0-a174-c440ed0294fe`, and the bound provenance SHA-256 MUST be `eee0d6dcbccab41287492f2feb7348a0419b62478d0be0565c509a9e97122a18`. Provenance MUST state and audit that Challenger did not read Primary. The receipt MUST also prove that no out-of-slice member or production authority was written. The current publication boundary MUST use the v3 proof and v2 detached-attestation schemas and preserve ordered protected-path digests for squash-safe content-equivalent replay.

#### Scenario: Receipt for batch 3c6973d82b44357efc73f2f8 is assembled

- **WHEN** all required stages are terminal and drift checks pass
- **THEN** the receipt SHALL be deterministic, machine-mergeable, and scoped to `3c6973d82b44357efc73f2f8`, with `receiptDigest` `2309285ee5acef97d6076135c8d9da29fbd642d1053e314b8f867e737a83c347` and detached `attestationDigest` `1fdf6b0398f01aa590f01e83cb48d834191d8ba9958fad77b603dc0b6a8c5d83`
- **AND** replay SHALL accept an identical squash/content-equivalent continuation when protected-path bytes and clean status match the persisted ordered rows, without requiring capture-commit ancestry or deriving any semantic conclusion

### Requirement: Batch 0bc82e9dcca813c8a75f11bd has an immutable review boundary

The review child MUST process only the exact ordered members at `batch-manifest.json#/batches/8/members`, binding batchId `0bc82e9dcca813c8a75f11bd`, sequence `0`, semanticGroupKey `ctr:release:discrete-time-control-analysis-engineering-v0.1::entityType:SystemModel`, member count `4`, memberDigest `463c5396f60d309f07ce3405d690e70e00b3ce70dbdbef5f8ce3bcad67b933ec`, worklistInputDigest `55d9a896cccc5e55d0cb754187ccdc06ef8f6a845b5152f0c0106620039662c2`, worklistDigest `bd80f5e20ad0713dd4203e5336328b5c919d44b98a376d8b5d3cf6835a398489`, manifestDigest `2f5fa8f4b9e1d7fa75c7d2be5f2629be792e0fb35907e678f8ff3a3fa2a6c818`, and raw manifest artifact SHA-256 `786a305f3c6de217c6cc561a4e5200517615a651e346bf4bff73c9bdb54593e8`.

#### Scenario: Frozen batch 0bc82e9dcca813c8a75f11bd is unchanged

- **WHEN** all bound fields and canonical revisions match the manifest slice
- **THEN** the child SHALL admit exactly that ordered member set and no other member

#### Scenario: Batch 0bc82e9dcca813c8a75f11bd drifts

- **WHEN** any member, order, digest, or revision differs
- **THEN** review and receipt assembly SHALL fail closed without changing production selector or writer fence

### Requirement: Batch 0bc82e9dcca813c8a75f11bd produces independent terminal decisions

Primary and Challenger MUST issue independent conclusions; Challenger MUST run for profileOnly, new, changed, or highRisk members. Every conflict MUST enter Third, and Third MUST be terminal.

#### Scenario: Conflict occurs in batch 0bc82e9dcca813c8a75f11bd

- **WHEN** Primary and Challenger conclusions differ for a member
- **THEN** Third SHALL record the terminal conclusion and rationale in the receipt

#### Scenario: Batch 0bc82e9dcca813c8a75f11bd has no conflict

- **WHEN** Primary and required Challenger independently agree on all 4 ordered members and no conflict is present
- **THEN** the receipt SHALL preserve each stage's independent source binding, rationale, evidence selectors, canonical decision digests, and document digest, with no Third stage
- **AND** every member SHALL remain a role-free `DEFER` with insufficient evidence and review-stage terminal state `DEFERRED_EVIDENCE_BLOCKED`; CourseCoverage authority SHALL remain unresolved and the aggregate Coverage gate SHALL remain blocked

### Requirement: Batch 0bc82e9dcca813c8a75f11bd emits a machine-mergeable receipt

The decision receipt MUST be keyed by every batch binding digest, preserve exact ordered member references, bind the Primary and Challenger raw source artifacts and normalized stage documents through `review-provenance.json`, and prove that no out-of-slice member or production authority was written. The Primary writer session MUST be `f03d0a8b-dec9-4c1f-b000-f7ae8c070810`; the Challenger writer session MUST be `e2ca2013-0c13-49a9-b33a-8f6ed92521eb`, and provenance MUST state that Challenger did not read Primary. The publication boundary MUST use the v3 proof and v2 detached-attestation schemas and preserve ordered protected-path digests for squash-safe content-equivalent replay.

#### Scenario: Receipt for batch 0bc82e9dcca813c8a75f11bd is assembled

- **WHEN** all required stages are terminal and drift checks pass
- **THEN** the receipt SHALL be deterministic, machine-mergeable, and scoped to `0bc82e9dcca813c8a75f11bd`, with first-publication `receiptDigest` `f86165449d3216c5d4b4ad5360b7383adeb7e7042fb526e101980251095b58e5` and detached `attestationDigest` `5b3d39dbecf1e39470219c43225ea572846b8b6b5d2186a1db39ed54a63ee0f5`
- **AND** the v3 proof/v2 detached attestation SHALL support squash/content-equivalent replay when protected-path bytes and clean status match the persisted ordered rows, without requiring capture-commit ancestry or deriving any semantic conclusion

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

### Requirement: Batch 6826bdc48609e08a6af5efcb has an immutable review boundary

The review child MUST process only the exact ordered members at `batch-manifest.json#/batches/12/members`, binding batchId `6826bdc48609e08a6af5efcb`, sequence `0`, semanticGroupKey `ctr:release:frequency-domain-analysis-engineering-v0.1::entityType:SystemModel`, member count `10`, memberDigest `5068327c96f60c3e017a6634e032a6727b2879c376f33ada8abc34ada005e41f`, worklistInputDigest `55d9a896cccc5e55d0cb754187ccdc06ef8f6a845b5152f0c0106620039662c2`, worklistDigest `bd80f5e20ad0713dd4203e5336328b5c919d44b98a376d8b5d3cf6835a398489`, and manifestDigest `2f5fa8f4b9e1d7fa75c7d2be5f2629be792e0fb35907e678f8ff3a3fa2a6c818`.

#### Scenario: Frozen batch 6826bdc48609e08a6af5efcb is unchanged

- **WHEN** all bound fields and canonical revisions match the manifest slice
- **THEN** the child SHALL admit exactly that ordered member set and no other member

#### Scenario: Batch 6826bdc48609e08a6af5efcb drifts

- **WHEN** any member, order, digest, or revision differs
- **THEN** review and receipt assembly SHALL fail closed without changing production selector or writer fence

### Requirement: Batch 6826bdc48609e08a6af5efcb produces independent terminal decisions

Primary and Challenger MUST issue independent conclusions; Challenger MUST run for profileOnly, new, changed, or highRisk members. Every conflict MUST enter Third, and Third MUST be terminal.

#### Scenario: Conflict occurs in batch 6826bdc48609e08a6af5efcb

- **WHEN** Primary and Challenger conclusions differ for a member
- **THEN** Third SHALL record the terminal conclusion and rationale in the receipt

#### Scenario: Batch 6826bdc48609e08a6af5efcb has no conflict

- **WHEN** required stages agree and all members are resolved
- **THEN** the receipt SHALL preserve each stage's independent rationale and terminal outcome

### Requirement: Batch 6826bdc48609e08a6af5efcb emits a machine-mergeable receipt

The decision receipt MUST be keyed by every batch binding digest, preserve exact ordered member references, bind the Primary and Challenger raw source artifacts and normalized stage documents through `review-provenance.json`, and prove that no out-of-slice member or production authority was written. The Primary writer session MUST be `be3478ca-c446-46e6-b802-8faeb9079a93`; the Challenger writer session MUST be `72b3fcd8-acb6-49a9-a30f-3bd0147e5ba9`, and provenance MUST state that Challenger did not read Primary. Provenance MUST retain `reFreezeRequired=true` for semantically adjacent course materials that were not present in frozen `evidenceRefs`. The publication boundary MUST use the v3 proof and v2 detached-attestation schemas and preserve ordered protected-path digests for squash-safe content-equivalent replay.

#### Scenario: Receipt for batch 6826bdc48609e08a6af5efcb is assembled

- **WHEN** all required stages are terminal and drift checks pass
- **THEN** the receipt SHALL be deterministic, machine-mergeable, and scoped to `6826bdc48609e08a6af5efcb`, with first-publication `receiptDigest` `1df6f45facd6a452f00ac2c7616f69750434ffa37630574c5736dd7ceb1067bc` and detached `attestationDigest` `c71e8312beef5626a25cf3934f587b4a7103790998828171d55b0a4b339af253`
- **AND** the receipt SHALL record 10 role-free `DEFER`, 0 `INCLUDE`, 0 `EXCLUDE`, 0 conflicts, no Third review, `DEFERRED_EVIDENCE_BLOCKED`, and `aggregateCoverageGate=BLOCKED_UNRESOLVED_EVIDENCE`, with all production mutation flags false
- **AND** the v3 proof/v2 detached attestation SHALL support squash/content-equivalent replay when protected-path bytes and clean status match the persisted ordered rows, without resolving global CourseCoverage authority or unblocking the aggregate gate

### Requirement: Batch f8917af6bf755caf058c5358 has an immutable review boundary

The review child MUST process only the exact ordered members at `batch-manifest.json#/batches/17/members`, binding batchId `f8917af6bf755caf058c5358`, sequence `0`, semanticGroupKey `ctr:release:stability-analysis-engineering-v0.1|ctr:release:system-modeling-engineering-v0.1::entityType:Formula`, member count `1`, memberDigest `7e993c72b856c79dd49c277dc2afcb45621f157666eaf1a582b246bfe77a2270`, worklistInputDigest `55d9a896cccc5e55d0cb754187ccdc06ef8f6a845b5152f0c0106620039662c2`, worklistDigest `bd80f5e20ad0713dd4203e5336328b5c919d44b98a376d8b5d3cf6835a398489`, manifestDigest `2f5fa8f4b9e1d7fa75c7d2be5f2629be792e0fb35907e678f8ff3a3fa2a6c818`, and raw manifest artifact SHA-256 `786a305f3c6de217c6cc561a4e5200517615a651e346bf4bff73c9bdb54593e8`.

#### Scenario: Frozen batch f8917af6bf755caf058c5358 is unchanged

- **WHEN** all bound fields and canonical revisions match the manifest slice
- **THEN** the child SHALL admit exactly that ordered member set and no other member

#### Scenario: Batch f8917af6bf755caf058c5358 drifts

- **WHEN** any member, order, digest, or revision differs
- **THEN** review and receipt assembly SHALL fail closed without changing production selector or writer fence

### Requirement: Batch f8917af6bf755caf058c5358 produces independent terminal decisions

Primary and Challenger MUST issue independent conclusions; Challenger MUST run for this profileOnly/highRisk member. The Primary source MUST be bound to session `015411ef-a0ce-4741-9adc-8f17062aac32` and SHA-256 `cb7838d76ac97c1cff8e513507173051e6e83fda8e8bf252c5d79fde7709ff8b`; the Challenger source MUST be bound to session `68f51aff-e853-48f2-9848-d99a27c3e6ae` and SHA-256 `c2df655e0644997d1464c85a72ec44ecfca5af76a69f14696ec8799e14669340`. Every conflict MUST enter Third, and Third MUST be terminal.

#### Scenario: Conflict occurs in batch f8917af6bf755caf058c5358

- **WHEN** Primary and Challenger conclusions differ for the member
- **THEN** Third SHALL record the terminal conclusion and rationale in the receipt

#### Scenario: Historical prior decision does not provide current authority

- **WHEN** the member has one `priorDecisionRef` into aggregate active history but no independent-course evidence
- **THEN** Primary and Challenger SHALL preserve that reference as provenance only, keep the conclusion role-free `DEFER` with `INSUFFICIENT` evidence, and SHALL NOT inherit its historical role or verdict

#### Scenario: Semantically equivalent authoring candidates are not frozen admissions

- **WHEN** `course-content/authoring/lessons/3-1/design/3-1-handout.md` around lines 331-340 and `course-content/authoring/lessons/3-1/design/3-1-interactive-page.md` around line 449 express semantically equivalent causal LTI convolution forms but are absent from the frozen `#1180` worklist/manifest `evidenceRefs`
- **THEN** those candidates SHALL remain diagnostic only; this frozen review SHALL keep the role-free `DEFER` with `INSUFFICIENT` evidence, and upstream `#1180` MUST bind/classify the candidates as independent-course evidence and regenerate the frozen worklist/manifest before any `INCLUDE`/`EXCLUDE` re-review

#### Scenario: DEFER is review-stage terminal only

- **WHEN** Primary and Challenger independently agree on `DEFER` without a semantic conflict
- **THEN** the receipt SHALL use `DEFERRED_EVIDENCE_BLOCKED`, leave CourseCoverage authority unresolved, keep the aggregate gate `BLOCKED_UNRESOLVED_EVIDENCE`, and SHALL NOT write `ACTIVE`, authority, selector, or writer state

### Requirement: Batch f8917af6bf755caf058c5358 emits a machine-mergeable receipt

The decision receipt MUST be keyed by every batch binding digest, preserve the exact ordered member reference, bind both raw stage-source artifacts through normalized documents and `review-provenance.json`, and prove that no out-of-slice member or production authority was written. The publication boundary MUST use the v3 proof and v2 detached-attestation schemas with identical content-equivalent replay.

#### Scenario: Receipt for batch f8917af6bf755caf058c5358 is assembled

- **WHEN** all required stages are terminal and drift checks pass
- **THEN** the receipt SHALL be deterministic, machine-mergeable, and scoped to `f8917af6bf755caf058c5358`, with `receiptDigest` `a84fb2a44cbf963b807b037fe9ce3822db193658b370c184eb44ffd5145dbf60` and detached `attestationDigest` `00a905992060e60289bc06b3c5a6331a102ae2998eca66d17f8e84873125d211`
- **AND** replay SHALL accept a squash/content-equivalent continuation when protected-path bytes and clean status match the persisted ordered rows, without requiring capture-commit ancestry or deriving any semantic conclusion

### Requirement: Batch cf97812d622e09bc01b290e7 has an immutable review boundary

The review child MUST process only the exact ordered members at `batch-manifest.json#/batches/19/members`, binding batchId `cf97812d622e09bc01b290e7`, sequence `0`, semanticGroupKey `ctr:release:state-space-control-analysis-and-design-engineering-v0.1::entityType:Formula`, member count `299`, memberDigest `51b1aa828c6d4f8946f51964393253127c6a979167b6fc6b43e831dd1cb24a49`, worklistInputDigest `55d9a896cccc5e55d0cb754187ccdc06ef8f6a845b5152f0c0106620039662c2`, worklistDigest `bd80f5e20ad0713dd4203e5336328b5c919d44b98a376d8b5d3cf6835a398489`, manifestDigest `2f5fa8f4b9e1d7fa75c7d2be5f2629be792e0fb35907e678f8ff3a3fa2a6c818`, and raw manifest artifact SHA-256 `786a305f3c6de217c6cc561a4e5200517615a651e346bf4bff73c9bdb54593e8`.

#### Scenario: Frozen batch cf97812d622e09bc01b290e7 is unchanged

- **WHEN** all bound fields and canonical revisions match the manifest slice
- **THEN** the child SHALL admit exactly that ordered member set and no other member

#### Scenario: Batch cf97812d622e09bc01b290e7 drifts

- **WHEN** any member, order, digest, or revision differs
- **THEN** review and receipt assembly SHALL fail closed without changing production selector or writer fence

### Requirement: Batch cf97812d622e09bc01b290e7 produces independent terminal decisions

Primary and Challenger MUST issue independent conclusions for all 299 `profileOnly=true` and `riskFlags.highRisk=true` Formula members. The Primary raw source MUST be preserved byte-for-byte at `course-content/authoring/knowledge/issue-1209-course-coverage-review/primary-independent-stage-source.json` and bound to session `1d8f2d19-41db-4479-a854-d7284f16fbe0` with SHA-256 `ae90d30f43316821c7f8a8d57a3f8b8e63f807a5d104fe4fd0bd23e461463f1a`; the Challenger raw source MUST be preserved byte-for-byte at `course-content/authoring/knowledge/issue-1209-course-coverage-review/challenger-independent-stage-source.json` and bound to session `ac434809-5488-46f9-a5ee-810a159ea56b` with SHA-256 `f7f7257d2cee95cd904530cda5fd055019d17602d3736453afdaeaf9a16d5a8d`. Each normalized stage document MUST bind its raw source path, SHA-256, schema, stage, and writer session through `review-provenance.json`. Published artifacts MUST use logical repository-relative identifiers only and MUST NOT contain machine-local absolute paths. Every conflict MUST enter Third, and Third MUST be terminal.

#### Scenario: Batch cf97812d622e09bc01b290e7 has no conflict

- **WHEN** Primary and required Challenger independently agree on all 299 ordered members
- **THEN** the receipt SHALL preserve both independent rationales, evidence selectors, stage decision digests, and document digests with no Third stage; all 299 terminal members SHALL remain role-free `DEFER` with `INSUFFICIENT` evidence
- **AND** the review stage SHALL be `DEFERRED_EVIDENCE_BLOCKED`, CourseCoverage authority SHALL remain unresolved, and the aggregate gate SHALL remain `BLOCKED_UNRESOLVED_EVIDENCE`

#### Scenario: Frozen evidence is aggregate/profile only

- **WHEN** every frozen evidence reference for the batch is bounded to `aggregate` or `profile` and no member has admitted `independent-course` evidence
- **THEN** neither stage SHALL issue `INCLUDE` or `EXCLUDE`, and no historical or semantic candidate observation SHALL supply a role or current authority

#### Scenario: Unfrozen semantic candidates are diagnostic only

- **WHEN** Primary or Challenger observes semantically related course-authoring material outside the frozen `evidenceRefs`
- **THEN** the observation SHALL remain diagnostic only; upstream issue `#1180` MUST bind and classify accepted candidates as `independent-course` evidence and regenerate the frozen worklist/manifest before any later `INCLUDE`/`EXCLUDE` re-review

#### Scenario: DEFER is review-stage terminal only

- **WHEN** Primary and Challenger independently agree on role-free `DEFER` with insufficient evidence
- **THEN** the receipt SHALL use `DEFERRED_EVIDENCE_BLOCKED`, set `thirdRequired=false`, preserve zero conflicts and zero Third reviews, leave CourseCoverage authority unresolved, keep the aggregate gate `BLOCKED_UNRESOLVED_EVIDENCE`, and SHALL NOT write `ACTIVE`, authority, selector, or writer state

### Requirement: Batch cf97812d622e09bc01b290e7 emits a machine-mergeable receipt

The decision receipt MUST be keyed by every batch binding digest, preserve the exact ordered member references, bind both raw stage-source artifacts through normalized documents and `review-provenance.json`, and prove that no out-of-slice member or production authority was written. The first publication MUST use the v3 production-boundary proof and v2 detached-attestation schemas, with receiptDigest `60f50866a13a99d376dd9d12d78bb0beaa567937c635607f7290de2345891475` and attestationDigest `8996100cd78f4426abf1bfa3dfc4b1c1b4ed8a57bfe447b78da60e7a890dbfff`.

#### Scenario: Receipt for batch cf97812d622e09bc01b290e7 is assembled

- **WHEN** all required stages are terminal and drift checks pass
- **THEN** the receipt SHALL be deterministic, machine-mergeable, and scoped to `cf97812d622e09bc01b290e7`
- **AND** a second CLI replay SHALL report identical receipt and attestation bytes with `replayMode=content-equivalent` when protected-path bytes and clean status match the persisted ordered rows

### Requirement: Batch bbd99e29d4339410c06d0528 has an immutable review boundary

The review child MUST process only the exact ordered members at `batch-manifest.json#/batches/16/members`, binding batchId `bbd99e29d4339410c06d0528`, sequence `0`, semanticGroupKey `ctr:release:stability-analysis-engineering-v0.1::entityType:SystemModel`, member count `1`, memberDigest `bbf983851280ba71a7ae3ffd4dd5e3923bb68a2b5fad50031ffad0bc54662417`, worklistInputDigest `55d9a896cccc5e55d0cb754187ccdc06ef8f6a845b5152f0c0106620039662c2`, worklistDigest `bd80f5e20ad0713dd4203e5336328b5c919d44b98a376d8b5d3cf6835a398489`, and manifestDigest `2f5fa8f4b9e1d7fa75c7d2be5f2629be792e0fb35907e678f8ff3a3fa2a6c818`.

#### Scenario: Frozen batch bbd99e29d4339410c06d0528 is unchanged

- **WHEN** all bound fields and canonical revisions match the manifest slice
- **THEN** the child SHALL admit exactly that ordered member set and no other member

#### Scenario: Batch bbd99e29d4339410c06d0528 drifts

- **WHEN** any member, order, digest, or revision differs
- **THEN** review and receipt assembly SHALL fail closed without changing production selector or writer fence

### Requirement: Batch bbd99e29d4339410c06d0528 produces independent terminal decisions

Primary and Challenger MUST issue independent conclusions; Challenger MUST run for profileOnly, new, changed, or highRisk members. Every conflict MUST enter Third, and Third MUST be terminal.

#### Scenario: Conflict occurs in batch bbd99e29d4339410c06d0528

- **WHEN** Primary and Challenger conclusions differ for a member
- **THEN** Third SHALL record the terminal conclusion and rationale in the receipt

#### Scenario: Batch bbd99e29d4339410c06d0528 has no conflict

- **WHEN** required stages agree and all members are resolved
- **THEN** the receipt SHALL preserve each stage's independent rationale and terminal outcome

### Requirement: Batch bbd99e29d4339410c06d0528 emits a machine-mergeable receipt

The decision receipt MUST be keyed by every batch binding digest, preserve exact ordered member references, and prove that no out-of-slice member or production authority was written.

#### Scenario: Receipt for batch bbd99e29d4339410c06d0528 is assembled

- **WHEN** all required stages are terminal and drift checks pass
- **THEN** the receipt SHALL be deterministic, machine-mergeable, and scoped to `bbd99e29d4339410c06d0528`

The recorded Primary and Challenger raw sources are bound by SHA-256 to Grok sessions `991b94cc-94d8-435e-b99a-4eceec7280c2` and `7aa9a3b2-4780-435f-817f-cdc585543b53`; provenance states that Challenger did not read Primary. Both sessions preserve `0 INCLUDE / 0 EXCLUDE / 1 DEFER`, `evidenceSufficiency=INSUFFICIENT`, `role=null`, and `reFreezeRequired=true`. Their diagnostic course candidates remain non-authoritative and are not copied into frozen `evidenceSelectors`.

The receipt is `DEFERRED_EVIDENCE_BLOCKED` with one deferred member, zero conflicts, no Third stage, and all production mutation flags false. Its stage records retain `reFreezeRequired=true`; the detached boundary attestation retains the same marker and uses the v2 schema/protocol paired with the v3 proof. Ordered protected-path snapshots are byte-stable, and replay with the same relative inputs returns `publication=identical`, `attestationPublication=identical`, and `replayMode=content-equivalent`. No ACTIVE decision, production selector, or writer fence is written.

### Requirement: Batch c5f6b20a3a7cf9408e153b08 has an immutable review boundary

The review child MUST process only the exact ordered members at `batch-manifest.json#/batches/20/members`, binding batchId `c5f6b20a3a7cf9408e153b08`, sequence `0`, semanticGroupKey `ctr:release:state-space-control-analysis-and-design-engineering-v0.1::entityType:KnowledgeStatement`, member count `500`, memberDigest `81fedba91c18ba7fbb40e3575e96445135485bfbd6af9c1c8fc5bd82bfba5f49`, worklistInputDigest `55d9a896cccc5e55d0cb754187ccdc06ef8f6a845b5152f0c0106620039662c2`, worklistDigest `bd80f5e20ad0713dd4203e5336328b5c919d44b98a376d8b5d3cf6835a398489`, manifestDigest `2f5fa8f4b9e1d7fa75c7d2be5f2629be792e0fb35907e678f8ff3a3fa2a6c818`, and manifestArtifactSha256 `786a305f3c6de217c6cc561a4e5200517615a651e346bf4bff73c9bdb54593e8`.

#### Scenario: Frozen batch c5f6b20a3a7cf9408e153b08 is unchanged

- **WHEN** all bound fields and canonical revisions match the manifest slice
- **THEN** the child SHALL admit exactly that ordered member set and no other member
- **AND** the normalized Primary and Challenger documents SHALL preserve all 500 ordered canonical IDs/revisions and the frozen evidence selectors without changing the raw stage conclusions

#### Scenario: Batch c5f6b20a3a7cf9408e153b08 drifts

- **WHEN** any member, order, digest, or revision differs
- **THEN** review and receipt assembly SHALL fail closed without changing production selector or writer fence
- **AND** all public artifact paths and `commandsRun` entries SHALL remain repository-relative

### Requirement: Batch c5f6b20a3a7cf9408e153b08 produces independent terminal decisions

Primary and Challenger MUST issue independent conclusions; Challenger MUST run for profileOnly, new, changed, or highRisk members. Every conflict MUST enter Third, and Third MUST be terminal. For this batch, Primary session `9abcc13d-1c7e-4e95-9664-9a9996876d16` and Challenger session `7dc9f9ac-f9ac-4192-887e-393b9f555c7d` MUST remain independently bound to their raw stage sources. Both normalized stages MUST record 500 `DEFER` conclusions because the frozen evidence boundary has 729 aggregate refs, 500 profile refs, and zero independent-course members; diagnostic course candidates MUST remain non-authoritative with `reFreezeRequired=true`.

#### Scenario: Conflict occurs in batch c5f6b20a3a7cf9408e153b08

- **WHEN** Primary and Challenger conclusions differ for a member
- **THEN** Third SHALL record the terminal conclusion and rationale in the receipt

#### Scenario: Batch c5f6b20a3a7cf9408e153b08 has no conflict

- **WHEN** required stages agree and all members are resolved
- **THEN** the receipt SHALL preserve each stage's independent rationale and terminal outcome
- **AND** the receipt SHALL report zero conflicts, zero Third reviews, zero INCLUDE/EXCLUDE, and 500 deferred evidence-blocked members

### Requirement: Batch c5f6b20a3a7cf9408e153b08 emits a machine-mergeable receipt

The decision receipt MUST be keyed by every batch binding digest, preserve exact ordered member references, and prove that no out-of-slice member or production authority was written. The first publication MUST use the v3 ordered protected-path production-boundary proof and detached v2 attestation, with receiptDigest `eaf06a0180e0d4b8acd4e35283a3d7baa546cef318a99855c03260a5beb12c65` and attestationDigest `a5fe78541257603d477145aa7fe89056ad2f38c884d15b8ad2a0cd7052944066`. No selector, writer fence, ACTIVE decision, or Third artifact may be written.

#### Scenario: Receipt for batch c5f6b20a3a7cf9408e153b08 is assembled

- **WHEN** all required stages are terminal and drift checks pass
- **THEN** the receipt SHALL be deterministic, machine-mergeable, and scoped to `c5f6b20a3a7cf9408e153b08`

#### Scenario: Content-equivalent replay of the published pair

- **WHEN** the shared batch-review CLI is invoked a second time with the same repository-relative worklist, manifest, normalized stage inputs, expected binding, and output path
- **THEN** it SHALL return `publication=identical`, `attestationPublication=identical`, and `replayMode=content-equivalent`, preserving the same receipt and attestation digests

### Requirement: Batch beffdbc7a6d3d2c54714760b has an immutable review boundary

The review child MUST process only the exact ordered members at `batch-manifest.json#/batches/21/members`, binding batchId `beffdbc7a6d3d2c54714760b`, sequence `1`, semanticGroupKey `ctr:release:state-space-control-analysis-and-design-engineering-v0.1::entityType:KnowledgeStatement`, member count `284`, memberDigest `b36ed7c808c9e08302bdb20ade5a7a22520ee5983fe61ea2a7ff8813c62305a6`, worklistInputDigest `55d9a896cccc5e55d0cb754187ccdc06ef8f6a845b5152f0c0106620039662c2`, worklistDigest `bd80f5e20ad0713dd4203e5336328b5c919d44b98a376d8b5d3cf6835a398489`, manifestDigest `2f5fa8f4b9e1d7fa75c7d2be5f2629be792e0fb35907e678f8ff3a3fa2a6c818`, and raw manifest artifact SHA-256 `786a305f3c6de217c6cc561a4e5200517615a651e346bf4bff73c9bdb54593e8`.

#### Scenario: Frozen batch beffdbc7a6d3d2c54714760b is unchanged

- **WHEN** all bound fields and canonical revisions match the manifest slice
- **THEN** the child SHALL admit exactly that ordered member set and no other member

#### Scenario: Batch beffdbc7a6d3d2c54714760b drifts

- **WHEN** any member, order, digest, or revision differs
- **THEN** review and receipt assembly SHALL fail closed without changing production selector or writer fence

### Requirement: Batch beffdbc7a6d3d2c54714760b produces independent terminal decisions

Primary and Challenger MUST issue independent conclusions for all 284 `profileOnly=true` and `riskFlags.highRisk=true` KnowledgeStatement members. The Primary raw source MUST be preserved byte-for-byte at `course-content/authoring/knowledge/issue-1211-course-coverage-review/primary-independent-stage-source.json` and bound to session `c9fc299b-f408-4b33-a927-6ee7d0e8c057` with SHA-256 `1849fe4c185d97b2173123108ec9494aba4e063580a60b7bddacbaa6f35d48bc`; the Challenger raw source MUST be preserved byte-for-byte at `course-content/authoring/knowledge/issue-1211-course-coverage-review/challenger-independent-stage-source.json` and bound to session `42e536dd-c725-4efd-857f-20b2f84a27da` with SHA-256 `bb23cbb5bb066d7ba0442207a7cb34ab25277f89d0e0347b7b7fd91fbcd41cc0`. Each normalized stage document MUST bind its raw source path, SHA-256, schema, stage, and writer session through `review-provenance.json`. Published artifacts MUST use logical repository-relative identifiers only and MUST NOT contain machine-local absolute paths. Every conflict MUST enter Third, and Third MUST be terminal.

#### Scenario: Batch beffdbc7a6d3d2c54714760b has no conflict

- **WHEN** Primary and required Challenger independently agree on all 284 ordered members
- **THEN** the receipt SHALL preserve both independent rationales, evidence selectors, stage decision digests, and document digests with no Third stage; all 284 terminal members SHALL remain role-free `DEFER` with `INSUFFICIENT` evidence
- **AND** the review stage SHALL be `DEFERRED_EVIDENCE_BLOCKED`, CourseCoverage authority SHALL remain unresolved, and the aggregate gate SHALL remain `BLOCKED_UNRESOLVED_EVIDENCE`

#### Scenario: Frozen evidence is aggregate/profile only

- **WHEN** every frozen evidence reference for the batch is bounded to `aggregate` or `profile` and no member has admitted `independent-course` evidence
- **THEN** neither stage SHALL issue `INCLUDE` or `EXCLUDE`, and no historical or semantic candidate observation SHALL supply a role or current authority

#### Scenario: Unfrozen semantic candidates are diagnostic only

- **WHEN** Primary or Challenger observes semantically related course-authoring material outside the frozen `evidenceRefs`
- **THEN** the observation SHALL remain diagnostic only; upstream issue `#1180` MUST bind and classify accepted candidates as `independent-course` evidence and regenerate the frozen worklist/manifest before any later `INCLUDE`/`EXCLUDE` re-review

#### Scenario: DEFER is review-stage terminal only

- **WHEN** Primary and Challenger independently agree on role-free `DEFER` with insufficient evidence
- **THEN** the receipt SHALL use `DEFERRED_EVIDENCE_BLOCKED`, set `thirdRequired=false`, preserve zero conflicts and zero Third reviews, leave CourseCoverage authority unresolved, keep the aggregate gate `BLOCKED_UNRESOLVED_EVIDENCE`, and SHALL NOT write `ACTIVE`, authority, selector, or writer state

### Requirement: Batch beffdbc7a6d3d2c54714760b emits a machine-mergeable receipt

The decision receipt MUST be keyed by every batch binding digest, preserve the exact ordered member references, bind both raw stage-source artifacts through normalized documents and `review-provenance.json`, and prove that no out-of-slice member or production authority was written. The first publication MUST use the v3 production-boundary proof and v2 detached-attestation schemas, with receiptDigest `46916d8eb30a8095442a7ff2926520fdef6494a396631ea69b4087ce26d62ba1` and attestationDigest `ec1ba67e9b5274ee23a662c3ee8059ae1133266ca6eca86c31069e85e8cde5a0`.

#### Scenario: Receipt for batch beffdbc7a6d3d2c54714760b is assembled

- **WHEN** all required stages are terminal and drift checks pass
- **THEN** the receipt SHALL be deterministic, machine-mergeable, and scoped to `beffdbc7a6d3d2c54714760b`
- **AND** a second CLI replay SHALL report identical receipt and attestation bytes with `replayMode=content-equivalent` when protected-path bytes and clean status match the persisted ordered rows

### Requirement: Batch f699aa47a9afaf3057d4bc0e has an immutable review boundary

The review child MUST process only the exact ordered members at `batch-manifest.json#/batches/23/members`, binding batchId `f699aa47a9afaf3057d4bc0e`, sequence `0`, semanticGroupKey `ctr:release:system-modeling-engineering-v0.1::entityType:DomainConcept`, member count `265`, memberDigest `e026fadcfcdfdd5798b11f76bf9e7e5eed23f548756457850e344909782fd852`, worklistInputDigest `55d9a896cccc5e55d0cb754187ccdc06ef8f6a845b5152f0c0106620039662c2`, worklistDigest `bd80f5e20ad0713dd4203e5336328b5c919d44b98a376d8b5d3cf6835a398489`, manifestDigest `2f5fa8f4b9e1d7fa75c7d2be5f2629be792e0fb35907e678f8ff3a3fa2a6c818`, and raw manifest artifact SHA-256 `786a305f3c6de217c6cc561a4e5200517615a651e346bf4bff73c9bdb54593e8`.

#### Scenario: Frozen batch f699aa47a9afaf3057d4bc0e is unchanged

- **WHEN** all bound fields and canonical revisions match the manifest slice
- **THEN** the child SHALL admit exactly that ordered member set and no other member

#### Scenario: Batch f699aa47a9afaf3057d4bc0e drifts

- **WHEN** any member, order, digest, or revision differs
- **THEN** review and receipt assembly SHALL fail closed without changing production selector or writer fence

### Requirement: Batch b354cb02317e7a7f534c0208 has an immutable review boundary

The review child MUST process only the exact ordered members at `batch-manifest.json#/batches/24/members`, binding batchId `b354cb02317e7a7f534c0208`, sequence `0`, semanticGroupKey `ctr:release:system-modeling-engineering-v0.1::entityType:Formula`, member count `204`, memberDigest `2f9178a55173b126c348544ebf05dac5b41553da630f95bc67366d0df618179e`, worklistInputDigest `55d9a896cccc5e55d0cb754187ccdc06ef8f6a845b5152f0c0106620039662c2`, worklistDigest `bd80f5e20ad0713dd4203e5336328b5c919d44b98a376d8b5d3cf6835a398489`, and manifestDigest `2f5fa8f4b9e1d7fa75c7d2be5f2629be792e0fb35907e678f8ff3a3fa2a6c818`.

#### Scenario: Frozen batch b354cb02317e7a7f534c0208 is unchanged

- **WHEN** all bound fields and canonical revisions match the manifest slice
- **THEN** the child SHALL admit exactly that ordered member set and no other member

#### Scenario: Batch b354cb02317e7a7f534c0208 drifts

- **WHEN** any member, order, digest, or revision differs
- **THEN** review and receipt assembly SHALL fail closed without changing production selector or writer fence

### Requirement: Batch f699aa47a9afaf3057d4bc0e produces independent terminal decisions

Primary MUST issue independent conclusions for all 265 ordered members. Challenger MUST issue independent conclusions for the 224 members whose frozen manifest risk surface has `profileOnly=true` or `riskFlags.highRisk=true`. The Primary raw source MUST be preserved byte-for-byte at `course-content/authoring/knowledge/issue-1213-course-coverage-review/primary-independent-stage-source.json` and bound to session `170364f7-6d6e-44d5-b936-96f8b6553af5` with SHA-256 `7fa6c344c126a3ab608e2ebd72f92dd2bca8a978d87b3aa075228be0b3d58ee1`; the Challenger raw source MUST be preserved byte-for-byte at `course-content/authoring/knowledge/issue-1213-course-coverage-review/challenger-independent-stage-source.json` and bound to session `4d714ca0-a746-4df4-939f-65a3a13dec78` with SHA-256 `36b9de0e261662e5c98d699d67c72756e33bf4c4398f9091be0de0857c3b0b54`. Each normalized stage document MUST use `current-course-coverage-stage-review/v2` and bind its raw source path, SHA-256, schema, stage, and writer session through `review-provenance.json`; `v1` remains accepted only for replay after an existing persisted receipt/attestation pair passes bundle assertion and the rebuilt receipt equals that verified receipt exactly. First publication, incomplete pairs, and invalid bundles MUST reject `v1`; newly assembled stage documents MUST use `v2`, with exact `evidenceIds` required whenever a v2 document contains repeated selectors. Primary's normalized digest is `c34537f9f429a7a9e2d2c9c8636f7b91d85afa0c172133c0e2a33f59e9cd33b7` and Challenger's is `47ed0e2ba256599dc85c0d4d351210598e50997dcc07ddec90d6e18c00389bc5`. Published artifacts MUST use logical repository-relative identifiers only and MUST NOT contain machine-local absolute paths. Every decision MUST preserve raw evidence-reference order as aligned `evidenceSelectors` and exact frozen `evidenceIds`; repeated selectors MUST be disambiguated by evidenceId, and selector-only ambiguity MUST NOT overwrite or collapse a distinct frozen reference. A conflict would require Third to be terminal; this batch has zero conflicts, so no Third source or normalized artifact is permitted.

#### Scenario: Batch f699aa47a9afaf3057d4bc0e has no conflict

- **WHEN** Primary and required Challenger independently agree on all 224 required members
- **THEN** the receipt SHALL preserve both independent rationales, evidence selectors, stage decision digests, and document digests with no Third stage; all 224 agreed terminal members SHALL remain role-free `DEFER` with `INSUFFICIENT` evidence
- **AND** the five non-risk Primary-only members SHALL preserve their valid `INCLUDE` roles and `SUFFICIENT` evidence
- **AND** the review stage SHALL be `DEFERRED_EVIDENCE_BLOCKED`, CourseCoverage authority SHALL remain unresolved, and the aggregate gate SHALL remain `BLOCKED_UNRESOLVED_EVIDENCE`

#### Scenario: Frozen evidence identity governs repeated selectors

- **WHEN** a member has repeated raw selectors or another selector is ambiguous in the frozen worklist
- **THEN** the normalized decision and receipt SHALL preserve the one-to-one raw order of `evidenceSelectors` and `evidenceIds`, and selector-only lookup SHALL fail closed rather than overwrite or collapse a frozen evidence reference

#### Scenario: Frozen evidence boundaries govern admission

- **WHEN** a member lacks sufficient frozen `independent-course` evidence for a role decision
- **THEN** neither stage SHALL use aggregate/profile evidence, prior decisions, labels, or unfrozen semantic candidates as current CourseCoverage authority

#### Scenario: Unfrozen semantic candidates are diagnostic only

- **WHEN** Primary observes semantically related course-authoring material outside the frozen `evidenceRefs`
- **THEN** the observation SHALL remain diagnostic only; upstream issue `#1180` MUST bind and classify accepted candidates as `independent-course` evidence and regenerate the frozen worklist/manifest before any later `INCLUDE`/`EXCLUDE` re-review

#### Scenario: DEFER is review-stage terminal only

- **WHEN** Primary and required Challenger agree on role-free `DEFER` with insufficient evidence
- **THEN** the receipt SHALL use `DEFERRED_EVIDENCE_BLOCKED`, set `thirdRequired=false`, preserve zero conflicts and zero Third reviews, leave CourseCoverage authority unresolved, keep the aggregate gate `BLOCKED_UNRESOLVED_EVIDENCE`, and SHALL NOT write `ACTIVE`, authority, selector, or writer state

### Requirement: Batch f699aa47a9afaf3057d4bc0e emits a machine-mergeable receipt

The decision receipt MUST be keyed by every batch binding digest, preserve the exact ordered member references, bind both raw stage-source artifacts through normalized documents and `review-provenance.json`, retain every `evidenceId`/selector pair, and prove that no out-of-slice member or production authority was written. Primary contributes 856 raw evidence references, including 19 duplicate-selector groups (38 references) and 60 independent-course references; Challenger contributes 659 identity-bound references. The first publication MUST use the v3 production-boundary proof and v2 detached-attestation schemas, with receiptDigest `eb3451fbf5b5938676f69eb9e25577bd02e6ce9435dff53b52dee4dbefdaca08` and attestationDigest `efcf9c750c644673b69038a16e84a5ad1056817785556ae5b20de075207bec32`.

#### Scenario: Receipt for batch f699aa47a9afaf3057d4bc0e is assembled

- **WHEN** all required stages are terminal and drift checks pass
- **THEN** the receipt SHALL be deterministic, machine-mergeable, and scoped to `f699aa47a9afaf3057d4bc0e`
- **AND** a second CLI replay SHALL report identical receipt and attestation bytes with `replayMode=content-equivalent` when protected-path bytes and clean status match the persisted ordered rows

### Requirement: Batch b354cb02317e7a7f534c0208 produces independent terminal decisions

Primary and Challenger MUST issue independent conclusions; Challenger MUST run for the shared risk slice selected by `profileOnly || new || changed || highRisk` members. Every conflict MUST enter Third, and Third MUST be terminal. For batch `b354cb02317e7a7f534c0208`, Primary reviewed all `204` members and Challenger reviewed `202` risk members; frozen non-risk ordinals `2` and `24` are omitted from Challenger stage decisions while remaining bound by the full receipt.

#### Scenario: Conflict occurs in batch b354cb02317e7a7f534c0208

- **WHEN** Primary and Challenger conclusions differ for a member
- **THEN** Third SHALL record the terminal conclusion and rationale in the receipt

#### Scenario: Batch b354cb02317e7a7f534c0208 has no conflict

- **WHEN** required stages agree and all members are resolved
- **THEN** the receipt SHALL preserve each stage's independent rationale and terminal outcome

#### Scenario: Batch b354cb02317e7a7f534c0208 has unresolved evidence

- **WHEN** Primary and Challenger both return `DEFER` with insufficient evidence and no semantic conflict
- **THEN** the receipt SHALL be `DEFERRED_EVIDENCE_BLOCKED`, contain `204` terminal deferred members, omit Third, and keep all production mutation flags false

### Requirement: Batch b354cb02317e7a7f534c0208 emits a machine-mergeable receipt

The decision receipt MUST be keyed by every batch binding digest, preserve exact ordered member references, and prove that no out-of-slice member or production authority was written.

#### Scenario: Receipt for batch b354cb02317e7a7f534c0208 is assembled

- **WHEN** all required stages are terminal and drift checks pass
- **THEN** the receipt SHALL be deterministic, machine-mergeable, and scoped to `b354cb02317e7a7f534c0208`

#### Scenario: Batch b354cb02317e7a7f534c0208 is replayed

- **WHEN** the same CLI inputs and protected authority snapshot are replayed
- **THEN** publication SHALL be `identical`, the detached attestation SHALL be `identical`, and no production authority path SHALL change

### Requirement: Batch a03e2ae08fe2a1d92c88b660 has an immutable review boundary

The review child MUST process only the exact ordered members at `batch-manifest.json#/batches/28/members`, binding batchId `a03e2ae08fe2a1d92c88b660`, sequence `0`, semanticGroupKey `ctr:release:time-domain-analysis-engineering-v0.1::entityType:KnowledgeStatement`, member count `313`, memberDigest `9da6428fe743e960c735d9f060d6193e27bb98e1f90ba1d2b53d62c5f2d36aa6`, worklistInputDigest `55d9a896cccc5e55d0cb754187ccdc06ef8f6a845b5152f0c0106620039662c2`, worklistDigest `bd80f5e20ad0713dd4203e5336328b5c919d44b98a376d8b5d3cf6835a398489`, and manifestDigest `2f5fa8f4b9e1d7fa75c7d2be5f2629be792e0fb35907e678f8ff3a3fa2a6c818`.

#### Scenario: Frozen batch a03e2ae08fe2a1d92c88b660 is unchanged

- **WHEN** all bound fields and canonical revisions match the manifest slice
- **THEN** the child SHALL admit exactly that ordered member set and no other member

#### Scenario: Batch a03e2ae08fe2a1d92c88b660 drifts

- **WHEN** any member, order, digest, or revision differs
- **THEN** review and receipt assembly SHALL fail closed without changing production selector or writer fence

### Requirement: Batch a03e2ae08fe2a1d92c88b660 produces independent terminal decisions

Primary and Challenger MUST issue independent conclusions; Challenger MUST run for profileOnly, new, changed, or highRisk members. Every conflict MUST enter Third, and Third MUST be terminal.

#### Scenario: Conflict occurs in batch a03e2ae08fe2a1d92c88b660

- **WHEN** Primary and Challenger conclusions differ for a member
- **THEN** Third SHALL record the terminal conclusion and rationale in the receipt

#### Scenario: Batch a03e2ae08fe2a1d92c88b660 has no conflict

- **WHEN** required stages agree and every member remains evidence-insufficient
- **THEN** the receipt SHALL preserve each stage's independent source binding, rationale, unique selectors, decision digests, and terminal outcome
- **AND** the terminal status SHALL be `DEFERRED_EVIDENCE_BLOCKED`
- **AND** no member SHALL receive a CourseCoverage role or production selector/writer-fence mutation

### Requirement: Batch a03e2ae08fe2a1d92c88b660 emits a machine-mergeable receipt

The decision receipt MUST be keyed by every batch binding digest, preserve exact ordered member references, bind both normalized stage documents to their raw independent sources, and prove that no out-of-slice member or production authority was written. The detached boundary attestation MUST be published with the receipt and preserve protected-path snapshots for deterministic replay.

#### Scenario: Receipt for batch a03e2ae08fe2a1d92c88b660 is assembled

- **WHEN** all required stages are terminal and drift checks pass
- **THEN** the receipt SHALL be deterministic, machine-mergeable, and scoped to `a03e2ae08fe2a1d92c88b660`
- **AND** first publication SHALL produce a receipt and detached attestation with all production mutation flags false
- **AND** replay with identical inputs SHALL report identical artifacts and a content-equivalent replay mode

### Requirement: Batch a03e2ae08fe2a1d92c88b660 preserves independent raw-source closure

The normalized Primary and Challenger documents MUST be sealed from the two independent raw stage sources. Their source SHA-256, writer session IDs, stage input digests, and all `313 + 313 = 626` decision digests MUST be independently verifiable against the raw bytes and frozen batch binding.

#### Scenario: Raw source closure is verified

- **WHEN** the raw sources, normalized documents, worklist, and manifest are reread
- **THEN** source bindings, canonical IDs/revisions, conclusions, rationales, and selectors SHALL match in order
- **AND** all 626 decision digests SHALL be valid SHA-256 values

### Requirement: Batch b8c877df21b1ebb0ce5c6356 has an immutable review boundary

The review child MUST process only the exact ordered members at `batch-manifest.json#/batches/25/members`, binding batchId `b8c877df21b1ebb0ce5c6356`, sequence `0`, semanticGroupKey `ctr:release:system-modeling-engineering-v0.1::entityType:KnowledgeStatement`, member count `171`, memberDigest `e5d637bbe468048744a6ff80ecd54d973c9924423d456324a281d66a9e819e56`, worklistInputDigest `55d9a896cccc5e55d0cb754187ccdc06ef8f6a845b5152f0c0106620039662c2`, worklistDigest `bd80f5e20ad0713dd4203e5336328b5c919d44b98a376d8b5d3cf6835a398489`, and manifestDigest `2f5fa8f4b9e1d7fa75c7d2be5f2629be792e0fb35907e678f8ff3a3fa2a6c818`.

#### Scenario: Frozen batch b8c877df21b1ebb0ce5c6356 is unchanged

- **WHEN** all bound fields and canonical revisions match the manifest slice
- **THEN** the child SHALL admit exactly that ordered member set and no other member

#### Scenario: Batch b8c877df21b1ebb0ce5c6356 drifts

- **WHEN** any member, order, digest, or revision differs
- **THEN** review and receipt assembly SHALL fail closed without changing production selector or writer fence

### Requirement: Batch b8c877df21b1ebb0ce5c6356 produces independent terminal decisions

Primary and Challenger MUST issue independent conclusions; Challenger MUST run for profileOnly, new, changed, or highRisk members. For this frozen batch, Primary's byte-preserved remediation source is `course-content/authoring/knowledge/issue-1215-course-coverage-review/primary-independent-stage-source.json` with SHA-256 `cbda7f5c7122f5d0b457a63de56a6cbc9bf7b199f1cad4833dc1e2b37e826044`, session `e0bc3434-6424-4782-88b5-a78fc7e18bf2`, and normalized v2 digest `162ac8b0a4c5f3569bec61da996deffb6ba3c2e6936c0b92253963104c5ca59a`. That independent Primary remediation accepted PR #1253 P1 and re-audited only ordinals `69,109,132,137,142` against their frozen selectors without reading Challenger/Third artifacts; all five became role-free `DEFER`. Challenger's byte-preserved source is `course-content/authoring/knowledge/issue-1215-course-coverage-review/challenger-independent-stage-source.json` with SHA-256 `5a7521ced17491a3e325dd321468e3afe73074e194e53e031dd539192e5edc23`, session `74224160-f779-4995-bf7e-6ae8e8105f26`, and normalized v2 digest `f8c5ab643f335e77a681ceadc85c3c32a1eeb607e6c241a09fce3b4825ad65cc`. Both v2 stages preserve raw frozen evidence order as aligned `evidenceSelectors` and exact `evidenceIds`; repeated selectors are disambiguated by evidenceId. Primary records 0 `INCLUDE`, 171 `DEFER`, and 0 `EXCLUDE`; Challenger records 137 role-free `DEFER`. Every conflict MUST enter Third, and Third MUST be terminal; their required risk-slice conclusions agree, so this batch has zero conflicts and MUST NOT contain Third artifacts.

#### Scenario: Conflict occurs in batch b8c877df21b1ebb0ce5c6356

- **WHEN** Primary and Challenger conclusions differ for a member
- **THEN** Third SHALL record the terminal conclusion and rationale in the receipt

#### Scenario: Batch b8c877df21b1ebb0ce5c6356 has no conflict

- **WHEN** required stages agree and all members are resolved
- **THEN** the receipt SHALL preserve each stage's independent rationale and terminal outcome

### Requirement: Batch b8c877df21b1ebb0ce5c6356 emits a machine-mergeable receipt

The decision receipt MUST be keyed by every batch binding digest, preserve exact ordered member references, and prove that no out-of-slice member or production authority was written. This batch's receipt digest is `07ec146b188d5930d4df9a949d936aef97c32392f11bac25acfe496f9924b22a` and its boundary-attestation digest is `b97daff16ed3dbea169586e7a824304f184f168436d4d40db73bd6131af12f77`; it is `DEFERRED_EVIDENCE_BLOCKED`, leaves all 171 members unresolved, and keeps the aggregate gate `BLOCKED_UNRESOLVED_EVIDENCE`.

#### Scenario: Receipt for batch b8c877df21b1ebb0ce5c6356 is assembled

- **WHEN** all required stages are terminal and drift checks pass
- **THEN** the receipt SHALL be deterministic, machine-mergeable, and scoped to `b8c877df21b1ebb0ce5c6356`

### Requirement: Batch ea058c5dde3d58d06f734bd5 has an immutable review boundary

The review child MUST process only the exact ordered members at `batch-manifest.json#/batches/30/members`, binding batchId `ea058c5dde3d58d06f734bd5`, sequence `0`, semanticGroupKey `ctr:root-locus-engineering-v0.1::entityType:DomainConcept`, member count `85`, memberDigest `82dc61a2382bf7e7f671343a191e364c4380a6f3f94b3e20c7765bd6c28efca2`, worklistInputDigest `55d9a896cccc5e55d0cb754187ccdc06ef8f6a845b5152f0c0106620039662c2`, worklistDigest `bd80f5e20ad0713dd4203e5336328b5c919d44b98a376d8b5d3cf6835a398489`, and manifestDigest `2f5fa8f4b9e1d7fa75c7d2be5f2629be792e0fb35907e678f8ff3a3fa2a6c818`.

#### Scenario: Frozen batch ea058c5dde3d58d06f734bd5 is unchanged

- **WHEN** all bound fields and canonical revisions match the manifest slice
- **THEN** the child SHALL admit exactly that ordered member set and no other member

#### Scenario: Batch ea058c5dde3d58d06f734bd5 drifts

- **WHEN** any member, order, digest, or revision differs
- **THEN** review and receipt assembly SHALL fail closed without changing production selector or writer fence

### Requirement: Batch ea058c5dde3d58d06f734bd5 produces independent terminal decisions

Primary and Challenger MUST issue independent conclusions; Challenger MUST run for profileOnly, new, changed, or highRisk members. Every conflict within the required Challenger slice MUST enter Third, and Third MUST be terminal.

#### Scenario: Conflict occurs in batch ea058c5dde3d58d06f734bd5

- **WHEN** Primary and Challenger conclusions differ for a required Challenger member
- **THEN** Third SHALL record the terminal conclusion and rationale in the receipt

#### Scenario: Batch ea058c5dde3d58d06f734bd5 has no conflict

- **WHEN** required stages agree and all members are resolved
- **THEN** the receipt SHALL preserve each stage's independent rationale and terminal outcome

### Requirement: Batch ea058c5dde3d58d06f734bd5 emits a machine-mergeable receipt

The decision receipt MUST be keyed by every batch binding digest, preserve exact ordered member references, and prove that no out-of-slice member or production authority was written.

#### Scenario: Receipt for batch ea058c5dde3d58d06f734bd5 is assembled

- **WHEN** all required stages are terminal and drift checks pass
- **THEN** the receipt SHALL be deterministic, machine-mergeable, and scoped to `ea058c5dde3d58d06f734bd5`

### Requirement: Batch ccfbcd4d501ae459305602a6 has an immutable review boundary

The review child MUST process only the exact ordered members at `batch-manifest.json#/batches/14/members`, binding batchId `ccfbcd4d501ae459305602a6`, sequence `0`, semanticGroupKey `ctr:release:stability-analysis-engineering-v0.1::entityType:Formula`, member count `37`, memberDigest `1157b6af80c506dc595d8b7b60dfed8bc22ef97ce506eb67db0b55b2f2ff5902`, worklistInputDigest `55d9a896cccc5e55d0cb754187ccdc06ef8f6a845b5152f0c0106620039662c2`, worklistDigest `bd80f5e20ad0713dd4203e5336328b5c919d44b98a376d8b5d3cf6835a398489`, and manifestDigest `2f5fa8f4b9e1d7fa75c7d2be5f2629be792e0fb35907e678f8ff3a3fa2a6c818`.

#### Scenario: Frozen batch ccfbcd4d501ae459305602a6 is unchanged

- **WHEN** all bound fields and canonical revisions match the manifest slice
- **THEN** the child SHALL admit exactly that ordered member set and no other member

#### Scenario: Batch ccfbcd4d501ae459305602a6 drifts

- **WHEN** any member, order, digest, or revision differs
- **THEN** review and receipt assembly SHALL fail closed without changing production selector or writer fence

### Requirement: Batch ccfbcd4d501ae459305602a6 produces independent terminal decisions

Primary and Challenger MUST issue independent conclusions; Challenger MUST run for profileOnly, new, changed, or highRisk members. Every conflict MUST enter Third, and Third MUST be terminal.

#### Scenario: Conflict occurs in batch ccfbcd4d501ae459305602a6

- **WHEN** Primary and Challenger conclusions differ for a member
- **THEN** Third SHALL record the terminal conclusion and rationale in the receipt

#### Scenario: Batch ccfbcd4d501ae459305602a6 has no conflict

- **WHEN** required stages agree and all members are resolved
- **THEN** the receipt SHALL preserve each stage's independent rationale and terminal outcome

### Requirement: Batch ccfbcd4d501ae459305602a6 emits a machine-mergeable receipt

The decision receipt MUST be keyed by every batch binding digest, preserve exact ordered member references, and prove that no out-of-slice member or production authority was written.

#### Scenario: Receipt for batch ccfbcd4d501ae459305602a6 is assembled

- **WHEN** all required stages are terminal and drift checks pass
- **THEN** the receipt SHALL be deterministic, machine-mergeable, and scoped to `ccfbcd4d501ae459305602a6`

### Requirement: Batch ab975de2df4837f43038c81d has an immutable review boundary

The review child MUST process only the exact ordered members at `batch-manifest.json#/batches/18/members`, binding batchId `ab975de2df4837f43038c81d`, sequence `0`, semanticGroupKey `ctr:release:state-space-control-analysis-and-design-engineering-v0.1::entityType:DomainConcept`, member count `149`, memberDigest `6f4d39856a11b3fa82cd5117ba5ad941c54e2f7a792cd60c5d474cd97df76cd5`, worklistInputDigest `55d9a896cccc5e55d0cb754187ccdc06ef8f6a845b5152f0c0106620039662c2`, worklistDigest `bd80f5e20ad0713dd4203e5336328b5c919d44b98a376d8b5d3cf6835a398489`, and manifestDigest `2f5fa8f4b9e1d7fa75c7d2be5f2629be792e0fb35907e678f8ff3a3fa2a6c818`.

#### Scenario: Frozen batch ab975de2df4837f43038c81d is unchanged

- **WHEN** all bound fields and canonical revisions match the manifest slice
- **THEN** the child SHALL admit exactly that ordered member set and no other member

#### Scenario: Batch ab975de2df4837f43038c81d drifts

- **WHEN** any member, order, digest, or revision differs
- **THEN** review and receipt assembly SHALL fail closed without changing production selector or writer fence

### Requirement: Batch ab975de2df4837f43038c81d produces independent terminal decisions

Primary and Challenger MUST issue independent conclusions; Challenger MUST run for profileOnly, new, changed, or highRisk members. Every conflict MUST enter Third, and Third MUST be terminal.

#### Scenario: Conflict occurs in batch ab975de2df4837f43038c81d

- **WHEN** Primary and Challenger conclusions differ for a member
- **THEN** Third SHALL record the terminal conclusion and rationale in the receipt

#### Scenario: Batch ab975de2df4837f43038c81d has no conflict

- **WHEN** required stages agree and all members are resolved
- **THEN** the receipt SHALL preserve each stage's independent rationale and terminal outcome

### Requirement: Batch ab975de2df4837f43038c81d emits a machine-mergeable receipt

The decision receipt MUST be keyed by every batch binding digest, preserve exact ordered member references, and prove that no out-of-slice member or production authority was written.

#### Scenario: Receipt for batch ab975de2df4837f43038c81d is assembled

- **WHEN** all required stages are terminal and drift checks pass
- **THEN** the receipt SHALL be deterministic, machine-mergeable, and scoped to `ab975de2df4837f43038c81d`

### Requirement: Batch 00617fd6a22c8b84c2e91142 has an immutable review boundary

The review child MUST process only the exact ordered members at `batch-manifest.json#/batches/26/members`, binding batchId `00617fd6a22c8b84c2e91142`, sequence `0`, semanticGroupKey `ctr:release:time-domain-analysis-engineering-v0.1::entityType:DomainConcept`, member count `147`, memberDigest `362665fd1a4c18baad85eb8b44407dfd87b3720ce1dd3e607749f525adac0ea7`, worklistInputDigest `55d9a896cccc5e55d0cb754187ccdc06ef8f6a845b5152f0c0106620039662c2`, worklistDigest `bd80f5e20ad0713dd4203e5336328b5c919d44b98a376d8b5d3cf6835a398489`, and manifestDigest `2f5fa8f4b9e1d7fa75c7d2be5f2629be792e0fb35907e678f8ff3a3fa2a6c818`.

#### Scenario: Frozen batch 00617fd6a22c8b84c2e91142 is unchanged

- **WHEN** all bound fields and canonical revisions match the manifest slice
- **THEN** the child SHALL admit exactly that ordered member set and no other member

#### Scenario: Batch 00617fd6a22c8b84c2e91142 drifts

- **WHEN** any member, order, digest, or revision differs
- **THEN** review and receipt assembly SHALL fail closed without changing production selector or writer fence

### Requirement: Batch 00617fd6a22c8b84c2e91142 produces independent terminal decisions

Primary and Challenger MUST issue independent conclusions; Challenger MUST run for profileOnly, new, changed, or highRisk members. Every conflict MUST enter Third, and Third MUST be terminal.

#### Scenario: Conflict occurs in batch 00617fd6a22c8b84c2e91142

- **WHEN** Primary and Challenger conclusions differ for a member
- **THEN** Third SHALL record the terminal conclusion and rationale in the receipt

#### Scenario: Batch 00617fd6a22c8b84c2e91142 has no conflict

- **WHEN** Primary and required Challenger independently agree on all 147 ordered members and no conflict is present
- **THEN** the receipt SHALL preserve each stage's independent raw-source binding, rationale, evidence selectors, exact evidence IDs, canonical decision digests, and normalized document digest, with no Third stage
- **AND** every member SHALL remain a role-free `DEFER` with insufficient evidence and review-stage terminal state `DEFERRED_EVIDENCE_BLOCKED`; CourseCoverage authority SHALL remain unresolved and the global gate SHALL remain blocked

### Requirement: Batch 00617fd6a22c8b84c2e91142 emits a machine-mergeable receipt

The decision receipt MUST be keyed by every batch binding digest, preserve exact ordered member references, and prove that no out-of-slice member or production authority was written. It MUST bind `review-provenance.json` through `reviewProvenanceBinding`, including repository-relative source paths, raw-byte SHA-256 values, distinct Primary and Challenger writer sessions/scopes, normalized v2 stage documents, and Challenger's `didNotReadPrimaryArtifact=true` audit. The Primary source writer session MUST be `b76983ed-6bbe-448a-a688-0d320e8a85c2`; the Challenger source writer session MUST be `f068c4e1-ee97-4b4b-a448-02bc1a0f476a`; the bound provenance SHA-256 MUST be `fa63ac5ad7f3f09073157f21fae39146bc8f90fa0d2dabe28d96c1727f533f2e`. This new publication MUST use the v3 production-boundary proof and v2 detached-attestation pair, and content-equivalent replay MUST fail closed if provenance or protected-path bindings drift.

#### Scenario: Receipt for batch 00617fd6a22c8b84c2e91142 is assembled

- **WHEN** all required stages are terminal and drift checks pass
- **THEN** the receipt SHALL be deterministic, machine-mergeable, and scoped to `00617fd6a22c8b84c2e91142`, with `receiptDigest` `ff36f047f9d1558dfddcfa6c8cf15d886216bda3ec812b801a7e3bf88ba8294f` and detached `attestationDigest` `2e3897efacb6264771db2449a9e3f4b8f4bdbfc828884d228e447bee4f9882d3`
- **AND** replay SHALL accept only an identical content-equivalent continuation when the persisted protected-path rows and clean status still match

### Requirement: Batch 58d1670455782297bdaf8a19 has an immutable review boundary

The review child MUST process only the exact ordered members at `batch-manifest.json#/batches/22/members`, binding batchId `58d1670455782297bdaf8a19`, sequence `0`, semanticGroupKey `ctr:release:state-space-control-analysis-and-design-engineering-v0.1::entityType:SystemModel`, member count `50`, memberDigest `9db24aec2aff29ab79542c398dd4c65782b573635c4e7f944714d951bcfbf964`, worklistInputDigest `55d9a896cccc5e55d0cb754187ccdc06ef8f6a845b5152f0c0106620039662c2`, worklistDigest `bd80f5e20ad0713dd4203e5336328b5c919d44b98a376d8b5d3cf6835a398489`, and manifestDigest `2f5fa8f4b9e1d7fa75c7d2be5f2629be792e0fb35907e678f8ff3a3fa2a6c818`.

#### Scenario: Frozen batch 58d1670455782297bdaf8a19 is unchanged

- **WHEN** all bound fields and canonical revisions match the manifest slice
- **THEN** the child SHALL admit exactly that ordered member set and no other member

#### Scenario: Batch 58d1670455782297bdaf8a19 drifts

- **WHEN** any member, order, digest, or revision differs
- **THEN** review and receipt assembly SHALL fail closed without changing production selector or writer fence

### Requirement: Batch 58d1670455782297bdaf8a19 produces independent terminal decisions

Primary and Challenger MUST issue independent conclusions; Challenger MUST run for profileOnly, new, changed, or highRisk members. Every conflict MUST enter Third, and Third MUST be terminal.

#### Scenario: Conflict occurs in batch 58d1670455782297bdaf8a19

- **WHEN** Primary and Challenger conclusions differ for a member
- **THEN** Third SHALL record the terminal conclusion and rationale in the receipt

#### Scenario: Batch 58d1670455782297bdaf8a19 has no conflict

- **WHEN** required stages agree and all members are resolved
- **THEN** the receipt SHALL preserve each stage's independent rationale and terminal outcome

### Requirement: Batch 58d1670455782297bdaf8a19 emits a machine-mergeable receipt

The decision receipt MUST be keyed by every batch binding digest, preserve exact ordered member references, and prove that no out-of-slice member or production authority was written.

#### Scenario: Receipt for batch 58d1670455782297bdaf8a19 is assembled

- **WHEN** all required stages are terminal and drift checks pass
- **THEN** the receipt SHALL be deterministic, machine-mergeable, and scoped to `58d1670455782297bdaf8a19`

### Requirement: Batch 88b4b69695891faeed019fb2 has an immutable review boundary

The review child MUST process only the exact ordered members at `batch-manifest.json#/batches/29/members`, binding batchId `88b4b69695891faeed019fb2`, sequence `0`, semanticGroupKey `ctr:release:time-domain-analysis-engineering-v0.1::entityType:SystemModel`, member count `25`, memberDigest `d3da297e9f913499949a12a9622615455ed95a206ed2ffca144d29e0de49a36a`, worklistInputDigest `55d9a896cccc5e55d0cb754187ccdc06ef8f6a845b5152f0c0106620039662c2`, worklistDigest `bd80f5e20ad0713dd4203e5336328b5c919d44b98a376d8b5d3cf6835a398489`, and manifestDigest `2f5fa8f4b9e1d7fa75c7d2be5f2629be792e0fb35907e678f8ff3a3fa2a6c818`.

#### Scenario: Frozen batch 88b4b69695891faeed019fb2 is unchanged

- **WHEN** all bound fields and canonical revisions match the manifest slice
- **THEN** the child SHALL admit exactly that ordered member set and no other member

#### Scenario: Batch 88b4b69695891faeed019fb2 drifts

- **WHEN** any member, order, digest, or revision differs
- **THEN** review and receipt assembly SHALL fail closed without changing production selector or writer fence

### Requirement: Batch 88b4b69695891faeed019fb2 produces independent terminal decisions

Primary and Challenger MUST issue independent conclusions; Challenger MUST run for profileOnly, new, changed, or highRisk members. Every conflict MUST enter Third, and Third MUST be terminal.

#### Scenario: Conflict occurs in batch 88b4b69695891faeed019fb2

- **WHEN** Primary and Challenger conclusions differ for a member
- **THEN** Third SHALL record the terminal conclusion and rationale in the receipt

#### Scenario: Batch 88b4b69695891faeed019fb2 has no conflict

- **WHEN** required stages agree and all members are resolved
- **THEN** the receipt SHALL preserve each stage's independent rationale and terminal outcome

### Requirement: Batch 88b4b69695891faeed019fb2 emits a machine-mergeable receipt

The decision receipt MUST be keyed by every batch binding digest, preserve exact ordered member references, and prove that no out-of-slice member or production authority was written.

#### Scenario: Receipt for batch 88b4b69695891faeed019fb2 is assembled

- **WHEN** all required stages are terminal and drift checks pass
- **THEN** the receipt SHALL be deterministic, machine-mergeable, and scoped to `88b4b69695891faeed019fb2`
- **AND** replay with identical inputs SHALL report identical artifacts and a content-equivalent replay mode

### Requirement: Batch 52b5179a73a91ace49d20fe4 has an immutable review boundary

The review child MUST process only the exact ordered members at `batch-manifest.json#/batches/31/members`, binding batchId `52b5179a73a91ace49d20fe4`, sequence `0`, semanticGroupKey `ctr:root-locus-engineering-v0.1::entityType:Formula`, member count `16`, memberDigest `4d8fab8e323a5677ce8cb93cd4d0d8a15b0d27deee747978d36304659abd4b8c`, worklistInputDigest `55d9a896cccc5e55d0cb754187ccdc06ef8f6a845b5152f0c0106620039662c2`, worklistDigest `bd80f5e20ad0713dd4203e5336328b5c919d44b98a376d8b5d3cf6835a398489`, and manifestDigest `2f5fa8f4b9e1d7fa75c7d2be5f2629be792e0fb35907e678f8ff3a3fa2a6c818`.

#### Scenario: Frozen batch 52b5179a73a91ace49d20fe4 is unchanged

- **WHEN** all bound fields and canonical revisions match the manifest slice
- **THEN** the child SHALL admit exactly that ordered member set and no other member

#### Scenario: Batch 52b5179a73a91ace49d20fe4 drifts

- **WHEN** any member, order, digest, or revision differs
- **THEN** review and receipt assembly SHALL fail closed without changing production selector or writer fence

### Requirement: Batch 52b5179a73a91ace49d20fe4 produces independent terminal decisions

Primary and Challenger MUST issue independent conclusions; Challenger MUST run for profileOnly, new, changed, or highRisk members. Every conflict within the required Challenger slice MUST enter Third, and Third MUST be terminal.

#### Scenario: Conflict occurs in batch 52b5179a73a91ace49d20fe4

- **WHEN** Primary and Challenger conclusions differ for a required Challenger member
- **THEN** Third SHALL record the terminal conclusion and rationale in the receipt

#### Scenario: Batch 52b5179a73a91ace49d20fe4 has no conflict

- **WHEN** required stages agree and all members are resolved
- **THEN** the receipt SHALL preserve each stage's independent rationale and terminal outcome

### Requirement: Batch 52b5179a73a91ace49d20fe4 emits a machine-mergeable receipt

The decision receipt MUST be keyed by every batch binding digest, preserve exact ordered member references, and prove that no out-of-slice member or production authority was written.

#### Scenario: Receipt for batch 52b5179a73a91ace49d20fe4 is assembled

- **WHEN** all required stages are terminal and drift checks pass
- **THEN** the receipt SHALL be deterministic, machine-mergeable, and scoped to `52b5179a73a91ace49d20fe4`

### Requirement: Batch 84aa72597e8fe1d9ee6f0602 has an immutable review boundary

The review child MUST process only the exact ordered members at `batch-manifest.json#/batches/33/members`, binding batchId `84aa72597e8fe1d9ee6f0602`, sequence `0`, semanticGroupKey `ctr:root-locus-engineering-v0.1::entityType:SystemModel`, member count `1`, memberDigest `8ee4109996fc05d510290a3620c6172e8107421e9695a1aa79c13e5cbe4040e4`, worklistInputDigest `55d9a896cccc5e55d0cb754187ccdc06ef8f6a845b5152f0c0106620039662c2`, worklistDigest `bd80f5e20ad0713dd4203e5336328b5c919d44b98a376d8b5d3cf6835a398489`, and manifestDigest `2f5fa8f4b9e1d7fa75c7d2be5f2629be792e0fb35907e678f8ff3a3fa2a6c818`.

#### Scenario: Frozen batch 84aa72597e8fe1d9ee6f0602 is unchanged

- **WHEN** all bound fields and canonical revisions match the manifest slice
- **THEN** the child SHALL admit exactly that ordered member set and no other member

#### Scenario: Batch 84aa72597e8fe1d9ee6f0602 drifts

- **WHEN** any member, order, digest, or revision differs
- **THEN** review and receipt assembly SHALL fail closed without changing production selector or writer fence

### Requirement: Batch 84aa72597e8fe1d9ee6f0602 produces independent terminal decisions

Primary and Challenger MUST issue independent conclusions; Challenger MUST run for profileOnly, new, changed, or highRisk members. Every conflict within the required Challenger slice MUST enter Third, and Third MUST be terminal.

#### Scenario: Conflict occurs in batch 84aa72597e8fe1d9ee6f0602

- **WHEN** Primary and Challenger conclusions differ for a required Challenger member
- **THEN** Third SHALL record the terminal conclusion and rationale in the receipt

#### Scenario: Batch 84aa72597e8fe1d9ee6f0602 has no conflict

- **WHEN** required stages agree and all members are resolved
- **THEN** the receipt SHALL preserve each stage's independent rationale and terminal outcome

### Requirement: Batch 84aa72597e8fe1d9ee6f0602 emits a machine-mergeable receipt

The decision receipt MUST be keyed by every batch binding digest, preserve exact ordered member references, and prove that no out-of-slice member or production authority was written.

#### Scenario: Receipt for batch 84aa72597e8fe1d9ee6f0602 is assembled

- **WHEN** all required stages are terminal and drift checks pass
- **THEN** the receipt SHALL be deterministic, machine-mergeable, and scoped to `84aa72597e8fe1d9ee6f0602`
