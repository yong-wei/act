## 1. React Upgrade

- [ ] 1.1 Upgrade `react`, `react-dom`, `@types/react`, and `@types/react-dom` to the selected React 19 stable line.
- [ ] 1.2 Upgrade `lucide-react` to the selected latest stable line and verify icon import/tree-shaking compatibility.
- [ ] 1.3 Resolve React 19 type and runtime compatibility errors.
- [ ] 1.4 Keep React Three Fiber, Drei, Three, Tailwind, and Prisma major upgrades out of scope.

## 2. Compatibility Testing

- [ ] 2.1 Run `rtk npx tsc --noEmit --pretty false`.
- [ ] 2.2 Run `rtk npm run lint`.
- [ ] 2.3 Run `rtk npm run test`.
- [ ] 2.4 Run `rtk npm run test:unit`.
- [ ] 2.5 Run `rtk npm run build`.
- [ ] 2.6 Run browser validation for shared UI, login, data center, interactive learning, teacher/admin, and representative student pages.

## 3. OpenSpec Validation

- [ ] 3.1 Run `rtk openspec validate upgrade-react-19-ui-runtime --strict`.
