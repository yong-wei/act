# adaptive-entrypoint-retirement Specification

## Purpose
Defines deletion gates for leftover adaptive forwarding files, retired authorities, flags and shims after Assessment and Personalization callers have moved to canonical public APIs, including EvidenceOutbox consumer retention and ownership of shared historical storage.
## Requirements
### Requirement: Legacy adaptive entrypoints have a zero-production-import gate

Legacy adaptive entrypoints SHALL be deleted only after all predecessor Assessment and Personalization migrations are qualified at the intended revision and a current production import graph proves zero imports, dynamic loads, re-exports or active callers. A closed Issue, existing artifact or old review result SHALL NOT substitute for that evidence. For the current-head retirement tranche, the denominator SHALL be the exact 29 production paths listed by the change design and tasks: 10 paths under `src/features/adaptive/` and 19 paths under `src/lib/adaptive-*` or `src/lib/adaptive-planning/`.

#### Scenario: A residual production import exists

- **WHEN** the inventory or architecture scan finds a production import, dynamic load or re-export of a retired adaptive entrypoint
- **THEN** retirement SHALL fail closed
- **AND** the entrypoint SHALL remain listed as unresolved debt until its caller is migrated and reverified.

#### Scenario: Only tests reference a retired symbol

- **WHEN** a retired symbol is referenced only by characterization fixtures or historical documentation
- **THEN** those references SHALL be classified explicitly
- **AND** they SHALL not justify retaining a production facade or authority.

#### Scenario: The current-head denominator is incomplete

- **WHEN** any of the 29 in-scope production paths lacks a consumer scan, owner classification, or deletion condition at the intended revision
- **THEN** the retirement tranche SHALL remain unqualified
- **AND** a count of zero for the other paths SHALL not substitute for the missing record.

### Requirement: Forwarders, flags and shims do not survive as a second authority

After canonical Assessment, learner-state, plugin, planner, recommendation and intervention APIs are active, the migration SHALL remove obsolete `adaptive-learning` forwarding files, `src/lib/adaptive-*` authorities, fallback helpers, retired feature flags and re-exports that can route production behavior around those APIs. The current-head mapping SHALL assign each retained path to Assessment, Personalization, Learning Record, or presentation/tooling ownership; a top-level adaptive path SHALL not remain a business owner.

#### Scenario: The persistence flag is still false

- **WHEN** `ADAPTIVE_ASSESSMENT_PERSISTENCE_ENABLED` or an equivalent retired flag is present after durable cutover
- **THEN** it SHALL not select process-local or legacy behavior
- **AND** the flag/reference SHALL be removed or cause an explicit configuration error according to the ledger.

#### Scenario: The KAQ forwarding file has no consumer

- **WHEN** `src/features/adaptive-learning/kaq-quiz-coverage.ts` has no production consumer after migration
- **THEN** the forwarding file SHALL be deleted
- **AND** callers SHALL use the canonical Assessment capability directly.

#### Scenario: A current adaptive path has a canonical owner

- **WHEN** a current adaptive path is used by a production route, worker, or tool
- **THEN** its caller SHALL import the declared Assessment, Personalization, Learning Record, or owner-specific presentation/tooling boundary
- **AND** the old adaptive path SHALL be deleted after the zero-production-import gate passes rather than retained as a second authority.

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

The owner/deprecation ledger SHALL record deleted paths, retained storage, predecessor qualification, current revision, import-graph result, tests and rollback reference. Retirement SHALL be a code and governance change only; it MUST NOT imply deployment, production selector activation or data deletion. For this tranche, the record SHALL include the exact path identity, current consumer classification, replacement owner, deletion condition, and scan revision for every in-scope path.

#### Scenario: Retirement is ready to archive

- **WHEN** all deletion gates and affected-domain verification pass
- **THEN** the change MAY be archived with its evidence and unresolved non-blocking risks
- **AND** no deployment or production activation SHALL be performed by this change.

#### Scenario: Deletion evidence is stale or incomplete

- **WHEN** a path's import graph, consumer list, or predecessor qualification does not match the intended revision
- **THEN** that path SHALL remain retained and unresolved
- **AND** the change SHALL not claim a complete adaptive retirement.

### Requirement: Current adaptive ownership and deletion set are reconciled

The current-head retirement tranche SHALL reconcile the exact 29 production paths in one owner/deprecation record set: the 10 files under `src/features/adaptive/` and the 19 files under `src/lib/adaptive-*` or `src/lib/adaptive-planning/`. Every record SHALL identify its canonical owner, all production/test/tooling consumers, replacement boundary, deletion condition, retained historical state, and rollback reference.

#### Scenario: The in-scope path set is captured

- **WHEN** the implementation inventories the current revision
- **THEN** it SHALL account for every path in the following set without substituting a directory-only count:
  - `src/features/adaptive/adaptive-learning-center-contracts.ts`
  - `src/features/adaptive/adaptive-path-correction-outcomes.ts`
  - `src/features/adaptive/adaptive-path-journey-contracts.ts`
  - `src/features/adaptive/adaptive-path-journey-control.tsx`
  - `src/features/adaptive/adaptive-path-timeline.tsx`
  - `src/features/adaptive/adaptive-path-unlock-chain-view.tsx`
  - `src/features/adaptive/cold-start-collection-panel.tsx`
  - `src/features/adaptive/diagnosis-surface-panel.tsx`
  - `src/features/adaptive/path-advisor-entrypoint-bridge.tsx`
  - `src/features/adaptive/path-workspace-module.tsx`
  - `src/lib/adaptive-cold-start-detection.ts`
  - `src/lib/adaptive-generation-readiness.ts`
  - `src/lib/adaptive-learning-optimization-experiments.ts`
  - `src/lib/adaptive-path-candidate-batches.ts`
  - `src/lib/adaptive-path-candidate-limitation-copy.ts`
  - `src/lib/adaptive-path-comparison.ts`
  - `src/lib/adaptive-path-correction-decisions.ts`
  - `src/lib/adaptive-path-decision-evidence.ts`
  - `src/lib/adaptive-path-destination-contract.ts`
  - `src/lib/adaptive-path-execution-state.ts`
  - `src/lib/adaptive-path-generation-panel.ts`
  - `src/lib/adaptive-path-goal-options-client.ts`
  - `src/lib/adaptive-path-goal-options.ts`
  - `src/lib/adaptive-path-node-decisions.ts`
  - `src/lib/adaptive-path-option-display.ts`
  - `src/lib/adaptive-path-round-restore.ts`
  - `src/lib/adaptive-path-unlock-chain.ts`
  - `src/lib/adaptive-planning/item-type-terminal-validation.ts`
  - `src/lib/adaptive-planning/path-constraint-repair.ts`
  - `src/lib/adaptive-planning/resource-ranker.ts`

#### Scenario: A current production consumer is migrated

- **WHEN** a route, worker, script, or dynamic loader reaches one of the exact paths
- **THEN** the record SHALL name the canonical owner and replacement import/API at the same revision
- **AND** deletion SHALL wait until a post-migration scan proves zero production reachability.

#### Scenario: A path is retained for history or another owner

- **WHEN** a path or storage object still has a non-retired consumer or rollback obligation
- **THEN** the record SHALL mark it retained with that owner, consumer, and expiry/deletion condition
- **AND** retention SHALL not expose a competing adaptive business authority.

