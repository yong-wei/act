## MODIFIED Requirements

### Requirement: Active media and readiness bind one blob-backed manifest
The active runtime identity, active receipt, media resolver and readiness checks SHALL bind the same release ID, manifest version, semantic digest, wire digest and logical tree digest. A desired identity that diverges after a failed candidate SHALL not replace the active identity for readiness, developer discovery or media signing. When blob-backed runtime delivery is required and that binding succeeds, readiness SHALL expose a minimal active runtime projection containing only readiness state, manifest schema, Release ID, canonical manifest digest and logical tree digest. It SHALL NOT expose source revision, object keys, logical paths, mount paths, credentials, signed URLs or desired/candidate identities. The media resolver SHALL sign only a blob key allowlisted by that active manifest, SHALL not expose a permanent OSS URL, and SHALL retain legacy URL fallback when no active-manifest media object exists.

#### Scenario: Cross-release blob reuse preserves private media delivery
- **WHEN** two logical releases refer to the same media SHA-256
- **THEN** the resolver SHALL use the active release's allowlisted manifest binding and generate only a short-lived private redirect for the shared blob

#### Scenario: Valid active identity is projected for developer discovery
- **WHEN** the materialized v2 manifest and active receipt bind the same Release ID, manifest digest and logical tree digest
- **THEN** readiness SHALL report runtime ready and return only the allowlisted active identity fields with no cacheable response

#### Scenario: Stale selector identity fails readiness
- **WHEN** an active selector or receipt identifies a manifest digest different from the materialized runtime manifest
- **THEN** readiness SHALL fail, omit a usable runtime identity, and the system SHALL not report the candidate as active

#### Scenario: Desired candidate diverges from active
- **WHEN** a desired candidate exists but the active receipt still binds the prior verified Release
- **THEN** readiness SHALL project only the prior active identity and SHALL NOT reveal or select the desired candidate

#### Scenario: Blob-backed runtime is not required in ordinary local mode
- **WHEN** the application runs without configured blob-view delivery or an active receipt requirement
- **THEN** readiness SHALL mark the runtime probe as not required with no fabricated active identity and SHALL preserve the existing local readiness behavior
