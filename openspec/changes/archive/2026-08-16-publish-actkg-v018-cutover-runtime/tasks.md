## 1. Freeze and verify release inputs

- [x] 1.1 Select one clean application revision and bind its tree, qualified
  candidate manifest, runtime identity, image tag, and intended release version.
- [x] 1.2 Verify local PostgreSQL migrations deploy from empty/current states and
  report schema up to date before remote work.
- [x] 1.3 Run the final intended-revision test, typecheck, lint, OpenSpec, and
  release-deployment gates.

## 2. Production image build

- [x] 2.1 Configure Docker Desktop for 24 GiB RAM and 8 GiB swap, verify at least
  20 GiB through `docker info`, and confirm no residual parallel build owns it.
- [x] 2.2 Build through `scripts/build.sh` with a 12 GiB Node heap and require
  container Next compilation, TypeScript, image export, OCI labels, and provenance.
- [x] 2.3 Verify the exported image digest and release sidecars against the frozen revision.

## 3. Runtime publication with v0.9 retained

- [x] 3.1 Stage the sealed v0.18 candidate and v0.9 rollback set on the host
  without writing any current pointer.
- [x] 3.2 Refresh app and worker to the frozen cutover-capable OCI revision while
  checking all five current selectors remain byte-identical v0.9 values.
- [x] 3.3 Verify production v0.9 behavior and controlled v0.18 shadow label,
  teaching, six-consumer, health, worker, and readiness checks separately.
- [x] 3.4 Seal the deployment receipt or restore the prior app runtime on failure;
  do not authorize cutover when any shadow check is blocked.
- [x] 3.5 Stop Docker Desktop after release verification when no other build owns it.
