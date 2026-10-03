## ADDED Requirements

### Requirement: Runtime content identity is independent of physical media storage
The system SHALL preserve the existing v2 logical paths, digest-derived blob keys, byte sizes, manifest identity and selection semantics while resolving qualified public teaching bytes through one canonical object in the existing media bucket. Internal content SHALL remain private. Moving a body SHALL NOT rewrite an immutable historical manifest or introduce another Runtime selection authority.

#### Scenario: A qualified media body moves between buckets
- **WHEN** its canonical object is verified and all protected consumers are prepared to read it
- **THEN** the original duplicate body may be retired without changing any protected release identity
- **AND** its logical paths and exact SHA-256 continue to resolve through the canonical body

#### Scenario: A private or unqualified file is encountered
- **WHEN** a file lacks the required public path, type or infograph qualification
- **THEN** publication SHALL NOT place it in the public media prefix or create a public delivery entry

### Requirement: Incremental publication writes qualified media directly
The publisher SHALL write new qualified media bodies directly to the existing media bucket and SHALL NOT also store them in the private Runtime body prefix. It SHALL retain metadata-based incremental hashing, conditional no-overwrite PUT and manifest-last completion. Unchanged retained bodies SHALL require no body read, OSS HEAD/GET or upload. A retired cache baseline SHALL fail with an explicit recovery instruction rather than publish missing inherited objects.

#### Scenario: Media changes while another file remains unchanged
- **WHEN** one qualified media digest changes and another retained media digest remains identical
- **THEN** only the new body SHALL be transferred, its public qualification SHALL be committed after successful publication, and the existing body SHALL be reused

#### Scenario: A stale local index refers to collected content
- **WHEN** the cached publication is no longer retained and cannot establish inherited availability
- **THEN** publication SHALL stop before writing a terminal manifest and require explicit cache recovery

### Requirement: Storage migration preserves recovery before duplicate deletion
Migration SHALL bind the protected manifests, exact source and destination object identities, prepared read paths and actual consumer evidence before allowing duplicate retirement. A mismatch, missing read path or incomplete preparation SHALL forbid deletion. It SHALL retain an executable restore plan and prevent an incompatible application rollback while required legacy copies are absent.

#### Scenario: One copied object is corrupt
- **WHEN** a destination body's size or SHA-256 differs from the protected file binding
- **THEN** migration SHALL fail before retiring any source copy

#### Scenario: An older application is requested after retirement
- **WHEN** it cannot resolve the canonical media location and original copies remain retired
- **THEN** deployment SHALL require verified restoration before replacing the compatible application

## MODIFIED Requirements

### Requirement: Runtime blob garbage collection is reachability-safe
Garbage collection SHALL derive its protected set from the current and previous pointers, every discovered classroom Runtime reference, explicit pins, valid developer leases, ongoing publications and unexpired publication or signed-media retention. It SHALL verify the immutable manifests of all protected identities and compute reachability from their exact body digests and canonical storage locations. Body collection SHALL be explicitly requested, default to dry-run, and serialize execution with publication and selection under the existing host lock. Missing or inconsistent protection evidence SHALL forbid deletion. It SHALL delete only objects outside the protected reachable set in the declared private Runtime body and public teaching-media prefixes, record exact candidates and results, and preserve selectors, model releases and historical release evidence.

#### Scenario: A current or classroom body is shared
- **WHEN** current, previous, a classroom, a pin or a live lease references a digest
- **THEN** neither its canonical body nor a still-required legacy copy SHALL be deleted as unreferenced content

#### Scenario: Publication and collection overlap
- **WHEN** a publisher is writing a candidate release or retaining it for activation
- **THEN** GC SHALL serialize with the publication and preserve its reachable bodies until the declared retention ends

#### Scenario: A retained identity has no valid manifest
- **WHEN** classroom discovery, a protected manifest, a lease or a canonical location cannot be reliably validated
- **THEN** execution SHALL fail before deleting any body

#### Scenario: A former previous release has live signed URLs
- **WHEN** selection removes it from the two pointers
- **THEN** its bodies SHALL remain protected for at least the maximum signed media lifetime

#### Scenario: Retention lease cannot be shortened or released early
- **WHEN** an operator repeats retention or the host clock moves backwards
- **THEN** retention SHALL only be preserved or extended and unsafe collection SHALL fail closed

#### Scenario: Failed desired candidate preserves active and rollback
- **WHEN** a candidate publication or selection fails
- **THEN** the existing current and previous releases and their reachable bodies SHALL remain protected

#### Scenario: Desired candidate is protected until explicit replacement
- **WHEN** a candidate remains covered by a publication lease or an explicit retained pin
- **THEN** its reachable bodies SHALL remain protected until the declared lease ends or the pin is explicitly replaced

#### Scenario: Protected blob cannot be collected
- **WHEN** any verified protected manifest references a body digest
- **THEN** its canonical object SHALL be excluded from the deletion set

#### Scenario: Lifecycle drift aborts garbage collection
- **WHEN** pointers, discovered references, canonical locations or protection records differ during execution revalidation
- **THEN** GC SHALL abort without deleting further objects or reporting successful completion

#### Scenario: Retired media release remains reachable through its URL grace period
- **WHEN** an outgoing previous release no longer has a pointer but its signed media lifetime has not elapsed
- **THEN** GC SHALL retain its exact reachable bodies until that grace period ends
