## Context

The preferred model is not a hard choice between one table and two tables. `SimulationRun` should become the platform run envelope, while `ArenaVirtualSimulationRun` remains the Arena-domain preview detail table.

This allows Konling, evidence, replay, teacher diagnostics, and data-center consumers to use one run identity without flattening Arena-specific fields into generic JSON.

## Decisions

### Canonical Envelope Plus Domain Detail

Arena preview creation should create or resolve:

- a canonical `SimulationRun` with `runKind = arena_preview`
- an Arena detail row with `simulationRunId`

The detail row keeps `taskId`, `datasetHash`, `controllerHash`, `scenarioId`, and preview payload. The canonical run keeps owner user, source domain/reference, status, summary, replay token, provenance, and timestamps.

### Normal Consumers Read SimulationRun

Normal platform consumers should read `SimulationRun` first:

- Konling simulation tools
- Learning evidence materializers
- teacher class summaries
- data center/governance summaries
- replay status surfaces

Arena pages may join to `ArenaVirtualSimulationRun` for dataset, registered model, and preview-specific rendering.

### Preview Cannot Become Official

Arena preview metadata must include enough fields to prevent mixed claims:

- `runKind = arena_preview`
- `sourceDomain = arena`
- `evaluationVisibility = preview`
- `officialEligible = false`
- `modelRelation`
- `datasetHash`
- `controllerHash`
- `identificationModelId`
- `sourceExperimentId`

Official submissions and leaderboard scoring remain separate.

### Migration Is Additive

This change should not delete existing Arena preview rows. Backfill may create SimulationRun envelopes for existing preview rows if needed, but missing mappings should be reported as governance readiness gaps.

## Risks

- If mapping is optional forever, downstream consumers will see incomplete evidence. New preview creation should require the mapping.
- If preview summary fields are reused as official metrics, students and teachers can be misled. Visibility and official eligibility must be explicit.
- Arena detail joins must preserve owner-user isolation.

## Verification

- Tests proving new Arena preview creation creates or resolves both SimulationRun and Arena detail rows.
- Tests proving normal evidence consumers can use SimulationRun without reading Arena detail payload.
- Tests proving official submission does not consume preview score as leaderboard score.
- Access tests for cross-user preview run rejection.
- `rtk proxy openspec validate connect-arena-preview-to-simulation-evidence --strict`.
