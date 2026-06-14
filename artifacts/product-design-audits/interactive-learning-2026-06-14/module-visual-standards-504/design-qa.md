# Interactive Module Visual Standards QA

Change: `define-interactive-module-visual-standards`
Date: 2026-06-15
Final result: passed

## Source Visuals

- Handoff: `artifacts/product-design-audits/interactive-learning-2026-06-14/design-handoff.md`
- Student/guest runtime reference: `artifacts/product-design-audits/interactive-learning-2026-06-14/concepts/revised/03-student-guest-runtime.png`
- Teacher projection reference: `artifacts/product-design-audits/interactive-learning-2026-06-14/concepts/revised/06-teacher-projection-runtime-compact-navigation.png`

## Implementation Evidence

Screenshots were generated from `renderInteractiveManifestStep` server-rendered markup using the registered module chrome classes and data markers.

| State | Role | Theme | Viewport | Module State | Screenshot |
| --- | --- | --- | --- | --- | --- |
| Content module | student | light | 1440px desktop | content chrome | `student-content-light-1440.png` |
| Media/diagram module | guest | dark | 1440px desktop | media chrome, no teacher analytics | `guest-media-dark-1440.png` |
| Choice interaction | student | light | 390px mobile | interaction chrome, module-scoped controls | `student-choice-light-390.png` |
| Ordering interaction | student | dark | 1440px desktop | ordering response, module-scoped controls | `student-ordering-dark-1440.png` |
| Teacher controls | teacher | dark | 1440px desktop | module-scoped teacher control | `teacher-control-dark-1440.png` |
| Fallback/support | teacher | dark | 1440px projection | projection-readable stable panel | `projection-fallback-dark-1440.png` |
| Invalid fallback | student | light | 1440px desktop | missing renderer inside shared chrome | `invalid-fallback-light-1440.png` |

## Checks

- Registered chrome covers all canonical module classes in `INTERACTIVE_MODULE_VISUAL_STANDARDS`.
- Runtime chrome emits standard class, category, role, theme, viewport, projection-safe, geometry, teacher-control, and control-scope markers.
- Teacher controls are scoped by module id, so pages with multiple interactions keep controls attached to the correct module.
- Registry gate rejects course-local chrome fields such as `className`, `chromeClassName`, `moduleChrome`, `localChrome`, `visualChrome`, and `wrapperClassName`.
- Registry scan rejects raw top-level course-local chrome before runtime manifest normalization can strip it.
- Projection evidence uses stable panel geometry and projection-readable typography.
- Invalid required modules keep the shared module chrome and projection markers while displaying the missing renderer state.
- Student and guest evidence does not expose teacher analytics or real evidence state.

## Findings

- P0: none.
- P1: none.
- P2: none.
- Review follow-up: critical review initially blocked on missing invalid-state chrome, raw top-level chrome leakage, and incomplete visual evidence. All three findings were fixed and reverified.

## Verification

- `rtk npx vitest run src/features/interactive/__tests__/interactive-commercial-module-chrome.test.tsx src/features/interactive/__tests__/interactive-module-registry-gate.test.ts`
- `rtk npx tsx -e "import { scanRuntimeInteractiveModuleRegistry } from './src/features/interactive/shared/manifest-runtime/module-registry-gate'; const r=scanRuntimeInteractiveModuleRegistry(); console.log(JSON.stringify({passed:r.passed, scannedModules:r.scannedModules, total:r.violations.length}, null, 2)); process.exit(r.passed ? 0 : 1);"`
