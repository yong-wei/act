## 1. Envelope lock and manifest audit

- [x] 1.1 Lock the `control-theory-engineering-v0.22` composite release
  envelope and record the Aggregate v0.22 Component Manifest as the sole
  version truth for this qualification run.
- [x] 1.2 Verify manifest completeness and identity: Integration v0.20,
  Chinese terminology v0.5, Schema 0.3.0 with hash equal to the integrated
  v0.18 Schema, Projection Profile, tag index, and all remaining declared
  components; reject any component resolved outside the manifest.

## 2. Selector coherence and content audits

- [x] 2.1 Audit the candidate values of all five production selectors
  (Authority, Teaching Projection, prerequisites, Authority domain
  shard/catalog, shared consumer activation) against the envelope identity
  and fail on any mixed-version combination, including v0.22 Authority over a
  v0.9 or v0.18 domain catalog.
- [x] 2.2 Verify domain catalog membership completeness from materialized
  many-to-many membership, with expected members derived from the envelope's
  domain catalog and no stale v0.9 members readable through the candidate.
- [x] 2.3 Verify Chinese display coverage against terminology v0.5 and check
  that every teaching projection reference resolves to a v0.22 canonical
  object; report missing teaching coverage as a non-blocking gap.

## 3. Reproducibility, rollback, and verdict

- [x] 3.1 Rebuild the Authority domain shard set twice from the same locked
  envelope and prove the rebuilds match.
- [x] 3.2 Preserve a snapshot of the previous production composite release
  envelope and demonstrate it is restorable as rollback evidence.
- [x] 3.3 Emit the qualification verdict as candidate-auditable evidence only
  and prove every production selector still equals its pre-run value.
- [x] 3.4 Run affected checks (lint, typecheck, relevant tests) and
  `openspec validate validate-v022-composite-cutover-candidate --type change
  --strict` until clean.
