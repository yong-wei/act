## Purpose
Define Arena module import boundaries for domain, client, and server entrypoints.
## Requirements
### Requirement: Arena exposes explicit domain, client, and server entrypoints
The Arena feature SHALL provide separate `domain`, `client`, and `server` entrypoints for imports that cross application layers.

#### Scenario: Client UI import
- **WHEN** a client component or client hook imports Arena functionality
- **THEN** it MUST import from the Arena domain or client entrypoint and MUST NOT import server persistence or evaluator modules through the root barrel

#### Scenario: API route import
- **WHEN** an API route imports Arena persistence, official evaluation, or black-box services
- **THEN** it MUST import from the Arena server entrypoint or the direct server module path and MUST NOT import client components

### Requirement: Root barrel is compatibility only
The root Arena barrel SHALL NOT be the default import target for production code. During migration it MAY remain only as an explicitly time-bounded compatibility surface with an owner, known callers, replacement and deletion condition; once its production and supported operator callers reach zero, it SHALL be deleted. Explicit domain, client and server boundaries SHALL remain available wherever the current Arena contract requires them.

#### Scenario: Touched Arena import
- **WHEN** implementation modifies a file that previously imported from `@/features/arena`
- **THEN** the import MUST be narrowed to `@/features/arena/domain`, `@/features/arena/client`, `@/features/arena/server`, or a direct module path
- **AND** the deleted root barrel MUST NOT be reintroduced, including through dynamic imports.

#### Scenario: Root barrel has no supported callers
- **WHEN** static, dynamic, route, test and operator scans prove that no supported caller needs the root barrel
- **THEN** the root barrel SHALL be deleted with a zero-caller and rollback receipt
- **AND** the explicit client-safe/server-only boundaries SHALL continue to enforce their existing import rules.

#### Scenario: A server-only capability is imported from client code
- **WHEN** a client component or hook attempts to resolve Arena persistence, official evaluator, hidden scenario or server store through an alias
- **THEN** the boundary check SHALL reject the import
- **AND** preview UI SHALL remain limited to non-official display-safe data.

