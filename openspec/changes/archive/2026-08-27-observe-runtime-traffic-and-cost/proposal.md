## Why

ACT currently has several unrelated browser and workstation delivery paths, but
no revision-bound denominator that explains OSS `NetworkOut`, CDN/ESA origin
traffic, ECS-served bytes, developer FUSE reads, or Publisher readback. Routing
changes made without that baseline cannot prove which cost was reduced or
detect traffic that merely moved to another billable class.

## What Changes

- Add a read-only traffic inventory covering browser `/assets/*`, direct
  `/course-runtime/*`, manifest-bound `/api/course-runtime/assets/*`, production
  Runtime mounts, developer OSS mounts, and Publisher upload/readback.
- Normalize OSS, ESA, Nginx, Publisher, and developer-mount observations into
  one versioned, revision-bound attribution receipt with explicit observed,
  excluded, duplicated, delayed, and unattributed totals.
- Record operation direction, endpoint class, object-prefix class, response
  route, byte count, observation window, source timestamp, and billing delay
  without recording credentials, signed query strings, user identifiers, or
  local absolute paths.
- Establish before/after evidence used by later delivery changes without
  changing DNS, cloud resources, routes, selectors, publication, or production
  state.

## Capabilities

### New Capabilities

- `runtime-traffic-cost-observability`: Reproducible and privacy-safe inventory,
  attribution, and cost-class evidence for ACT Runtime and browser asset paths.

### Modified Capabilities

None.

## Impact

- **Code:** observation and normalization tools under the release/operations
  toolchain, plus focused fixtures and operator documentation.
- **Inputs:** OSS and ESA exports, Nginx access observations, Publisher metrics,
  developer ossfs2 observations, and the captured Git revision.
- **Outputs:** portable receipts and reports only; no credentials, signed URLs,
  raw user events, or workstation paths.
- **Operations:** no traffic mutation, DNS change, Bucket creation, publication,
  deployment, selector update, or production activation.
- **Verification:** local strict OpenSpec validation and focused tool tests;
  this change does not add GitHub Actions for pull requests to `integration`.
