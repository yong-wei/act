## Why

The dependency tree has real residual signals that should not be mistaken for local noise: Next currently embeds vulnerable `postcss <8.5.10`, ESLint 8 produces deprecated transitive warnings, Tailwind 3 brings a deprecated `glob@10.5.0`, and Drei 9 brings `three-mesh-bvh@0.7.8`. These should be owned and classified so low-risk dependency refreshes can proceed without masking true risk.

## What Changes

- Add explicit ownership and temporary disposition for residual dependency audit and deprecation findings.
- Reject unsafe automatic `npm audit fix` recommendations such as downgrading Next.
- Define which residuals are allowed temporarily, which require a low-risk patch/minor refresh, and which require dedicated major migrations.
- Do not upgrade Next, React, R3F, Drei, Prisma, Tailwind, or other packages in this ownership change.

## Capabilities

### Modified Capabilities
- `dependency-audit-governance`: Extends audit governance to cover residual audit/deprecation signal ownership before dependency upgrades.

## Impact

- Affects dependency audit governance configuration and documentation.
- Leaves actual package upgrades to later dependency refresh or framework migration changes.
