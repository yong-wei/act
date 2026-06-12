## Why

React Doctor is already installed as a local UI health gate, but the current scan mixes owned product code with non-product evaluation fixtures and produces more than four thousand warning-level diagnostics. That makes the signal too noisy for release planning and hides the small set of findings that should become real blockers.

This change establishes owned-surface React Doctor gates so later cleanup work can prove zero error diagnostics and zero security warnings without treating unrelated samples or low-priority advisory rules as product failures.

## What Changes

- Add a project-owned React Doctor scan boundary that excludes embedded sample repositories such as `evaluate/**/*` and other non-product fixtures.
- Keep the existing pinned local React Doctor version `0.5.1` and CI-free execution policy.
- Provide machine-readable local commands or scripts for:
  - error-only diagnostics that must reach zero before the series completes.
  - security-category diagnostics that must reach zero before the series completes.
  - advisory warning summaries that remain review evidence, not default blockers.
- Document how React Doctor output should be classified into blocker, planned remediation, advisory, or ignored fixture noise.
- Update governance tests or docs so future agents do not reintroduce broad noisy scans.

## Capabilities

### New Capabilities

- `react-doctor-local-governance`: Defines local React Doctor scan scope, blocker severity, security warning handling, and report expectations.

### Modified Capabilities

- `release-signal-noise-governance`: Clarifies that React Doctor validation commands must scan owned product surfaces and exclude sample repositories.

## Impact

- Affects `package.json` scripts, optional React Doctor configuration, local validation helpers, and governance documentation/tests.
- Does not repair React component code, iframe security findings, or state/effect findings; sibling changes own those repairs.
- Does not wire React Doctor into GitHub Actions while CI quota is constrained.
