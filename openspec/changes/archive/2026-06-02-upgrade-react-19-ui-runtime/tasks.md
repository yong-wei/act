## 1. React Upgrade

- [x] 1.1 Upgrade `react`, `react-dom`, `@types/react`, and `@types/react-dom` to the selected React 19 stable line.
- [x] 1.2 Upgrade `lucide-react` to the selected latest stable line and verify icon import/tree-shaking compatibility.
- [x] 1.3 Resolve React 19 type and runtime compatibility errors.
- [x] 1.4 Keep Tailwind and Prisma major upgrades out of scope; absorb the 3D runtime stack only because React 19 peer compatibility required it for production-reachable simulation routes.

## 2. Compatibility Testing

- [x] 2.1 Run `rtk npx tsc --noEmit --pretty false`.
- [x] 2.2 Run `rtk npm run lint`.
- [x] 2.3 Run `rtk npm run test`.
- [x] 2.4 Run `rtk npm run test:unit`.
- [x] 2.5 Run `rtk npm run build`.
- [x] 2.6 Run browser validation for shared UI, login, data center, interactive learning, teacher/admin, and representative student pages.

## 3. OpenSpec Validation

- [x] 3.1 Run `rtk openspec validate upgrade-react-19-ui-runtime --strict`.
