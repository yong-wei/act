## ADDED Requirements

### Requirement: Governed browser capture binds service and dock readiness
Commercial UI browser capture for a route with a shared floating Dock SHALL bind each run to an explicit reachable service URL and the current clean source input. The runner SHALL obtain a no-store, development-only revision proof from that target service before and after capture, and SHALL reject any missing, dirty, malformed, changed, or non-matching commit, tree, or fixed source fingerprint. For a capture state that requires an observable Dock, the runner SHALL wait for the required Dock control to be observable in its required enabled or disabled state before it writes that state’s screenshot. A missing URL, unreachable service, missing required Dock control, proof mismatch, or readiness timeout SHALL fail the capture without producing accepted evidence.
The runner SHALL stage screenshots and capture metadata only in a system temporary directory until the pre/post service proofs and local final proof pass. Product evidence SHALL be published only below the versioned `artifacts/commercial-ui/adaptive-path-product-qa-516` root, using a caller-supplied relative subpath that cannot escape the root or traverse a symbolic link. Before publication, it SHALL re-check every staged file hash and perform an atomic sibling replacement with restoration on failure. Capture manifests SHALL contain repository-relative logical artifact paths and SHALL NOT contain temporary or absolute local filesystem paths.

#### Scenario: Adaptive-path capture waits for shared Dock registration
- **WHEN** the adaptive-path product QA runner captures a state that requires the disabled Konling Dock
- **THEN** it SHALL wait for the shared Dock primary trigger to be visible and disabled before taking the screenshot
- **AND** it SHALL fail with the target URL and observable Dock state if that condition is not reached.

#### Scenario: Capture service is not the declared target
- **WHEN** the runner has no explicit reachable target service URL
- **THEN** it SHALL fail before accepting a capture
- **AND** it SHALL NOT silently use a different local server or historical port.

#### Scenario: Target service is not the runner revision
- **WHEN** the target service revision proof differs from the runner's current clean commit, tree, or fixed source fingerprint
- **THEN** the runner SHALL fail before writing accepted evidence
- **AND** production services SHALL not expose the revision proof.

### Scenario: Product capture publication is transactional
- **WHEN** a capture completes its browser states and all revision proofs match
- **THEN** the runner SHALL verify the staged file hashes before replacing the configured product evidence directory
- **AND** a failed copy, hash check, or rename SHALL restore the previous directory rather than leave a partial capture
- **AND** the manifest SHALL contain only paths below the versioned product evidence root.
