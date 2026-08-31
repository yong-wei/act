# adaptive-entrypoint-retirement Specification

## Purpose
Defines deletion gates for leftover adaptive forwarding files, retired authorities, flags and shims after Assessment and Personalization callers have moved to canonical public APIs, including EvidenceOutbox consumer retention and ownership of shared historical storage.
## Requirements
### Requirement: Legacy adaptive entrypoints have a zero-production-import gate

Legacy adaptive entrypoints SHALL be deleted only after all predecessor Assessment and Personalization migrations are qualified at the intended revision and a current production import graph proves zero imports, dynamic loads, re-exports or active callers. A closed Issue, existing artifact or old review result SHALL NOT substitute for that evidence.

#### Scenario: A residual production import exists

- **WHEN** the inventory or architecture scan finds a production import, dynamic load or re-export of a retired adaptive entrypoint
- **THEN** retirement SHALL fail closed
- **AND** the entrypoint SHALL remain listed as unresolved debt until its caller is migrated and reverified.

#### Scenario: Only tests reference a retired symbol

- **WHEN** a retired symbol is referenced only by characterization fixtures or historical documentation
- **THEN** those references SHALL be classified explicitly
- **AND** they SHALL not justify retaining a production facade or authority.

### Requirement: Forwarders, flags and shims do not survive as a second authority

After canonical Assessment, learner-state, plugin, planner, recommendation and intervention APIs are active, the migration SHALL remove obsolete `adaptive-learning` forwarding files, `src/lib/adaptive-*` authorities, fallback helpers, retired feature flags and re-exports that can route production behavior around those APIs.

#### Scenario: The persistence flag is still false

- **WHEN** `ADAPTIVE_ASSESSMENT_PERSISTENCE_ENABLED` or an equivalent retired flag is present after durable cutover
- **THEN** it SHALL not select process-local or legacy behavior
- **AND** the flag/reference SHALL be removed or cause an explicit configuration error according to the ledger.

#### Scenario: The KAQ forwarding file has no consumer

- **WHEN** `src/features/adaptive-learning/kaq-quiz-coverage.ts` has no production consumer after migration
- **THEN** the forwarding file SHALL be deleted
- **AND** callers SHALL use the canonical Assessment capability directly.

### Requirement: Shared historical storage is preserved by ownership

Retirement MUST NOT delete an old Prisma table, immutable snapshot, LearningFact or historical path solely because its former adaptive entrypoint was removed. A retained table SHALL have a declared non-retired owner and no path around the canonical authority.

#### Scenario: A legacy table serves another domain

- **WHEN** a current non-adaptive domain still reads a legacy `Question` or `UserAnswer` table
- **THEN** the table and explicitly owned adapter MAY remain
- **AND** the retired adaptive authority SHALL not continue writing or exposing a competing attempt contract.

### Requirement: Legacy EvidenceOutbox consumers wait for the qualified replacement

An old `EvidenceOutbox` consumer SHALL remain registered until the new transactional `EvidenceOutbox → worker → LearningFact` protocol is qualified and the old consumer has zero production callers. Retirement MUST preserve cross-process evidence delivery during the transition and MUST NOT introduce a direct-plus-outbox double materialization path.

#### Scenario: The replacement outbox protocol is not qualified

- **WHEN** database-level dedupe/causation, worker-only materialization, crash-replay or privacy projection evidence is incomplete
- **THEN** the old outbox consumer SHALL remain in the owner/deprecation ledger
- **AND** retirement SHALL not delete it or claim that asynchronous learner evidence is closed.

#### Scenario: The replacement is qualified and the old consumer is unused

- **WHEN** the new protocol passes its qualification evidence and the current import/call graph shows zero production callers of the old consumer
- **THEN** the old consumer MAY be deleted
- **AND** the canonical worker SHALL remain the sole LearningFact materializer for the asynchronous path.

### Requirement: Retirement evidence is recorded and does not activate production

The owner/deprecation ledger SHALL record deleted paths, retained storage, predecessor qualification, current revision, import-graph result, tests and rollback reference. Retirement SHALL be a code and governance change only; it MUST NOT imply deployment, production selector activation or data deletion.

#### Scenario: Retirement is ready to archive

- **WHEN** all deletion gates and affected-domain verification pass
- **THEN** the change MAY be archived with its evidence and unresolved non-blocking risks
- **AND** no deployment or production activation SHALL be performed by this change.
