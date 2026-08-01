# latest-stable-actkg-aggregate-admission Specification

## Purpose
TBD - created by archiving change admit-latest-stable-actkg-aggregate. Update Purpose after archive.
## Requirements
### Requirement: Latest stable Aggregate is resolved from authoritative release facts
The system MUST uniquely resolve the latest stable and authorized ActKG Aggregate from pinned Git objects and release metadata. The binding MUST include the ActKG main, packaging, source and tag revisions; Release, Bundle, Manifest, Schema and dataset identities; predecessor identity; an ISO-8601 UTC resolution time observation; and a deterministic resolution digest. The resolution digest MUST cover only stable identity fields and MUST exclude the resolution time observation. Directory order, lexical version comparison, fixed version constants and silent fallback MUST NOT select the candidate.

#### Scenario: One current stable Aggregate is admissible
- **WHEN** exactly one stable authorized Aggregate has a complete release identity at the captured ActKG revision
- **THEN** the resolver SHALL emit one binding whose digest covers every required identity field while excluding its resolution time observation

#### Scenario: Latest release cannot be uniquely admitted
- **WHEN** the newest release is ambiguous, incomplete, unauthorized or unreadable from the captured Git objects
- **THEN** the resolver SHALL reject without selecting an older candidate

### Requirement: Candidate successor chain is complete and identity preserving
The system MUST prove a continuous successor/predecessor chain from the latest ACT-admitted endpoint to the resolved candidate. Every hop MUST validate Release Diff semantics, Bundle and Schema compatibility, Release and dataset hashes, and Canonical identity preservation. A missing or incompatible hop MUST block admission.

#### Scenario: Successor chain closes
- **WHEN** every hop references the exact predecessor and all compatibility and identity checks pass
- **THEN** the chain SHALL be eligible for isolated candidate intake

#### Scenario: Revision package is missing
- **WHEN** the candidate has no legal successor path from the admitted endpoint
- **THEN** admission SHALL fail with the missing compatibility boundary and SHALL NOT synthesize a hop

### Requirement: Candidate intake is atomic and isolated
The system MUST stage the exact Bundle members atomically, revalidate their bytes and paths after copy, and import them into an isolated database boundary under one consistent snapshot. Candidate intake MUST NOT modify any production ReleaseSet selector, consumer selector or learning-fact writer fence.

#### Scenario: Staged and imported candidate is valid
- **WHEN** every staged member matches the frozen binding and the isolated import commits successfully
- **THEN** the system SHALL emit an immutable candidate intake receipt and leave production authority unchanged

#### Scenario: Copied bytes or live resolution drift
- **WHEN** a staged member differs from its source digest or live resolution no longer matches the frozen binding
- **THEN** the system SHALL discard the temporary intake and SHALL NOT publish a candidate receipt

### Requirement: Delta acceptance is independently reproducible
The system MUST recompute each Delta from the imported predecessor and successor and compare it with the upstream Release Diff. Accepted receipts MUST bind the candidate import, both endpoint identities, the recomputed semantic digest, the upstream diff digest and the ACT capture revision. Any disagreement MUST produce a rejected result.

#### Scenario: Upstream and recomputed Delta agree
- **WHEN** membership, identity and semantic changes agree for every chain hop
- **THEN** the system SHALL emit accepted immutable Delta receipts for the candidate chain

#### Scenario: Delta evidence disagrees
- **WHEN** any upstream Release Diff disagrees with the independently recomputed Delta
- **THEN** the candidate SHALL remain non-admitted and every production selector SHALL remain unchanged

