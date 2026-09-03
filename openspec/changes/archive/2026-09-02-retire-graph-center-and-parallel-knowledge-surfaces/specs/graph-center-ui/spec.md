## MODIFIED Requirements

### Requirement: Knowledge graph compatibility is preserved
The `/knowledge` route SHALL be the sole canonical product knowledge workspace after Graph Center retirement. It SHALL continue to expose the existing active Authority read contract and its explicit, role-scoped diagnostic modes without importing or wrapping the retired Graph Center payload.

#### Scenario: Existing knowledge route is used
- **WHEN** an entitled student or teacher opens `/knowledge`
- **THEN** the existing active Authority knowledge workspace SHALL remain usable through its bounded server read path
- **AND** existing ResourceNode-aware launch, resource eligibility, role isolation, snapshot/hash and rollback contracts SHALL remain unchanged.

#### Scenario: Diagnostic mode is explicitly authorized
- **WHEN** an administrator opens an explicitly controlled candidate or legacy diagnostic mode
- **THEN** the workspace SHALL preserve the mode's own selector/hash identity and show a bounded diagnostic state
- **AND** it SHALL not present that mode as active Authority or expose it to an unauthorized student/teacher request.

#### Scenario: Retired Graph Center is requested
- **WHEN** a user requests the retired `/graph-center` route or an old Graph Center navigation entry
- **THEN** the application SHALL not render a Graph Center payload or a second graph runtime
- **AND** the supported migration target SHALL be the canonical `/knowledge` workspace or the existing role-owned destination.

## REMOVED Requirements

### Requirement: Graph center exposes read-only K/A/Q graph exploration
**Reason**: The route duplicated the canonical `/knowledge` Authority workspace and introduced a second payload and action owner.
**Migration**: Move required actions to `/knowledge` or an existing role-owned analysis surface, then remove `/graph-center`, `GraphCenterClient`, and its production navigation.

### Requirement: Graph center has accessible non-canvas fallback
**Reason**: Its list/detail fallback is part of the retired duplicate surface, not an independent authority.
**Migration**: Preserve accessible node/detail access through the existing `/knowledge` workspace and role-owned destinations; remove only tests that exclusively exercise the retired route.
