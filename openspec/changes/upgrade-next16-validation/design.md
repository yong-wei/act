## Context

Next 16 validation should only run after the project has a working Next 15 baseline. This keeps the second framework jump attributable. The change is also the explicit decision point for stopping at Next 15 when audit and deployment goals are already satisfied.

## Migration Strategy

- Confirm the Next 15 migration branch state is green enough to serve as the base.
- Compare remaining audit findings, framework advisories, deployment constraints, and ecosystem support against the selected Next 15 baseline.
- If Next 16 is required or clearly justified, upgrade to the selected Next 16 target and align React and peer dependencies.
- If Next 16 is not required, record the evidence, remaining audit state, and the trigger that would reopen the upgrade path.
- Apply required framework changes for route params, cache behavior, middleware/proxy, images, and deployment only when the upgrade path is taken.
- Re-check Docker and remote deployment scripts if standalone output changes.

## Validation Matrix

- `rtk npm run build` for an upgrade path, or record why the Next 15 build evidence remains sufficient for a not-required decision.
- `rtk npm run test:unit`.
- `rtk npm run test`.
- `rtk npm run test:integration` when route or browser behavior changes materially.
- Docker image build through the repository build script if deployment output changes.
- `rtk npm audit --json`.

## Risks

- React and framework peer changes can break UI or server component behavior outside the files touched directly.
- Standalone output changes can affect production deployment even when local build passes.
- Next 16 may require code changes that should not be backported to the Next 15 validation issue.

## Verification

- Record selected Next 16 version and remaining audit findings, or record the not-required decision and its evidence.
- Validate with `rtk openspec validate upgrade-next16-validation --strict`.
