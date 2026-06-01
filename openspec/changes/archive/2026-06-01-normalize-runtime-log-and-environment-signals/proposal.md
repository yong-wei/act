## Why

Runtime and environment signals are currently ambiguous. `.logs/error.log` can retain fixed historical errors without timestamps, Browserslist reports stale browser data, `node_modules` can show extraneous local packages, and `package.json` does not declare the supported Node or package-manager contract. These issues make local, CI, and server evidence harder to compare.

## What Changes

- Make runtime logs distinguish current-run errors from historical residue.
- Define how startup/shutdown and troubleshooting should clear, rotate, or timestamp logs.
- Add or validate project-level runtime environment declarations for Node and package manager.
- Define a clean-install signal for extraneous packages and Browserslist data updates.
- Do not perform dependency major migrations in this change.

## Capabilities

### New Capabilities
- Adds runtime/environment signal requirements to `release-signal-noise-governance`.

### Modified Capabilities
- None.

## Impact

- Affects local operations scripts, package metadata, and dependency hygiene commands.
- Reduces false positives during runtime verification after package updates.
