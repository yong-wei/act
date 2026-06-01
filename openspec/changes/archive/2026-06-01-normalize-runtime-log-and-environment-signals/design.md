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

## Implementation Notes

- Add a `test:runtime-log-delta` smoke script that records frontend error-log
  byte offsets before and after a route request. The check defaults to
  `.logs/frontend-error.log`, while `RUNTIME_ERROR_LOG` can point at another
  log file for targeted checks. The check fails only when the current request
  writes new frontend error bytes, so historical log residue and unrelated
  background worker stderr are not treated as active homepage failures.
- Declare the local/CI/server runtime contract in `package.json` as
  Node `^20.19.0 || >=22.12.0 <27`, npm `>=10 <12`, with `packageManager`
  set to the npm version used for this lockfile hygiene pass.
- Refresh `caniuse-lite` through `npx update-browserslist-db@latest` so the
  Browserslist data change is visible in `package-lock.json`.
- `npm ci` removes stale missing/invalid package drift and succeeds with the
  remaining owned moderate audit findings. `npm ls --depth=0` still reports
  extraneous `@emnapi/core`, `@emnapi/runtime`, and `@emnapi/wasi-threads`;
  `npm explain @emnapi/*` shows no owning dependency path except
  `@emnapi/core -> @emnapi/wasi-threads`, so this residual is recorded as
  environment drift rather than mixed with application failures.

## Verification

- `rtk npm ci`
- `rtk npm ls --depth=0`
- Runtime smoke check proving current requests can be separated from old log entries.
- `rtk openspec validate normalize-runtime-log-and-environment-signals --strict`
