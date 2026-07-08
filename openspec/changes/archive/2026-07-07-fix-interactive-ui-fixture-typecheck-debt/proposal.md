## Why

`tsc --noEmit` reports 11 errors in interactive, classroom, assessment route-state, and AppShell governance tests. These are mostly stale UI/test fixtures: old manifest option fields, untyped DOM test shims, route-state prop drift, tracking mock typing, and UserRole literal drift.

## What Changes

- Update interactive manifest fixtures to current option and teacher-control contracts.
- Type classroom DOM shims and tracking mocks without broad suppression.
- Align route-state and AppShell governance test fixtures with current component and role contracts.

## Impact

- Targets 11 current TypeScript errors in 5 test/spec files.
- Does not change product UI behavior unless a test reveals a real typed prop contract bug.
