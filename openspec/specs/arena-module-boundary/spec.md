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
The root Arena barrel MAY remain for existing compatibility but SHALL NOT be the default import target for new or touched code.

#### Scenario: Touched Arena import
- **WHEN** implementation modifies a file that imports from `@/features/arena`
- **THEN** the import MUST be narrowed to `@/features/arena/domain`, `@/features/arena/client`, `@/features/arena/server`, or a direct module path unless the file is itself a compatibility barrel
