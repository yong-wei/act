## 1. Implementation

- [x] Update `src/app/globals.css` to disable Tailwind automatic source detection and register only frontend business source roots and UI helper modules.
- [x] Keep project-local OpenSpec Buddy skill symlinks valid for the current `/Users/YW` path migration.
- [x] Ensure agent/tooling directories are not scanned by Tailwind/Turbopack page CSS compilation.

## 2. Verification

- [x] Run `npm ci` after deleting `node_modules`.
- [x] Run `npm run test`.
- [x] Run `npm run test:unit`.
- [x] Run `npm run build`.
- [x] Start the local service with `npm run startup`.
- [x] Verify `http://127.0.0.1:3001/login`.
- [x] Verify `http://127.0.0.1:3001/interactive-learning`.
- [x] Verify `http://127.0.0.1:3001/api/readyz`.
- [x] Verify generated CSS includes representative utilities from `src/lib` UI class helpers.

## 3. Follow-up

- [ ] Record any remaining `npm audit` findings in dependency-audit governance rather than treating them as Tailwind/Turbopack source-boundary failures.
