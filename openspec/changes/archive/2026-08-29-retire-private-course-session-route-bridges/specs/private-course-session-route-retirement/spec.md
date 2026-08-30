# private-course-session-route-retirement Specification

## Purpose

Define evidence-gated, denominator-closed retirement of runtime-first private
course routes, title bridges, direct session producers, and legacy renderer
consumers after a shared-shell pilot is qualified.

## ADDED Requirements

### Requirement: Retirement requires a qualified pilot and frozen denominator

No private route/bridge batch SHALL begin until a shared-shell pilot is
qualified and a revision-bound inventory covers every runtime-first family,
private route, alias, session producer, manifest renderer consumer, and browser
entry.

#### Scenario: A pilot receipt is absent

- **WHEN** a retirement batch is proposed without a qualified pilot receipt
- **THEN** the batch MUST remain blocked
- **AND** no private route or renderer may be deleted.

#### Scenario: The denominator is incomplete

- **WHEN** the inventory omits a dynamic caller, alias, test, or browser entry
- **THEN** qualification MUST fail with the missing class named
- **AND** the approximate 32-family/approximately-96-route observation MUST NOT
  be treated as a complete denominator.

### Requirement: Each batch migrates callers before deleting private routes

For each qualified batch, all canonical links and static/dynamic/test/browser
callers SHALL move to canonical identity, shared classroom session use cases,
immutable bundle binding, and registered plugins before the private route or
bridge is deleted.

#### Scenario: A batch reaches zero private callers

- **WHEN** the batch inventory proves zero authoritative private callers
- **THEN** the old route/bridge MUST be deleted in the same qualified revision
- **AND** the ledger MUST record replacement identity, consumer-zero evidence,
  and removal receipt.

#### Scenario: A direct session producer remains

- **WHEN** any batch caller still creates/reads a session through a private
  route/service or title fallback
- **THEN** route retirement MUST be blocked
- **AND** the caller MUST be migrated before deletion.

### Requirement: Retired private routes are not permanent redirects

After deletion, a private course path SHALL use the repository's explicit
not-found behavior. The implementation MUST NOT add a permanent redirect,
fallback page, or hidden alias that preserves the old private authority.

#### Scenario: A user opens a retired private path

- **WHEN** a retired route URL is requested
- **THEN** it MUST not expose a classroom or redirect to another course
- **AND** the canonical shared-shell entry remains the only supported path.

#### Scenario: A browser link still points to the private path

- **WHEN** a known navigation or test link references a retired route
- **THEN** the batch MUST remain unqualified until the link is migrated or
  explicitly removed
- **AND** a redirect MUST NOT be used to conceal the stale caller.

### Requirement: Title aliases cannot determine classroom identity

Canonical identity aliases MAY remain only as explicitly recorded bounded ingress
metadata with a canonical target and deletion condition. A mutable plan title or
title-to-private-route alias MUST NOT determine a new classroom bundle/session.

#### Scenario: A bounded legacy alias is used

- **WHEN** an inventoried alias resolves a request during migration
- **THEN** it MUST resolve to one canonical lesson/bundle identity
- **AND** the alias, owner, consumers, and retirement condition MUST be recorded.

#### Scenario: A title matches multiple lessons or changes after launch

- **WHEN** a title is ambiguous or changes after a session is created
- **THEN** identity resolution MUST fail or use the captured canonical binding
- **AND** it MUST NOT select a private route or another lesson by similarity.

### Requirement: Legacy renderer retirement is consumer-gated

The lowercase lesson-engine `resource-renderer.tsx` SHALL remain the current
mainline. The uppercase legacy `ResourceRenderer.tsx` SHALL be deleted only when
source, runtime, test, and browser inventories prove zero consumers and its
retirement gate passes.

#### Scenario: An uppercase consumer remains

- **WHEN** any route, component, test, or generated-courseware path imports or
  reaches `ResourceRenderer.tsx`
- **THEN** uppercase renderer deletion MUST be blocked
- **AND** the consumer MUST remain visible in the ledger.

#### Scenario: Uppercase consumer count is zero

- **WHEN** all consumers use the lowercase mainline or an approved plugin/public
  capability
- **THEN** the uppercase renderer MAY be deleted with a removal receipt
- **AND** no forwarding export may be added to preserve it.

### Requirement: Retirement is monotonic and recoverable

Each batch SHALL remove private entries or replace them with compliant public
paths and MUST NOT add a new bridge, broaden an alias, or reduce the denominator.
Every deletion SHALL have a source revision, replacement, owner, evidence, and
rollback note.

#### Scenario: A later batch proposes a new compatibility bridge

- **WHEN** a migration cannot proceed without a new redirect/facade/alias
- **THEN** the batch MUST block until the contract and deletion condition are
  explicitly reviewed
- **AND** a permanent compatibility layer MUST NOT be accepted by default.

#### Scenario: A deleted route needs incident recovery

- **WHEN** an incident requires restoring a removed route
- **THEN** recovery MUST use the recorded revision and mark the path as a
  temporary ledger exception
- **AND** it MUST not alter existing session/evidence identity.

### Requirement: Final retirement reaches private-bridge zero

The final retirement ledger SHALL show zero private course session routes,
zero title-to-private-route bridges, zero direct private session producers, and
zero uppercase legacy renderer consumers, while retaining canonical runtime
identity and the lowercase resource renderer.

#### Scenario: Final inventory is evaluated

- **WHEN** all batches and the uppercase renderer gate are complete
- **THEN** the final inventory MUST reconcile filesystem, AST, registries, tests,
  and browser entries to the zero conditions
- **AND** any remaining compatibility alias MUST be explicitly classified as
  bounded ingress rather than a private route bridge.

#### Scenario: A private bridge is still reachable

- **WHEN** a route, redirect, alias, or browser path can still enter a private
  session authority
- **THEN** final qualification MUST fail
- **AND** the remaining entry MUST be assigned a migration owner and deletion
  condition.

### Requirement: Every batch passes domain and browser verification

Each batch SHALL run identity/route drift, no-redirect, private-producer,
manifest/plugin, renderer-consumer, affected Classroom/Interactive, typecheck,
and browser tests. Strict OpenSpec validation and `git diff --check` MUST run at
each qualified revision.

#### Scenario: Canonical and retired links are tested

- **WHEN** teacher/student canonical links and retired private links are opened
- **THEN** canonical links MUST load the shared shell and retired links MUST not
  be exposed or redirected
- **AND** refresh/reconnect, title changes, and optional media/card failure MUST
  preserve the characterized contract.

#### Scenario: A batch ledger is incomplete

- **WHEN** owner, denominator, deletion condition, browser artifact, or removal
  receipt is missing
- **THEN** the batch MUST remain unqualified
- **AND** later batches MUST NOT treat it as retired.
