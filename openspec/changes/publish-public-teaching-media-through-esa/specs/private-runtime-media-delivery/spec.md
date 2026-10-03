## MODIFIED Requirements

### Requirement: Private media resolver signs only manifest-bound assets
The server-side resolver SHALL accept only a normalized runtime media path that is present in the active or requested fixed release manifest and allowed for client delivery. When the exact manifest-bound digest is present in an enabled, completely verified public teaching-media index, it SHALL redirect to that immutable ESA object. Otherwise it SHALL retain short-lived signed OSS delivery using in-process ECS RAM role credentials and the existing qualified filesystem fallback. It SHALL not expose credentials, arbitrary object-key access, a desired-but-not-active release object, or the reserved `.act-runtime-blobs` helper path.

#### Scenario: Browser requests an authorized published media asset
- **WHEN** the requested media path is public-deliverable and bound by the selected v1 or v2 manifest
- **THEN** the resolver SHALL redirect to the exact verified ESA object when qualified, otherwise to a time-limited OSS URL for that exact manifest object or the existing qualified fallback

#### Scenario: Browser requests a private, missing, or traversal path
- **WHEN** the requested path is private runtime data, absent from the selected manifest, malformed, attempts traversal, or exists only in a desired candidate
- **THEN** the resolver SHALL reject the request without signing or disclosing an object URL

#### Scenario: Classroom release differs from the active release
- **WHEN** the media request names a fixed published classroom release
- **THEN** the resolver SHALL resolve the digest from that fixed manifest and SHALL not substitute bytes from the active same-path resource
