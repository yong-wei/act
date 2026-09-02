# platform-composition-read-model Specification

## Purpose
TBD - created by archiving change consolidate-platform-composition-read-models-and-retire-legacy-bridges. Update Purpose after archive.
## Requirements
### Requirement: Platform composition surfaces keep established owners and boundaries

Existing platform composition surfaces (AppShell, role navigation, role workspace shells, platform UI contracts) SHALL retain their established owner boundaries: server-authorized role filtering before client rendering, preserved source owner and revision identity, and no copied business truth.

#### Scenario: Student and teacher request the same surface

- **WHEN** the same platform composition is requested under different authorized roles
- **THEN** each role SHALL receive only its permitted projection and fields
- **AND** teacher-only, provider, audit, raw answer, or private evidence data SHALL not leak into student output.

#### Scenario: A source revision drifts

- **WHEN** one input projection has a source/release/manifest/revision identity different from the requested composition context
- **THEN** the read model SHALL report the mismatch or unavailable state
- **AND** it SHALL not silently join stale and current facts.

### Requirement: AppShell, SSR, and R3F boundaries remain unchanged

Read-model consolidation SHALL preserve existing authentication, authorization, AppShell/role workspace ownership, server/client rendering boundary, hydration behavior, and R3F dynamic-loading contract.

#### Scenario: A server-rendered page composes platform data

- **WHEN** an authorized SSR page or server action loads a platform projection
- **THEN** authorization and source identity SHALL be resolved before client rendering
- **AND** the client shell SHALL not bypass the server boundary to fetch privileged domain internals.

#### Scenario: A surface loads an R3F resource

- **WHEN** a composed projection includes an interactive R3F or browser-only resource
- **THEN** the existing dynamic boundary and loading/error state SHALL be used
- **AND** composition refactoring SHALL not move R3F dependencies into SSR or replace the established shell.

### Requirement: Legacy composition bridges are retired without changing behavior

Duplicate mappers, aliases, route-local read models, and legacy bridges SHALL be deleted only after before/after evidence proves equivalent output, ordering, cache/refresh, errors, side effects, and role/privacy behavior; any retained adapter MUST be non-authoritative and have a deletion condition.

#### Scenario: A bridge has no remaining caller

- **WHEN** static and runtime inventory shows a bridge is unused after migration
- **THEN** it SHALL be deleted
- **AND** no second composition store or fallback authority SHALL replace it.

#### Scenario: Before/after behavior differs

- **WHEN** a candidate deletion changes an observable projection or failure state
- **THEN** the deletion SHALL be rejected or revised
- **AND** tests SHALL not be weakened to make the simplification pass.

### Requirement: Platform composition is read-only and not an AI or release authority

The composition layer SHALL not persist domain facts, LearningFacts, knowledge relations, AI memory, publication state, or production selector changes, and SHALL not treat AI output as authoritative input.

#### Scenario: A composed AI projection contains a recommendation

- **WHEN** the read model includes AI advice, candidate text, or assistant metadata
- **THEN** it SHALL remain advisory and source-attributed
- **AND** it SHALL not be used to authorize a domain write, publication, or learner conclusion.

#### Scenario: A release or rollback status is composed

- **WHEN** platform UI reads release/rollback status
- **THEN** it SHALL consume the existing validator/selector projection
- **AND** composition SHALL not introduce another security validator or mutate a selector.

