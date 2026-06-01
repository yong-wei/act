## Context

The homepage currently returns `200` with no new error-log bytes, but `.logs/error.log` still contains earlier R3F SSR failures. Because log entries lack a clear current-run boundary, future agents can misread fixed historical errors as active failures.

The dependency environment also has reproducibility gaps:

- `package.json` has no `engines` or `packageManager`.
- Local Node is `v26.0.0`, while production and future dependency upgrades may require a narrower supported range.
- `npm ls --depth=0` shows extraneous native packages that may be local install residue.
- Browserslist reports stale `caniuse-lite` data.

## Approach

- Add a current-run boundary or timestamped log behavior before runtime checks rely on `.logs/error.log`.
- Define a deterministic local install hygiene check using clean `npm ci`.
- Add package metadata that records the intended Node/package-manager range without forcing an unrelated runtime upgrade.
- Treat Browserslist update as a lockfile hygiene action, not as a UI or browser-support policy redesign.

## Verification

- `rtk npm ci`
- `rtk npm ls --depth=0`
- Runtime smoke check proving current requests can be separated from old log entries.
- `rtk openspec validate normalize-runtime-log-and-environment-signals --strict`
