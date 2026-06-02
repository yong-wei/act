## Dependency Baseline Inputs

The baseline should capture these command outputs at the migration-branch HEAD used by the change:

- `rtk node -v`
- `rtk npm -v`
- `rtk npm outdated --long --json`
- `rtk npm audit --json`
- `rtk npm ls --depth=0 --omit=dev`
- `rtk npm ls --depth=0 --include=dev`
- `rtk npm explain postcss`
- `rtk npm explain tsx`

## Current Migration Shape

The dependency graph has four high-coupling lanes:

```text
production runtime
  Dockerfile -> docker-entrypoint -> Prisma CLI -> worker/scheduler -> tsx

frontend framework
  next -> react/react-dom -> eslint-config-next -> playwright peer -> route types

database runtime
  prisma/@prisma/client -> prisma.config.ts -> migrate deploy -> Docker env

design and 3D runtime
  tailwind/postcss -> globals.css -> visual regression
  react-three/fiber/drei/three -> simulation pages -> browser/canvas checks
```

## Staging Decision

The migration should proceed in a serialized series:

1. Baseline and validation matrix.
2. Production/runtime dependency boundary.
3. Low-risk stable package refresh.
4. Next 16 framework chain.
5. React 19 UI runtime.
6. Prisma 7 runtime.
7. Tailwind 4 design system.
8. 3D visualization stack.

This order keeps the production boundary and general verification gates clean before major framework migrations.

The baseline also owns dependency lanes that are intentionally deferred or
assigned to a later migration lane. ESLint 10, TypeScript 6, and `@types/node`
25 are governance/toolchain major migrations. Zod 4 and bcryptjs 3 are
validation/security runtime major migrations. `lucide-react` 1 is owned by the
React UI runtime lane, and `tailwind-merge` 3 is owned by the Tailwind/design
system lane. Baseline capture must record these latest-stable lanes with a
follow-up owner change or an explicit decision to keep the current major line.
The low-risk refresh must not silently absorb those migrations.

## Browser Verification Principle

Browser verification is required whenever a change touches:

- Next runtime behavior or route handling.
- React runtime behavior or UI component compatibility.
- Tailwind/PostCSS/CSS output.
- 3D visualization packages or simulation canvases.

The baseline should define the route set rather than run visual checks itself.
