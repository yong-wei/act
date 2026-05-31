## Context

The current app uses Next 14 with `next lint`, App Router routes, server components, image handling, and standalone deployment assumptions. Next 15 and 16 introduce behavior and tooling changes that are easier to prepare before changing the framework version.

## Readiness Areas

- Lint: replace `next lint` with a supported ESLint invocation or documented transitional command.
- Routing: identify pages, layouts, route handlers, and metadata functions that need async `params` or `searchParams` changes.
- Caching: identify GET route handlers that rely on old implicit caching behavior.
- Images: convert deprecated `images.domains` patterns to `remotePatterns` if present.
- Runtime: inspect middleware/proxy and standalone build behavior against known advisories.
- Tests: name the minimal validation matrix for Next 15 and Next 16 changes.

## Risks

- Preparation can become a hidden framework migration. Keep package major versions unchanged.
- Route handler cache behavior can create subtle production regressions. Document intentional dynamic/static choices.

## Verification

- Run lint and build checks available under the current Next version.
- Validate route inventory and readiness report.
- Validate with `rtk openspec validate prepare-next-major-upgrade --strict`.
