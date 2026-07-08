## Why

Existing resources have a large historical semantic-completion backlog. While that backlog is closed in batches, new registered resources must not enter the repository without complete reviewed metadata. Otherwise every import creates new invisible path-planning and citation gaps.

The current full-resource gate can report incomplete imports, but the developer workflow also needs a new-resource guard that fails on newly added or modified registered resources with missing disposition, graph bindings, K/A/Q targets, path profile, evidence policy, citation metadata, review metadata, or exclusion rationale.

## What Changes

- Add a staged completeness gate for newly added or modified registered resources and runtime resource projections.
- Wire the gate into the repository sync/hook workflow and an optional CI command without requiring GitHub Actions quota.
- Keep a baseline exception for existing backlog until the full closure change removes it.
- Require tests proving an incomplete new resource fails before commit and a complete reviewed resource passes.

## Impact

- Affects data-governance scripts, sync/hook setup, documentation, and tests.
- Does not automatically complete existing resources.
- Should run independently from the data-completion batches so new imports stop adding debt immediately.
