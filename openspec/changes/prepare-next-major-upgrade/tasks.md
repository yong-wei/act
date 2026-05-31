## 1. Readiness Inventory

- [ ] 1.1 Inventory Next config, lint scripts, image config, middleware/proxy, and build scripts.
- [ ] 1.2 Inventory App Router files affected by async `params` or `searchParams`.
- [ ] 1.3 Inventory GET route handlers with cache-sensitive behavior.

## 2. Preparation

- [ ] 2.1 Replace or document the `next lint` migration path.
- [ ] 2.2 Apply compatible config changes that do not require a Next major upgrade.
- [ ] 2.3 Add readiness notes for files that must change during Next 15 upgrade.

## 3. Validation

- [ ] 3.1 Run current-version lint/build checks where applicable.
- [ ] 3.2 Produce the Next 15 readiness report.
- [ ] 3.3 Validate with `rtk openspec validate prepare-next-major-upgrade --strict`.
