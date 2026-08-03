# Issue #1179 latest stable Aggregate admission gate

The immutable ActKG bridge was consumed from ActKG main commit
`0a19ee2bcd6a9fbfbce35a0b7756b99dbfd2879d`. Its canonical artifact hash is
`a90796a6d0902617e54cdef00c9c91de145a07e668812e6667aa20d838f74f08`, and
its embedded Release Diff digest is
`3f3f2ec94a1aa82ccd9022a058f79e75a4f27173d6fa703067d00e7441a5e70e`.

The resolver produced binding digest
`1ca0b7b22b8a4fc80bd5484966344a3034edb44cec1bb96e50443731a7e0d78d`.
The exact chain is v0.3:r2, v0.4:r3, v0.5:r3, v0.6:r3, v0.7:r3,
v0.8:r3, and v0.9:r2.

Real PostgreSQL admission ran in an isolated schema. All seven independently
recomputed Deltas were `ACCEPTED` and every upstream cross-check was `AGREED`.
Hop 1 used `admission_bridge`; hops 2–7 used immutable Bundle artifacts.
Each `upstreamDiffDigest` is the canonical digest of the parsed, supported
Release Diff semantic fields used by the cross-check; it is not the raw
`release-diff.json` file SHA-256.
The admission capture revision is
`c1398ba5e381341999b6dc2f9165e7491cdb1531`.

The production selector, Graph-RAG selector, and Canonical LearningFact writer
fence all remained unchanged (`0`).

Evidence locations:

- `latest-stable-binding.json` and `latest-stable-binding.md`
- `chain/chain-intake-receipt.json`
- `chain/metadata/admission-bridge-release-diff.json`
- `admission/admission-receipt.json`
- `admission/delta-receipts.json`
- `admission/gate-summary.json`

Verification:

- four focused Vitest files: 39 passed
- real PostgreSQL admission: PASS, seven receipts, isolated schema
- TypeScript typecheck: PASS
- strict OpenSpec validation: PASS
- Git diff check: PASS
