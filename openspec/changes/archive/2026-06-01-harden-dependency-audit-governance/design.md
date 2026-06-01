## Context

The current audit output is high-volume and not yet converted into a stable gate. A useful governance layer should prevent regressions without blocking work on already-known, explicitly owned residual findings.

## Governance Policy

- Define severity thresholds for failing the audit gate.
- Keep an explicit allowlist for residual findings with advisory ID, package path, reason, owner issue, expiry or removal condition, and review date.
- Distinguish production runtime dependencies from dev-only tooling findings in the report.
- Require new findings above threshold to fail unless they are tied to an approved migration issue.

## Implementation Shape

- Prefer a small repository script that consumes `npm audit --json` and emits a stable summary.
- Add package scripts only if they fit the existing command style.
- Integrate with CI only if it does not block historical debt before allowlist policy is in place.

## Risks

- A hard gate without an allowlist can block unrelated work on old debt.
- A permissive allowlist can become permanent. Entries need owners and removal conditions.
- npm advisory metadata can change, so the report should tolerate missing optional fields while keeping package and advisory IDs explicit.

## Verification

- Test the audit report against the current lockfile and a fixture with a new high-severity finding if practical.
- Run `rtk npm audit --json` through the governance script.
- Validate with `rtk openspec validate harden-dependency-audit-governance --strict`.
