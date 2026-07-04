## Why

Shell consistency cannot rely on manual visual review alone. New routes can be added without AppShell, wrappers can omit breadcrumbs, and page-level actions can reintroduce inconsistent Personal Center and theme placement.

After the contract and migrations land, the repository needs a durable governance gate that makes shell coverage measurable.

## What Changes

- Add static and runtime tests for universal AppShell route and governed-wrapper coverage.
- Add a route exception inventory with explicit owner, reason, violated rule, and removal condition.
- Add a governed wrapper registry; wrapper coverage counts only after the wrapper itself passes the shell DOM contract.
- Add DOM assertions for top-right action order, breadcrumb presence, and canonical navigation order.
- Add fixed viewport visual audit evidence for primary and deep route matrices.
- Make the tests fail when a non-exempt page lacks the unified shell.

## Impact

- Depends on the contract and route migration changes.
- Adds test/gov tooling and route-matrix fixtures.
- Does not perform broad UI migration by itself; it verifies that the migrations are complete.
