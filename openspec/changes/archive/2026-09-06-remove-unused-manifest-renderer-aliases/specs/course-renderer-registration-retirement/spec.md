## MODIFIED Requirements

### Requirement: Legacy renderer paths are deleted only at zero callers

After reusable capabilities and central consumers use the typed registry, old central renderer branches and compatibility entrypoints SHALL be removed when no required production, dynamic or bundle caller needs them. Tests that exercise supported behavior SHALL remain; tests that only preserve a retired implementation SHALL be removed or updated rather than requiring that implementation to survive. No permanent forwarding facade or second global registry SHALL remain. Existing focused tests and the change description SHALL document the result without requiring a separate retirement ledger.

#### Scenario: The legacy inventory is empty

- **WHEN** all required old-renderer callers use existing replacements or no longer exist
- **THEN** the old branches and entrypoints SHALL be deleted
- **AND** existing focused tests SHALL verify the supported replacement behavior.

#### Scenario: A hidden caller remains

- **WHEN** a route, supported dynamic input, bundle or test representing a current user behavior still needs the old renderer
- **THEN** that renderer SHALL be retained or its caller migrated before deletion
- **AND** unrelated unused branches SHALL remain independently removable.

#### Scenario: Legacy taxonomy remains useful without render handlers

- **WHEN** a legacy kind is still needed for input normalization, rejection or a course payload discriminator
- **THEN** that metadata SHALL remain even when its unused central handler is deleted
- **AND** missing plugin identities SHALL retain the existing explicit missing-renderer behavior.
