## Context

Next 15 is the first major upgrade step after readiness work. It should consume the preparation report and keep the migration focused on framework compatibility plus audit reduction.

## Migration Strategy

- Start from the migration branch after readiness and lower-risk updates are merged.
- Upgrade Next to the selected Next 15 target version and align peer dependencies.
- Apply codemods or manual changes for async route props, cache defaults, lint command replacement, image config, and build changes.
- Keep Next 16-only APIs and React 19-only assumptions out of scope unless required by the selected Next 15 release.

## Validation Matrix

- `rtk npm run build`.
- `rtk npm run test:unit`.
- `rtk npm run test` smoke route checks.
- Targeted API/auth/AI checks for surfaces affected by framework runtime changes.
- `rtk npm audit --json` comparison against the baseline.

## Risks

- App Router behavior changes can break pages that compile successfully.
- Cache default changes can alter API freshness or auth-sensitive routes.
- Peer dependency resolution can pull larger React changes than intended.

## Verification

- Record selected Next 15 version and remaining audit findings.
- Validate with `rtk openspec validate upgrade-next15-validation --strict`.
