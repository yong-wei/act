## MODIFIED Requirements

### Requirement: Media projection preserves object identity and legacy fallback
Each runtime media resource that exists in a verified active v1 or v2 release SHALL expose its active-manifest object key, SHA-256 digest and size alongside the legacy external URL when one exists. A v2 object key SHALL be the manifest-derived blob key, not a client-supplied or arbitrary OSS key. A resource without a published active-manifest object SHALL retain the legacy URL behavior and SHALL be marked unavailable when neither a local/processed source nor a legacy URL exists.

#### Scenario: Published local media is projected
- **WHEN** a media index item maps to a file included in the active v1 or v2 release manifest
- **THEN** its projection SHALL include the active manifest-bound object key, digest and size and SHALL resolve playback through the private asset resolver

#### Scenario: Only legacy media URL is available
- **WHEN** a media index item has no active-manifest object but has a legacy URL
- **THEN** its projection SHALL retain that URL as the fallback without inventing object metadata

### Requirement: Private media resolver signs only manifest-bound assets
The server-side resolver SHALL accept only a normalized runtime media path that is present in the active release manifest and allowed for client delivery. It SHALL issue a short-lived signed redirect using in-process ECS RAM role credentials and SHALL not expose a permanent OSS URL, credentials, arbitrary object-key access or a desired-but-not-active release object.

#### Scenario: Browser requests an authorized published media asset
- **WHEN** the requested media path is public-deliverable and bound by the active v1 or v2 manifest
- **THEN** the resolver SHALL respond with a redirect to a time-limited OSS URL for that exact manifest object

#### Scenario: Browser requests a private, missing, or traversal path
- **WHEN** the requested path is private runtime data, absent from the active manifest, malformed, attempts traversal, or exists only in a desired candidate
- **THEN** the resolver SHALL reject the request without signing or disclosing an OSS object URL
