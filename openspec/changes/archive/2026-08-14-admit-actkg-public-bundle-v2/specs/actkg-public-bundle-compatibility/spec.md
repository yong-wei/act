## ADDED Requirements

### Requirement: Standard Bundle protocol majors use isolated adapters

The standard Bundle router MUST dispatch a validated Manifest declaration to
the separately registered v1 or v2 adapter. The v1 registry, accepted Schema
identity, Artifact contracts, normalized output, and negative behavior MUST
remain unchanged when v2 support is installed.

#### Scenario: A historical v1 package is routed after v2 support is added

- **WHEN** a package declares `actkg-public-bundle/1`
- **THEN** the router SHALL invoke only the existing v1 adapter and SHALL
  preserve the prior acceptance or rejection result

#### Scenario: A future unregistered protocol is declared

- **WHEN** a Manifest declares neither a registered v1 nor registered v2 contract
- **THEN** the router MUST reject it as adapter-required without guessing the closest version
