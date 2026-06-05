## ADDED Requirements

### Requirement: Dual theme templates expose complete token roles
The design system SHALL expose complete token roles for both light and dark commercial templates.

#### Scenario: A primary surface uses theme tokens
- **WHEN** a public, learning, workspace, knowledge, data, teacher, admin, or report surface renders
- **THEN** it SHALL use governed token roles for canvas, surface-1, surface-2, elevated, hairline, trace accent, muted accent, danger, success, focus ring, evidence, and report output
- **AND** it SHALL NOT use undocumented Tailwind color families or raw gradients as a replacement for those roles.

### Requirement: Dual templates are structurally distinct commercial modes
The design system SHALL treat light and dark as two first-class commercial templates rather than a color inversion of the same card layout.

#### Scenario: Theme parity is reviewed
- **WHEN** a route is accepted in both light and dark themes
- **THEN** the light template SHALL express engineering chart paper, daylight instrument surfaces, readable traces, and matte evidence layers
- **AND** the dark template SHALL express night bridge canvas, low-light instruments, controlled trace illumination, and signal status layers.

### Requirement: Page-local accent palettes are prohibited on representative routes
Representative commercial routes SHALL not introduce unmanaged page-local accent palettes during redesign.

#### Scenario: Representative route is changed
- **WHEN** a representative route adds visual classes, gradients, badges, charts, or status colors
- **THEN** raw accent families such as `slate`, `cyan`, `amber`, `violet`, `fuchsia`, or route-local gradients SHALL be mapped to approved token roles
- **AND** commercial UI governance SHALL reject silent reintroduction of local palettes.

### Requirement: Legacy visual namespaces have explicit mapping or retirement
The design system SHALL track whether legacy visual namespaces map to the dual templates or must be retired.

#### Scenario: Legacy namespace is encountered
- **WHEN** `interactive-course-hub-*`, `admin-console-*`, `premium-lesson-*`, `surface-card`, or page-local visual classes are touched during redesign
- **THEN** the change SHALL map them to approved token roles or mark them for retirement
- **AND** silent long-term coexistence SHALL be rejected.
