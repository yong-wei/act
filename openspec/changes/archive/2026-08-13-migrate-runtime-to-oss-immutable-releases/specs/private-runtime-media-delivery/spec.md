## ADDED Requirements

### Requirement: Media projection preserves object identity and legacy fallback
Each runtime media resource that exists in a verified release SHALL expose its immutable object key, SHA-256 digest and size alongside the legacy external URL when one exists. A resource without a published object SHALL retain the legacy URL behavior and SHALL be marked unavailable when neither a local/processed source nor a legacy URL exists.

#### Scenario: Published local media is projected
- **WHEN** a media index item maps to a file included in the active release manifest
- **THEN** its projection SHALL include the manifest-bound object key, digest and size and SHALL resolve playback through the private asset resolver.

#### Scenario: Only legacy media URL is available
- **WHEN** a media index item has no release object but has a legacy URL
- **THEN** its projection SHALL retain that URL as the fallback without inventing object metadata.

### Requirement: Private media resolver signs only manifest-bound assets
The server-side resolver SHALL accept only a normalized runtime media path that is present in the active release manifest and allowed for client delivery. It SHALL issue a short-lived signed redirect using in-process ECS RAM role credentials and SHALL not expose a permanent OSS URL, credentials, or arbitrary object-key access.

#### Scenario: Browser requests an authorized published media asset
- **WHEN** the requested media path is public-deliverable and manifest-bound
- **THEN** the resolver SHALL respond with a redirect to a time-limited OSS URL for that exact object.

#### Scenario: Browser requests a private, missing, or traversal path
- **WHEN** the requested path is private runtime data, absent from the manifest, malformed, or attempts traversal
- **THEN** the resolver SHALL reject the request without signing or disclosing an OSS object URL.

### Requirement: Media migration records unresolved sources
The migration inventory SHALL distinguish runtime-local files, authoring `processed` files, external URLs, and entries with no retrievable source. Downloading an external source SHALL be attempted only when no local or processed source exists, and failures SHALL remain explicitly unresolved.

#### Scenario: External source cannot be retrieved
- **WHEN** a media entry lacks local and processed files and its external source cannot be reliably downloaded and verified
- **THEN** the inventory SHALL mark the entry unresolved and SHALL not create a placeholder OSS object or a fabricated ready status.
