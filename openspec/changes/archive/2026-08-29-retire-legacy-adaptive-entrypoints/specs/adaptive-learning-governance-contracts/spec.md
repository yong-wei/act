## ADDED Requirements

### Requirement: Adaptive series governance includes dependency and entrypoint closure

An adaptive Assessment/Personalization series SHALL keep proposal, implementation, tests, archive and Issue state truthful at the same current revision. Entrypoint retirement MUST be blocked while a predecessor is unqualified or while any production caller still reaches a superseded authority.

#### Scenario: GitHub and local artifact states disagree

- **WHEN** an Issue is closed or archived but local tasks, implementation or publication evidence is incomplete
- **THEN** governance SHALL report the change as unresolved or partial
- **AND** it SHALL not use the Issue state to authorize retirement or publication.

#### Scenario: A legacy route remains reachable

- **WHEN** a route or worker can still bypass the canonical Assessment/Personalization public API
- **THEN** the dependency contract SHALL keep the legacy entrypoint active in the ledger
- **AND** retirement SHALL not be qualified until the caller is migrated and the import graph is clean.
