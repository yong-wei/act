## Why

The archived repository-payload classification is a valid historical observation, but it is not a migration input: 52,159 of its 78,494 members remain unresolved, its package is `package-unqualified`, and the current `integration` tree has since gained additional tracked payload. The repository needs one current, fully reconciled eligibility package before any payload is moved, deleted, externalized, materialized, or treated as replaceable.

## What Changes

- Extend the existing classifier so a new run captures a clean, exact-current `integration` subject while preserving the archived A/C subject and package as immutable predecessor evidence.
- Reconcile the complete current tracked inventory, including newly added payload, against the established release/runtime, evidence-lifecycle, architecture, generated-asset, fixture, and media families.
- Resolve authority-manifest, consumer, retention, recovery, rollback, toolchain-count, and privacy evidence through existing repository contracts; do not infer any of them from a path, filename, equal hash, or application HEAD.
- Emit a new compact package in which every current member is accounted for and either every record is qualified or the whole package remains explicitly unqualified with bounded unresolved reasons.
- Keep classification and future eligibility observational. This change performs no payload migration or lifecycle mutation and grants no deletion or externalization authority.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `repository-payload-classification`: support current-subject successor generations, predecessor continuity, complete current-inventory reconciliation, and all-or-unqualified migration-input handoff without weakening the existing A-F, privacy, digest, or read-only contracts.

## Impact

- Expected implementation surfaces: `scripts/classify-repository-payload.ts`, `src/lib/architecture-census/payload-classification.ts`, focused classifier tests, and compact outputs under `docs/architecture/repository-payload-classification/`.
- Read-only evidence inputs include the existing content/knowledge/runtime release toolchain, runtime blob lifecycle, QA evidence lifecycle, architecture contracts, and their manifests or receipts.
- The proposal-time `integration` revision is investigation evidence only. Claim and implementation must bind a fresh clean subject commit/tree and an independent tool checkpoint, then fail closed on either identity drifting.
- No production selector, OSS object, runtime view, QA artifact, source payload, active baseline, fitness authority, test command, database, or Git history is changed.
