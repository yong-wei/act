## 1. Tailwind Migration

- [ ] 1.1 Upgrade Tailwind CSS to the selected latest stable Tailwind 4 line.
- [ ] 1.2 Add required `@tailwindcss/postcss` integration and update PostCSS config.
- [ ] 1.3 Migrate global CSS directives and preserve layered token behavior.
- [ ] 1.4 Review `tailwindcss-animate` compatibility or replacement.
- [ ] 1.5 Upgrade `tailwind-merge` to the selected latest stable line and verify class conflict resolution used by shared UI components.
- [ ] 1.6 Keep unrelated framework, database, and 3D package upgrades out of scope.

## 2. Validation

- [ ] 2.1 Run `rtk npx tsc --noEmit --pretty false`.
- [ ] 2.2 Run `rtk npm run lint`.
- [ ] 2.3 Run `rtk npm run test`.
- [ ] 2.4 Run `rtk npm run test:commercial-ui-governance`.
- [ ] 2.5 Run `rtk npm run build`.
- [ ] 2.6 Run browser visual validation across the agreed desktop and mobile route set.
- [ ] 2.7 Record any intentional visual differences and ensure text does not overlap or collapse at mobile widths.

## 3. OpenSpec Validation

- [ ] 3.1 Run `rtk openspec validate upgrade-tailwind-4-design-system --strict`.
