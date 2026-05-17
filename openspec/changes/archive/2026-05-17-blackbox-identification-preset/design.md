## Context

The black-box backend path is already stronger than the UI: experiments are budgeted and persisted, dataset hashes are deterministic, and official submission checks dataset ownership. The current panel mixes experiment controls, identification reference creation, controller parameters, preview, and submission in one component. The unified preset should separate these as workbench areas while preserving the service boundary.

## Goals / Non-Goals

**Goals:**
- Bring black-box identification and control into the unified workbench.
- Enforce the official-target vs working-model distinction.
- Reuse existing persisted experiment and preview APIs.
- Keep official submission ownership checks intact.

**Non-Goals:**
- No automatic system identification beyond simple first-version nominal-model creation unless already available.
- No direct display of hidden official model dynamics.
- No bypass of budgeted experiment service for challenge mode.

## Decisions

- Treat experiment datasets as the source of black-box observations.
  Rationale: datasets already include ownership, budget, hash, and quality data; local generated samples would break official consistency.

- Introduce `NominalModelArtifact` at the workbench layer.
  Rationale: black-box students need a working model for plots and controller design, but it must not become the official target.

- Keep official black-box artifacts tied to dataset hash and identification model id.
  Rationale: existing evaluators reject forged or cross-user dataset hashes. The preset should preserve that contract.

## Risks / Trade-offs

- [Risk] A session-only nominal model may be lost on refresh.
  → Mitigation: first version can rebuild it from the latest persisted dataset; durable saving can be a later change.

- [Risk] Students may confuse nominal model plots with official hidden performance.
  → Mitigation: label all nominal-model frequency and response views as nominal, not official.
