## Context

The current black-box workbench builds a nominal model id from the dataset hash in client code. Preview code verifies that derived id, but the model is not a durable server-owned artifact. This is acceptable for a teaching prototype, but not for reproducible model governance or later adaptive evidence.

## Goals

- Make identified model artifacts server-owned and tied to persisted experiments.
- Keep client UI as a consumer of model references, not the authority that creates them.
- Make adapter support explicit for public experiments, virtual previews, and official evaluations.
- Keep official hidden evaluation independent from preview results.

## Non-Goals

- No research-grade system identification pipeline.
- No relaxation of ownership checks.
- No official leaderboard policy change.
- No complete workbench redesign.

## Design

Add a model registry concept for Arena identified models. A registered model should record owner, task id, dataset hash, source experiment id, model type, validation summary, protocol version, and created timestamp. Preview and submission paths should resolve the registered model and reject mismatched or client-minted ids.

Adapter interfaces should expose support for:

- `runPublicExperiment`
- `runVirtualPreview`
- `runOfficialEvaluation`
- `describeSupport` or explicit unsupported reason

The cruise black-box adapter can remain the first production path. White-box transfer-function support should either implement the same protocol or declare why preview/experiment modes are unsupported.

This change constrains existing `arena-blackbox-adapter-boundary` and `control-workbench-blackbox-identification` behavior. The new capability names the cross-cutting registry and adapter protocol, but implementation must update the existing production adapter and workbench black-box model flow rather than creating a parallel path.

## Risks

- Adding a registry without migration care can break existing UI assumptions. Keep API responses backward readable where possible.
- Adapter expansion can become too broad. Limit this change to protocol and current black-box path first.

## Verification

- Tests that client-provided arbitrary model ids are rejected.
- Tests that a registered model from an owned dataset can run preview.
- Tests that official evaluation remains isolated from preview payloads.
- Gate with `rtk proxy openspec validate unify-arena-preview-adapter-and-model-registry --strict`.
