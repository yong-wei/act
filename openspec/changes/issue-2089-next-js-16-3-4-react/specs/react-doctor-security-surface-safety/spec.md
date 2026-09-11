## Purpose

Define security constraints for React Doctor owned-surface inline markup and iframe diagnostics.

## MODIFIED Requirements

### Requirement: Inline markup is constrained

Root layout and handout print inline markup SHALL be replaced with safer constructs or constrained to audited static content.

#### Scenario: Theme initialization runs

- **WHEN** the root layout initializes theme state before hydration
- **THEN** the implementation SHALL emit exactly one audited `#theme-init` script whose body is `buildThemeInitScript()` from trusted project constants
- **AND** that script SHALL use `dangerouslySetInnerHTML` so React 19 executes it as an inline script rather than as React children
- **AND** it SHALL NOT import or render `next/script`
- **AND** it SHALL NOT pass the script body as React children
- **AND** it SHALL avoid arbitrary user-controlled HTML or script injection
- **AND** a stored or system theme SHALL apply before first paint, and theme switching SHALL continue without hydration mismatch
- **AND** the owned-surface security gate SHALL remain clean without deleting pre-hydration theme initialization

#### Scenario: Handout print styles render

- **WHEN** a lesson handout print page renders CSS for print formatting
- **THEN** style content SHALL come from trusted static project code
- **AND** user-provided lesson content SHALL NOT be interpolated into inline markup
