# versioned-knowledge-surface-read-contracts Specification

## Purpose

Define one server-side, version-bound public read contract over the existing authoritative repository and bounded shards without creating a second read model or mixing authority states.

## ADDED Requirements

### Requirement: Every response carries an Authority envelope

Every public knowledge-surface response SHALL carry its contract version, surface identity, mode, role-safe scope, and exact Authority snapshot/release identity. A response containing teaching or resource content SHALL additionally carry the matching Teaching Projection identity, scope identity, RegistryIndex identity, and applicable capture/revision identity.

#### Scenario: Engineering detail has no teaching block

- **WHEN** a valid active Engineering node/detail is requested without teaching/resource content
- **THEN** the response SHALL bind the selected Authority snapshot/release
- **AND** it MAY omit Teaching Projection/resource identities as not applicable
- **AND** it SHALL not invent a teaching identity.

#### Scenario: Teaching content is included

- **WHEN** a card, relation, textbook/media binding, or launch descriptor is returned
- **THEN** every included block SHALL match the Authority, exact Teaching Projection, scope, RegistryIndex, and capture/revision envelope
- **AND** rows from another envelope SHALL not be joined or relabeled.

### Requirement: Authority modes remain isolated and server-resolved

The read contract SHALL distinguish `active`, `legacy`, and explicitly authorized admin `candidate` modes in authorization, resolver, cache, and response fields. Clients MUST NOT select a release, snapshot, projection, RegistryIndex, or manifest identity through URL, query, local state, cache parameter, or response rewriting.

#### Scenario: Normal active request is made

- **WHEN** a normal user requests a bounded active surface
- **THEN** the server SHALL resolve the committed active Authority identity
- **AND** it SHALL not accept a candidate or Legacy identity supplied by the client.

#### Scenario: Admin requests a candidate diagnostic

- **WHEN** an authorized admin explicitly requests a candidate diagnostic
- **THEN** the response SHALL be marked candidate and retain its exact candidate identity
- **AND** it SHALL not be returned through the normal active route or cache.

#### Scenario: Mode changes in a cache

- **WHEN** active, Legacy, and candidate payloads have compatible fields
- **THEN** cache keys SHALL still isolate mode, role/scope, Authority identity, and applicable projection identities
- **AND** a payload from one mode SHALL not satisfy another mode.

### Requirement: Mismatched optional teaching/resource blocks fail locally

If an optional Teaching Projection, resource index, card, media, or launch binding is missing, stale, unauthorized, or identity-mismatched, the server SHALL omit only the affected block or return a bounded safe status. Valid Engineering nodes, verification relations, base detail, and unrelated matching blocks SHALL remain readable.

#### Scenario: Teaching Projection does not match Authority

- **WHEN** a Teaching Projection release, hash, scope, capture, or RegistryIndex differs from the selected Authority envelope
- **THEN** the affected teaching/resource block SHALL be omitted or marked unavailable
- **AND** the response SHALL not merge, adapt, or fall back to the mismatched projection.

#### Scenario: Optional media is absent

- **WHEN** an optional card or media artifact is unavailable but the base node and Authority are valid
- **THEN** the response SHALL preserve base node/detail content and a safe status for that block
- **AND** it SHALL not claim complete teaching coverage.

### Requirement: Resource launches use source-owned descriptors

A public response MAY include only a role-authorized, revision-matching source-owned launch descriptor with safe display metadata. It MUST NOT construct a route from a Canonical or ResourceNode identity or expose component paths, filesystem paths, object keys, signed URLs, raw bodies, hidden review data, or evaluation payloads.

#### Scenario: User launches a bound resource

- **WHEN** a user activates a descriptor from a knowledge surface
- **THEN** the existing source-owned launcher SHALL resolve the target and recheck role, scope, authorization, and revision
- **AND** the knowledge read contract SHALL not absorb the launcher's business logic.

#### Scenario: Descriptor is unauthorized or stale

- **WHEN** the descriptor is outside the current role/scope or its source/revision identity drifts
- **THEN** the server SHALL omit it or return a bounded unavailable action
- **AND** it SHALL not disclose the hidden target or construct a guessed URL.

### Requirement: Learning-content manifest and rich-text versions are strict

The v2 knowledge reader SHALL accept only `act-authority-learning-content-manifest/v2` with matching Authority/shard identities and SHALL delegate rich-text/math fields to the existing #1543 governed presentation contract. It MUST NOT silently convert or synthesize content from v1, raw Markdown, raw LaTeX, another release, or a client cache.

#### Scenario: v1 manifest reaches a v2 reader

- **WHEN** `authority-learning-content-manifest/v1` or an otherwise incompatible manifest is supplied to the v2 reader
- **THEN** the affected learning-content block SHALL be unavailable or omitted with a bounded version-drift reason
- **AND** the reader SHALL not present it as governed teaching content.

#### Scenario: Governed rich text matches

- **WHEN** #1543 provides a same-release, locale-qualified rich-text/math projection
- **THEN** the response SHALL preserve its release, locale, math-slot, readiness, and bounded-surface identity
- **AND** this change SHALL not parse, rewrite, or maintain a second math/presentation registry.

### Requirement: Bounded shards remain bounded

The common read contract SHALL preserve root, domain, relation-family, neighborhood, search, and detail boundaries. Normal loading MUST NOT fetch a full Authority graph or global remaining shard, and clients MUST NOT join complete release rich-text/math indexes.

#### Scenario: User enters a domain

- **WHEN** a user requests a domain or relation-family surface
- **THEN** the server SHALL load only the bounded shard required by that intent
- **AND** all returned blocks SHALL share the established composite envelope.

#### Scenario: Detail has optional content failure

- **WHEN** a detail shard's optional card/media/resource block fails identity validation
- **THEN** the shard SHALL retain valid selected-node text and published verification/engineering relations
- **AND** it SHALL not replace the failure with a full-graph or unrelated-release response.

### Requirement: Read consolidation has a closed consumer denominator

The implementation SHALL inventory every active, Legacy, candidate, repository, shard, resource-binding, learning-content, rich-text, cache, route/API, model/read, script, generated, compatibility, test, and reverse/dynamic caller. A replaced assembler or reader SHALL have an owner, replacement identity, zero-caller evidence, and rollback condition before deletion.

#### Scenario: An old assembler is superseded

- **WHEN** every classified caller uses the common response envelope and characterization/rollback evidence passes
- **THEN** the old assembler MAY enter the R4 deletion set
- **AND** it SHALL not be retained as an unbounded facade or removed before the retirement gate.
