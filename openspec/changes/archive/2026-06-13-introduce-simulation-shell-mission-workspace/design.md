## Design

### 1. Thin Shared Shell

`SimulationShell` is a display-only wrapper around AppShell. It owns route-level navigation, breadcrumbs, theme switching, profile access, return target metadata, and commercial workspace markers. It does not compute simulation state or alter runtime props.

### 2. Scene Primacy

The primary simulation component remains the first substantial workspace content. Simple routes render their existing scene in the shell instrument area without adding side rails. Routes with existing evidence/support content, such as Cruise Arena launch context, may provide lightweight shell zones while preserving current domain-owned panels.

### 3. Route Inventory

Simulation detail routes are first-class `mission-workspace` routes. The inventory records contextual return to `/simulations`, floating dock behavior, route files, and representative coverage. Migrated pages should not retain `FeaturePageNav` legacy shell dispositions.

### 4. Runtime Preservation

The migration only changes page composition around existing dynamic simulation loaders. Runtime components, API calls, model clocks, Rust/WASM adapters, Arena submission queries, and telemetry bridge code remain untouched.

## Risks

- AppShell adds route chrome above scenes; tests must verify primary scene markers remain present.
- Cruise has Arena context and a submission panel; its route data attributes and black-box panel must survive wrapping.
- Route inventory tests must distinguish migrated simulation pages from remaining unrelated legacy-shell exceptions.

## Verification

- Source tests assert all migrated pages use `SimulationShell` and no longer import `FeaturePageNav`.
- Route inventory tests assert detail routes are registered mission workspaces with return targets.
- Playwright verifies representative detail pages render the shell, breadcrumbs/profile action, and simulation scene entry without opening every runtime path manually.
