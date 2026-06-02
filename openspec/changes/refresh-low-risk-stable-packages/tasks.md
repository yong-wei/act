## 1. Package Refresh

- [ ] 1.1 Select low-risk packages from `npm outdated --long --json`.
- [ ] 1.2 Upgrade selected packages without pulling excluded major migration lanes.
- [ ] 1.3 Review lockfile changes for unexpected major upgrades, duplicate packages, or new audit findings.

## 2. Validation

- [ ] 2.1 Run `rtk npm audit --json` and record resolved and remaining findings.
- [ ] 2.2 Run `rtk npx tsc --noEmit --pretty false`.
- [ ] 2.3 Run `rtk npm run test`.
- [ ] 2.4 Run `rtk npm run test:unit`.
- [ ] 2.5 Run targeted browser validation for touched UI/chart/graph surfaces if any runtime UI package changes.
- [ ] 2.6 Record deferred latest-stable major lanes and their owner changes for ESLint 10, TypeScript 6, `@types/node` 25, Zod 4, bcryptjs 3, `lucide-react` 1, and `tailwind-merge` 3.

## 3. OpenSpec Validation

- [ ] 3.1 Run `rtk openspec validate refresh-low-risk-stable-packages --strict`.
