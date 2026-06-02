## Eligible Package Lane

Candidate packages include patch/minor updates such as:

- AI SDK patch updates on the current major line.
- Radix current-major patch/minor updates.
- BullMQ current-major minor updates.
- ECharts/Recharts/Zustand minor updates.
- Playwright and Vitest patch/minor updates compatible with the current app.
- Type packages that remain on the current React/Node major line.

## Excluded Package Lane

The following upgrades are explicitly out of scope:

- Next 16.
- React 19.
- Prisma 7.
- Tailwind 4.
- React Three Fiber 9, Drei 10, and latest Three.
- ESLint 10.
- TypeScript 6.
- `@types/node` 25.
- Zod 4.
- bcryptjs 3.
- `lucide-react` 1.
- `tailwind-merge` 3.

These excluded latest-stable majors remain owned by the baseline lane until a
follow-up governance/toolchain or validation/security change is created:

- ESLint 10, TypeScript 6, and `@types/node` 25: governance/toolchain owner.
- Zod 4 and bcryptjs 3: validation/security runtime owner.
- `lucide-react` 1: React UI runtime owner.
- `tailwind-merge` 3: Tailwind/design-system owner.

The low-risk refresh must report those lanes as deferred rather than treating
them as unresolved incidental drift.

## Validation Strategy

Use standard tests first, then add browser checks only if package changes affect UI runtime, charting, graphing, or interactive pages.
