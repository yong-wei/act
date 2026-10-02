## MODIFIED Requirements

### Requirement: Private media resolver signs only manifest-bound assets
The server-side resolver SHALL accept only a normalized runtime media path present in the selected active or explicitly pinned release manifest and allowed for client delivery. It SHALL resolve that manifest's exact digest and byte size through the approved canonical storage directory. Qualified public teaching bytes MAY use the existing ESA URL; other requests SHALL use a short-lived OSS signature or authorized internal filesystem read. The resolver SHALL not disclose credentials, arbitrary object keys, private bodies, candidate-only objects or reserved helper paths. Changing another Runtime file SHALL not invalidate delivery of an unchanged qualified digest. Disabling ESA SHALL preserve internal access to the canonical body without restoring duplicate storage.

#### Scenario: Browser requests an authorized published media asset
- **WHEN** its selected manifest binding and canonical public qualification agree on the exact body
- **THEN** the resolver SHALL serve that body through ESA or its canonical OSS fallback

#### Scenario: Browser requests a private, missing, or traversal path
- **WHEN** the path is private runtime data, absent from the selected manifest, malformed, traverses a helper, or exists only in a candidate
- **THEN** the resolver SHALL reject it without signing or disclosing a body URL

#### Scenario: A Runtime update leaves a media digest unchanged
- **WHEN** only unrelated selected files change
- **THEN** the unchanged qualified media SHALL keep using the same immutable canonical object

#### Scenario: A classroom uses an older media digest
- **WHEN** its pinned manifest binds a different digest from the current path
- **THEN** delivery SHALL use the pinned digest and SHALL NOT replace it with the current media

#### Scenario: ESA delivery is disabled after migration
- **WHEN** the canonical directory remains valid but public redirects are disabled
- **THEN** internal reads and short-lived signatures SHALL still resolve the relocated body without requiring an old private-bucket copy
