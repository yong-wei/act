## ADDED Requirements

### Requirement: Ordinary backfill tools are separate from online projection runtime
Course evidence enrichment, historical materialization and selected report regeneration SHALL run through explicit offline operations with dry-run/apply mode, frozen input/cutoff, stable operation identity, authorization, per-input outcomes and minimal receipts. They MUST NOT be imported by normal page/API reads as a current-projection fallback.

#### Scenario: Backfill dry run is requested
- **WHEN** an operator runs a historical tool without explicit apply and authorized operation identity
- **THEN** it SHALL report deterministic candidate/recoverable/unrecoverable/limited counts
- **AND** it SHALL not create facts, snapshots, reports, outbox jobs or current pointers

#### Scenario: Online route lacks a current projection
- **WHEN** an online consumer cannot obtain a qualified current projection
- **THEN** it SHALL return governed unavailable/stale status
- **AND** it SHALL not invoke the backfill command or read its working data

### Requirement: Ordinary backfill cannot publish online current state
An ordinary backfill MAY create explicitly authorized append-only enrichment or correction receipts, but it SHALL NOT advance the online current pointer, fabricate live processing/state watermark, overwrite source anchors or emit an unbound online trigger. A dedicated governed migration MAY use its existing generation/fence/cutover contract only when that contract is explicitly selected and receipted.

#### Scenario: Backfill apply completes
- **WHEN** an authorized ordinary backfill applies against a frozen historical input
- **THEN** its outputs SHALL carry operation identity, source anchors, input digest and historical status
- **AND** online current pointers and live watermarks SHALL remain unchanged

#### Scenario: Dedicated cutover migration is selected
- **WHEN** a separately governed migration explicitly selects its own cutover contract
- **THEN** it SHALL revalidate generation, fence, revision, input digest and completion receipts before any current-pointer move
- **AND** an ordinary backfill path SHALL not inherit that permission
