## Context

The professional report identifies the central platform gap as missing unification, not missing scenes. The current codebase already has simulation profiles, a Rust/WASM runtime facade, Arena public experiments, preview runs, official evaluation, and governance tables. The first change should therefore define stable contracts before altering pages, persistence, or scoring behavior.

## Goals

- Define a protocol that can be consumed by standalone scenes, Arena runs, and DB BOPPPS resources.
- Make scene identity, model identity, disturbance policy, evaluation metrics, assets, telemetry, replay, and governance metadata explicit.
- Keep fixed-step execution and Rust/WASM ownership unchanged.

## Non-Goals

- No scene shell decomposition.
- No Prisma migration.
- No stochastic seeding implementation.
- No leaderboard or official evaluation policy change.

## Design

`SceneSpec v1` should be a typed contract near the simulation resource boundary. It should contain:

- `scene`: id, title, route, resource id, course alignment, supported launch modes.
- `model`: model family, runtime model id, parameter schema, version, unit policy.
- `disturbance`: supported environment families, stochastic policy, seed requirement.
- `evaluation`: metrics, constraints, success criteria, official/preview visibility.
- `evaluationProtocol`: `EvaluationSpec v1` reference, preview protocol reference, official protocol reference, model relation to Arena objects, and prohibited comparison boundaries.
- `assets`: asset ids, visual layer dependencies, asset version.
- `telemetry`: sample channels, default `recordInterval`, summary metrics.
- `replay`: seed fields, runtime version, model version, checksum policy.
- `governance`: evidence source, privacy level, retention class, class/session context fields.

`EvaluationSpec v1` should define the metrics, hard constraints, visibility, and intended use of an evaluation path. When an Arena black-box object is a simplified or surrogate model rather than the same model as the 3D scene, the mapping must record `modelRelation: same | simplified | surrogate`, the teaching meaning of the relation, and the evaluation boundary that prevents mixing preview and official claims.

`SimulationTrace v1` should separate high-frequency samples from compact summaries. The trace envelope should include run id, scene id, scenario id, protocol version, runtime version, model version, seed, started/completed timestamps, sample cadence, summary metrics, trace reference, and checksum.

The inventory should map the seven `/simulations/*` scenes and Arena black-box flow into the contract. Gaps should be explicit, including unseeded disturbance paths and places where Arena uses a simplified object that is not the same as the corresponding 3D scene object.

## Risks

- Over-specifying the protocol could slow implementation. Keep fields required only where downstream evidence or replay needs them.
- Existing profile names may not match long-term course resource ids. Use explicit aliases instead of relying on route strings.

## Verification

- Validate the OpenSpec change with strict mode.
- Use `rtk proxy openspec validate standardize-simulation-scene-and-trace-protocol --strict` as the gate for this change.
- Treat repository-wide `rtk proxy openspec validate --all --strict` failures in unrelated existing main specs as outside this series unless a later change explicitly adopts them.
- Review the inventory against `docs/Simulation_Guidelines.md`, `src/app/simulations/page.tsx`, `src/resources/simulations/core/types.ts`, Arena black-box code, and Prisma evidence tables.
