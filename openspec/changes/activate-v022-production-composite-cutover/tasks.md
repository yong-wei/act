## 1. Envelope-configurable runtime release

- [x] 1.1 Replace hard-coded v0.18 selector constants (including the
  `ctr:release:control-theory-engineering-v0.18` release and profile pins in
  `src/lib/authority-domain-shards/labels.ts`) with configuration bound to one
  named, qualified composite release envelope, failing closed on unknown or
  partially resolved envelopes.
- [x] 1.2 Prove the configured runtime resolves the current v0.18 envelope
  identically to the previous hard-coded behavior via lint, typecheck, tests,
  and build gates on one frozen revision.
- [ ] 1.3 Build and publish the immutable runtime release with provenance bound
  to the frozen revision and the qualified v0.22 envelope identity.
- [ ] 1.4 Deploy the runtime while all five production selectors keep their
  current pre-activation identities; verify current production behavior and
  controlled v0.22 shadow reads without writing any shared selector; seal the
  runtime-release receipt.

## 2. Production activation transaction

- [ ] 2.1 Re-read the deployed runtime identity, the qualification evidence
  from `validate-v022-composite-cutover-candidate`, sealed v0.22 targets, the
  complete previous-envelope predecessor identities, and current pointer
  hashes; refuse transaction entry on any drift.
- [ ] 2.2 Seal the previous-envelope snapshot of all five selectors and
  exercise the production rollback path before the forward switch.
- [ ] 2.3 Under one exclusive lock with a sealed write-ahead journal, advance
  Authority, Teaching Projection, prerequisite, and Authority domain
  shard/catalog selectors to the same qualified v0.22 envelope, then commit the
  shared consumer-activation pointer as the sole READY point.
- [ ] 2.4 Abort fail-closed — restoring the full previous envelope — if any
  selector cannot be moved or still resolves an older release.

## 3. Post-activation verification and rollback readiness

- [ ] 3.1 Verify `/knowledge` serves the activated envelope's domain catalog
  with the full reviewed membership recorded in the qualification evidence
  (closing the one-to-two reviewed objects per domain symptom), without
  hard-coding v0.22 object counts.
- [ ] 3.2 Verify Chinese preferred/fallback display coverage is intact and no
  internal identifiers (object IDs, relation IDs, release/snapshot/activation
  names, version hashes, internal enums or paths) are learner-visible.
- [ ] 3.3 Verify shared consumers, app/worker health, and public readiness all
  resolve the same v0.22 envelope; on any failed observation, execute the
  journaled five-selector rollback and re-verify the restored envelope.
- [ ] 3.4 Seal the activation or rollback receipt, record the rollback window,
  and move v0.9/v0.18 access to read-only history and rollback evidence only.
- [ ] 3.5 Run `openspec validate activate-v022-production-composite-cutover
  --type change --strict` and archive the change with its evidence.
