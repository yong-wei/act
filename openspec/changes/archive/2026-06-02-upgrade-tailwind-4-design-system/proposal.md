## Why

Tailwind is the design-system compiler for the application. Tailwind 4 changes CSS import and PostCSS integration, so it must be handled as a visual and build migration rather than a simple package bump.

## What Changes

- Upgrade Tailwind CSS to the selected latest stable Tailwind 4 line and add required PostCSS integration packages.
- Migrate PostCSS config and global CSS directives.
- Preserve existing platform tokens, dark mode behavior, utility layers, and commercial UI governance gates.
- Perform browser and visual validation across representative public, authenticated, data center, interactive, and simulation routes.

## Capabilities

### Modified Capabilities
- `stable-dependency-chain-migration`: Requires design-system package upgrades to include visual browser validation.
- `platform-design-system-and-shell`: Preserves platform token and shell behavior through Tailwind migration.
- `commercial-ui-governance-gates`: Preserves commercial UI governance checks after CSS compiler migration.

## Impact

- Affects Tailwind/PostCSS package versions, `postcss.config.js`, `tailwind.config.ts`, `src/app/globals.css`, generated CSS, and visual presentation.
- High UI regression risk; should run after framework/runtime migrations have stable signals.
