## ADDED Requirements

### Requirement: Governed browser capture binds service and dock readiness
Commercial UI browser capture for a route with a shared floating Dock SHALL bind each run to an explicit reachable service URL and the current clean source input. The runner SHALL wait for the route's required Dock control to be observable in its required enabled or disabled state before it writes a screenshot or manifest. A missing URL, unreachable service, missing Dock control, or readiness timeout SHALL fail the capture without producing accepted evidence.

#### Scenario: Adaptive-path capture waits for shared Dock registration
- **WHEN** the adaptive-path product QA runner captures a state that requires the disabled Konling Dock
- **THEN** it SHALL wait for the shared Dock primary trigger to be visible and disabled before taking the screenshot
- **AND** it SHALL fail with the target URL and observable Dock state if that condition is not reached.

#### Scenario: Capture service is not the declared target
- **WHEN** the runner has no explicit reachable target service URL
- **THEN** it SHALL fail before accepting a capture
- **AND** it SHALL NOT silently use a different local server or historical port.
