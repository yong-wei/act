## Why

The default `npm run test` currently fails on commercial UI governance for `/`. That failure is not a dependency issue: it reports raw page-local palette usage and an unregistered route frame on the homepage. The signal should be settled as product/UI governance work before dependency upgrades rely on `npm run test`.

## What Changes

- Remove or explicitly migrate the homepage commercial UI governance violations.
- Ensure `/` uses the registered shell/frame contract expected by the platform UI system.
- Ensure homepage colors use approved platform tokens or documented primitives rather than page-local raw palettes.
- Do not weaken the commercial UI governance gate or add broad allowlists.

## Capabilities

### Modified Capabilities
- `commercial-ui-governance-gates`: Requires default test gating to distinguish real UI debt from dependency noise.

## Impact

- Affects homepage route shell and visual token usage.
- Restores `npm run test` as a reliable smoke/governance signal.
- Does not perform broader brand redesign or dependency upgrades.
