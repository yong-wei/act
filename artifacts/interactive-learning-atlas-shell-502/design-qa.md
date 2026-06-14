# Interactive Learning Atlas Shell Design QA

Change: `unify-interactive-learning-atlas-shell`

Final result: passed

QA runner: equivalent per-change design QA report. The current Codex session did not expose a callable Product Design `design-qa` tool; the accepted handoff allows `design-qa.md` or an equivalent child-change QA report.

## Source Visuals

- `artifacts/product-design-audits/interactive-learning-2026-06-14/design-handoff.md`
- `artifacts/product-design-audits/interactive-learning-2026-06-14/concepts/01-learning-atlas-course-catalog.png`
- `artifacts/product-design-audits/interactive-learning-2026-06-14/concepts/revised/01-course-catalog-theory-practice.png`

## Implementation Screenshots

| State | Viewport | Theme | Screenshot |
| --- | --- | --- | --- |
| Landing atlas | 1440x900 | light | `screenshots/01-landing-desktop-light.png` |
| Course catalog | 1440x900 | light | `screenshots/02-courses-desktop-light.png` |
| Chapter components | 1440x900 | light | `screenshots/03-chapter-components-desktop-light.png` |
| Cross-domain list | 1440x900 | light | `screenshots/04-cross-domain-desktop-light.png` |
| Course catalog | 1440x900 | dark | `screenshots/05-courses-desktop-dark.png` |
| Course catalog | 320x760 | light | `screenshots/06-courses-mobile-light.png` |
| Cross-domain list | 320x760 | dark | `screenshots/07-cross-domain-mobile-dark.png` |
| Course catalog dock menu | 1440x900 | light | `screenshots/08-courses-dock-expanded-light.png` |
| Landing atlas | 320x760 | light | `screenshots/09-landing-mobile-light.png` |
| Landing atlas | 320x760 | dark | `screenshots/10-landing-mobile-dark.png` |
| Course catalog | 320x760 | light | `screenshots/11-courses-mobile-light.png` |
| Course catalog | 320x760 | dark | `screenshots/12-courses-mobile-dark.png` |
| Chapter components | 320x760 | light | `screenshots/13-chapter-components-mobile-light.png` |
| Chapter components | 320x760 | dark | `screenshots/14-chapter-components-mobile-dark.png` |
| Cross-domain list | 320x760 | light | `screenshots/15-cross-domain-mobile-light.png` |
| Cross-domain list | 320x760 | dark | `screenshots/16-cross-domain-mobile-dark.png` |
| Landing atlas | 1440x900 | dark | `screenshots/17-landing-desktop-dark.png` |
| Chapter components | 1440x900 | dark | `screenshots/18-chapter-components-desktop-dark.png` |
| Cross-domain list | 1440x900 | dark | `screenshots/19-cross-domain-desktop-dark.png` |

## Focused Comparison

- AppShell breadcrumbs are present on all first-hop atlas routes.
- Desktop navigation is verified in collapsed state and uses the shared persisted preference.
- Outer route containers are fluid workspace surfaces; fixed 1200/1280px centered shells are absent.
- Course catalog labels are restricted to `理论课` and `实践课`; duration and status markers are sourced through `runtimeCardMetadata`.
- Repeated entries remain card-like, while page sections are unframed bands rather than nested cards.
- Shared platform floating dock is present and exposes the single global `控灵` entry from the dock menu.
- 320px light and dark mobile screenshots cover all four first-hop atlas routes and show no horizontal overflow.
- Some long full-page captures repeat the fixed shell chrome at the end of the image; DOM metrics and viewport captures confirm this is a screenshot capture artifact, not duplicate page content.

## Blocking Findings

None.
