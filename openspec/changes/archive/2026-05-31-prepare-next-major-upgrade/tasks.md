## 1. Readiness Inventory

- [x] 1.1 Inventory Next config, lint scripts, image config, middleware/proxy, and build scripts.
- [x] 1.2 Inventory App Router files affected by async `params` or `searchParams`.
- [x] 1.3 Inventory GET route handlers with cache-sensitive behavior.

## 2. Preparation

- [x] 2.1 Replace or document the `next lint` migration path.
- [x] 2.2 Apply compatible config changes that do not require a Next major upgrade.
- [x] 2.3 Add readiness notes for files that must change during Next 15 upgrade.

## 3. Validation

- [x] 3.1 Run current-version lint/build checks where applicable.
- [x] 3.2 Produce the Next 15 readiness report.
- [x] 3.3 Validate with `rtk openspec validate prepare-next-major-upgrade --strict`.
