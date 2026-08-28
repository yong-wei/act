## 1. Compatibility evidence contract

- [x] 1.1 Define and validate the canonical `runtime-app-compatibility.v1` receipt, including Runtime manifest, integration source, actual main application image/revision, consumer contract, and migration-set identity.
- [x] 1.2 Extend Runtime blob lifecycle and active receipts to retain and revalidate the proof identity without widening public readiness output.
- [x] 1.3 Capture deployed application/image/migration facts on ECS and reject caller-supplied, mismatched, or drifting identities.

## 2. Candidate qualification and lifecycle selection

- [x] 2.1 Run the declared candidate consumers against the materialized Runtime view in the actual application container and create the proof only after success.
- [x] 2.2 Revalidate proof, manifest, image, application revision, migration-set and consumer contract under the lifecycle transaction before desired or active Runtime mutation.
- [x] 2.3 Fence the first-cutover script as migration-only and ensure `deploy:runtime` continues through the independent v2 blob lifecycle.

## 3. Application deployment closure

- [x] 3.1 Carry the provenance input helper needed by remote deployment verification.
- [x] 3.2 Pin validated application image and knowledge deployment mode in generated systemd units, with input validation and regression coverage.
- [x] 3.3 Preserve apply-gated knowledge import after immutable Runtime mount, prohibit raw importer invocation in the Git-free runner, and retain post-start checks.

## 4. Verification and release

- [x] 4.1 Add direct contract and behavior tests for allowed main/integration revision differences and rejected proof, image, manifest, migration, and consumer-contract drift.
- [x] 4.2 Run OpenSpec strict validation, focused deployment/Runtime tests, typecheck, production build, and record the current unrelated full-unit-suite baseline failures.
- [x] 4.3 Define the post-merge operation: publish a new application version from main, then publish and activate a compatible Runtime Release from a frozen integration revision.

## Verification note

- `npm run typecheck`, `npm run verify:push`, `npm run test`, the focused Runtime/deployment suites, and `SKIP_WASM_BUILD=1 npm run build` passed on this delivery revision.
- `npm run test:unit` currently reports pre-existing failures outside this change, including a locally generated control-engine identity mismatch, missing archived semantic-map screenshots, and legacy selector/fixture expectations. They are retained as repository baseline work and are not used as evidence for this change.
