## 1. Compatibility evidence contract

- [ ] 1.1 Define and validate the canonical `runtime-app-compatibility.v1` receipt, including Runtime manifest, integration source, actual main application image/revision, consumer contract, and migration-set identity.
- [ ] 1.2 Extend Runtime blob lifecycle and active receipts to retain and revalidate the proof identity without widening public readiness output.
- [ ] 1.3 Capture deployed application/image/migration facts on ECS and reject caller-supplied, mismatched, or drifting identities.

## 2. Candidate qualification and lifecycle selection

- [ ] 2.1 Run the declared candidate consumers against the materialized Runtime view in the actual application container and create the proof only after success.
- [ ] 2.2 Revalidate proof, manifest, image, application revision, migration-set and consumer contract under the lifecycle transaction before desired or active Runtime mutation.
- [ ] 2.3 Fence the first-cutover script as migration-only and ensure `deploy:runtime` continues through the independent v2 blob lifecycle.

## 3. Application deployment closure

- [ ] 3.1 Carry the provenance input helper needed by remote deployment verification.
- [ ] 3.2 Pin validated application image and knowledge deployment mode in generated systemd units, with input validation and regression coverage.
- [ ] 3.3 Remove redundant Git-dependent knowledge import verification from the Git-free production runner while preserving entrypoint ownership and post-start checks.

## 4. Verification and release

- [ ] 4.1 Add direct contract and behavior tests for allowed main/integration revision differences and rejected proof, image, manifest, migration, and consumer-contract drift.
- [ ] 4.2 Run OpenSpec strict validation, focused deployment/Runtime tests, typecheck, and the required final release verification.
- [ ] 4.3 Merge the completed change, release a new application version from main, then publish and activate a compatible Runtime Release from a frozen integration revision.
