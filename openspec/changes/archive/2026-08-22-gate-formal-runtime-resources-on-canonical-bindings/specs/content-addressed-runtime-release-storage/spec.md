## ADDED Requirements

### Requirement: Formal resource admission is sealed by the existing v2 release authority
A Runtime Release v2 candidate that declares the formal-resource contract SHALL extend its existing manifest and immutable publication receipt with one canonical formal-resource envelope. The envelope MUST bind the source revision and logical tree identity, candidate/included/excluded resource set counts and hashes, atomic binding-set hash, Authority identity, course scope, pipeline qualification receipt hashes, and validator/builder versions. The existing v2 lifecycle record, active receipt, and production pointer SHALL remain the only release-selection authority; no resource-specific current pointer or selector MAY be introduced.

#### Scenario: Formal candidate is constructed
- **WHEN** a v2 candidate includes formally governed teaching resources
- **THEN** its manifest and receipt SHALL seal the complete formal-resource envelope under the same immutable release identity
- **AND** candidate, included, excluded, and binding sets SHALL remain independently countable and hash-verifiable

#### Scenario: One formal-resource identity drifts
- **WHEN** a candidate, included, excluded, binding, Authority, course-scope, source, qualification, or builder identity differs from the sealed envelope
- **THEN** publication and selection SHALL fail before any terminal manifest, active receipt, or lifecycle pointer update
- **AND** the prior active and rollback releases SHALL remain unchanged

#### Scenario: Existing historical v2 release is read
- **WHEN** a v2 release created under an earlier schema has no formal-resource contract
- **THEN** it SHALL retain its historical validation and rollback semantics
- **AND** it SHALL not be represented as satisfying the new formal-resource gate

### Requirement: Formal resource sources use only governed v2 source identities
Every file or generated artifact referenced by the formal-resource envelope SHALL resolve to a Git blob in the target source revision or to an exact external/generated input declared and validated under the existing v2 source-proof contract. A URL, signed URL, filename, title, local working directory, or runtime-discovered registry entry MUST NOT establish source or content identity.

#### Scenario: External media is admitted
- **WHEN** a formal video or audio originates outside the Git tree
- **THEN** its immutable declared external-input identity, final content hash, source-proof, and formal-resource envelope SHALL agree before publication
- **AND** its delivery URL or signed URL SHALL remain a temporary launch mechanism only

#### Scenario: Local file was not declared
- **WHEN** a working-tree media, transcript, review output, or generated binding file has no governed Git or declared external/generated source identity
- **THEN** v2 planning SHALL fail or exclude the affected candidate before any blob write
- **AND** it SHALL not copy the local bytes into a formal release by fallback

### Requirement: Active readiness binds the formal envelope without exposing governance data
For a release declaring the formal-resource contract, the active receipt, materialized manifest, readiness result, resource resolver, active Teaching Projection, and graph resource projection SHALL bind the same Release ID, manifest identities, logical tree digest, formal-resource envelope hash, Authority identity, course scope, and atomic binding-set hash. Readiness and product APIs SHALL expose only the existing minimal safe active identity and bounded availability; they SHALL NOT expose candidate/excluded ledgers, atom text, transcript bodies, confidence, review state, object keys, local paths, credentials, or signed URLs.

#### Scenario: Active formal envelope matches
- **WHEN** the selected manifest, active receipt, materialized view, Teaching Projection, and resource projection bind the same formal envelope
- **THEN** readiness MAY report the release ready and formal resource consumers MAY resolve its authorized atomic bindings
- **AND** the public readiness shape SHALL remain minimal and non-cacheable

#### Scenario: Binding receipt differs from active release
- **WHEN** the active resource projection or Teaching Projection names a different binding-set or formal-envelope hash
- **THEN** formal resource readiness and graph markers SHALL fail closed
- **AND** the prior active release's valid consumers and base semantic node detail SHALL remain available

#### Scenario: Candidate contains an excluded resource
- **WHEN** a resource is present in the candidate ledger but sealed as excluded
- **THEN** readiness SHALL verify the exclusion hash without making the resource launchable or visible as a formal marker
- **AND** the product API SHALL not expose the exclusion reason or review artifact
