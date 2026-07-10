# Issue #894 Knowledge Graph Node Expansion Design QA

## Verdict

representative verdict: PASS

matrix A verdict: PASS

matrix B1 verdict: PASS

matrix B2 verdict: PASS

matrix C verdict: PASS

The final headed Chromium hybrid evidence passes every executed representative and matrix group. The final surface-evidence recapture reran B1, C, and representative; all pass with real mobile and desktop dock/Konling states. The surface-aware control resolves the former mobile-panel obstruction while preserving the 24–64 px normal-distance contract whenever a zero-overlap point exists; the B1 stress record is 56.569 px with `data-anchor-clamped=true` and zero overlap.

## Source and capture provenance

- Source cwd: `/Users/YW/.codex/worktrees/e946/act.just.edu.cn`
- Source git SHA: `ed025d5d1ea1db1af0c8d8622df80c2e4e080cdb`
- Route: `http://localhost:3101/knowledge`
- Viewport/theme/mode: 1440×960, dark, 2D
- Browser recorded by the manifest: `chromium-headed`
- Capture command: `PLAYWRIGHT_HEADLESS=false ISSUE_894_SCREENSHOT_MODE=hybrid ISSUE_894_BASE_URL=http://localhost:3101 ... capture-knowledge-graph-node-expansion-894.ts`
- Manifest: `browser-evidence.json`
- Final B1: exit 0 in 9.52 s; completed `2026-07-10T12:01:47.868Z`.
- Final C: exit 0 in 14.92 s; completed `2026-07-10T12:03:41.453Z`.
- Final representative: exit 0 in 18.13 s; captured `2026-07-10T12:04:18.817Z`.
- Representative/C source-tree hash: `0a5a083233a9ec9dabb8675a9ca0484c30f5e4411bb5d9d4d76f0a1c84777f4f`.
- A and B2 were not rerun; their previous PASS manifests remain the geometry/orbit evidence of record.

Hybrid capture uses the `html` element screenshot path for ordinary states and the page screenshot path for the pinned-expanded state. The pinned state therefore retains the full headed-browser rendering while the general states use deterministic element-bounded capture.

Port 3001 belongs to the 39ff worktree and was not touched. `openwolf designqc` was not run because it would inspect that different source tree.

## Required screenshot review

| Required state | Evidence | Review |
| --- | --- | --- |
| collapsed with keyboard focus | `1440x960-dark-2d-collapsed-focus.png` | complete |
| loading with keyboard focus | `1440x960-dark-2d-loading-focus.png` | complete |
| expanded | `1440x960-dark-2d-expanded.png` | complete; four children and labels visible |
| expanded with pinned child | `1440x960-dark-2d-expanded-pinned-child.png` | complete |
| collapsed again | `1440x960-dark-2d-collapsed-again.png` | complete |

Supplemental `1440x960-dark-2d-expanded-again.png` is also complete in the headed hybrid capture.

## Keyboard and accessibility evidence

The first expansion uses real keyboard interaction:

1. Tab traversal reaches the node-local expansion control.
2. Enter activates expansion.
3. The delayed graph route holds the loading state for capture.
4. The loading record reports `activeElement=true`, `focusVisible=true`, `visibleFocusRing=true`, and `ariaBusy=true`.
5. The screenshot visibly preserves the focus ring around “加载中”.

No pointer click followed by programmatic focus is used for first expansion.

After the focus-race fix, the representative expanded state reached after the delayed response also reports `activeElement=true`, `focusVisible=true`, and `visibleFocusRing=true`. B1 repeats the same result at 320×800: collapsed, loading, and expanded-focus all preserve visible keyboard focus; loading reports `aria-busy=true`. The inspector focus trap, Escape return to the knowledge canvas, and six-Tab route back to the real expansion control remain valid.

## Quantitative regression

- Four direct children and their conservative label envelopes are inside the canvas.
- Bounded reveal translation is 154.223 px, within the 169.4 px limit.
- Zoom remains unchanged at `k=1.6763392857142858`.
- Automatic repeat displacement for all three non-pinned children is 0 graph units.
- Pinned baseline and final coordinates are both `(0,155,0)`; displacement is 0 graph units.
- Pin signature remains stable through collapse and re-expansion.
- Unrelated-node P95 and maximum displacement are both 0 graph units.
- Four direct links remain visible.
- Selected-parent control distance is 56.569 px, within the normal 24–64 px range.
- Recorded viewport clearance, 44×44 target, route containment, and rectangle non-overlap checks pass.

The earlier edge-clipping defect is not reproduced: the complete expanded screenshot shows all four direct children and labels.

## Headless capture failure history

Earlier headless Chromium runs produced incomplete loading, pinned, or re-expanded screenshots with large black regions and missing shell pixels even when DOM and coordinate metrics were correct. Additional RAF waits, stable-state waits, and isolated contexts did not make that capture path reliable.

Those artifacts were a Chromium canvas/shell compositing failure in the headless evidence path, not a demonstrated production regression. The headed hybrid recapture supersedes them. Current screenshot hashes and `browser=chromium-headed` in `browser-evidence.json` bind the PASS verdict to the replacement evidence.

## Measurement-invalid and unverified

- Atomic radial geometry remains `measurement-invalid` because the current real-page hook yields one selected projection at a time. Preliminary diagnostic values are 270° angular coverage, centroid ratio 0, radius CV 0, and four 96-unit radii; they are not used as acceptance evidence.
- Exact 3D camera and OrbitControls target vectors remain unverified because no existing page read hook exposes them.
- Mock-only child selection triggers expected inspector detail 404s for `/api/knowledge/nodes/issue-894-child-{1..4}`; expansion payloads succeed and no production test backdoor is present.

## Matrix evidence

Batch A passes:

- 1440×960 light 2D collapsed-focus and expanded-inspector.
- 1440×960 dark 3D collapsed, expanded, and orbit-expanded. Orbit movement is 15.573 px and selected/expanded/pinned/ARIA continuity is retained.

B1 dark core passes:

- The mobile inspector focus trap contains all tested Tab stops.
- Escape closes the inspector and returns focus to the knowledge canvas.
- Six subsequent real Tab presses reach the expansion control; no programmatic `.focus()` is used.
- Collapsed, loading, and expanded states satisfy 8 px clearance, 44 px target size, 24–64 px node distance, ARIA state, four-link expansion, no horizontal overflow, and recorded control/surface non-overlap.
- The post-focus-race rerun records active element, `:focus-visible`, and visible ring as true for collapsed, loading, and expanded-focus; asynchronous completion no longer loses the required focus evidence.

B1 light expanded-focus passes:

- Theme class: `light`.
- Control size: 50×44 px; selected-node distance: 56.488 px.
- Focus ring, `aria-expanded=true`, four direct links, `scrollWidth=320`, and all recorded non-overlap checks pass.

B1 dark stress passes:

- Control distance: 56.569 px with `data-anchor-clamped=true`.
- Mobile toolbar and open filter panel both record zero control overlap and zero inter-surface overlap.
- Edge clearances are 119 / 434.775 / 119 / 23.225 px; the route remains exactly 320 px wide.
- Before opening Konling, the real dock/page-floating-controls occupy `(206,744)-(296,784)` while the control occupies `(135,600.775)-(185,644.775)`; the mobile tools, filter panel, dock, and control have zero recorded overlap.
- After opening the real Konling entry, the sidebar covers `(0,0)-(320,800)` with `role=dialog` and `aria-modal=true`. The underlying expansion control is suspended (`controlRect=null`), dock/page controls are hidden for the modal lifecycle, and selected/expanded context remains intact.

B2 passes:

- 320×800 dark 3D collapsed, expanded, and orbit-expanded all retain the same real button anchored to `chapter-node:第一章`.
- Orbit moves the control 70.77 px and preserves selected parent, expanded count, pin signature, `aria-expanded`, four links, and zero surface overlap through 3D→2D→3D.
- 320×800 light 3D expanded-focus passes keyboard focus, ARIA, route-width, link, and non-overlap checks.

Batch C passes:

- 1440×960 light 3D expanded-focus passes with four links and 2D→3D continuity.
- 1440×960 dark 2D pre-open stress keeps the relation panel, inspector, real dock, and page-floating-controls clear of the node-local control. Dock/page controls occupy `(879,904)-(969,944)`.
- After opening the real desktop Konling entry and waiting for the stable transition, the sidebar occupies `(549,112)-(969,944)` and the control occupies `(491,725.071)-(541,769.071)`; all recorded overlaps are false. Dock/page controls are suspended while the sidebar is open, matching the launcher lifecycle.
- 1279×800, 1100×800, and 1024×800 dark 2D expanded states record 56.556, 56.277, and 56.285 px control distances; all are unclamped, zero-overlap, and horizontally contained.

Evidence manifests:

- `matrix-evidence.json`
- `matrix-evidence-b1.json`
- `matrix-evidence-b2.json`
- `matrix-evidence-c.json`

## Severity

- Production blocking findings in the final candidate: none in the executed matrix.
- Real dock/page-floating-control/Konling evidence: verified on mobile and desktop through pre-open and opened lifecycle states.
- Representative screenshot completeness: 5/5.
- Representative and batches A/B1/B2/C quantitative checks: passed.
