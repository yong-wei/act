# Simplification ledger (C14)

Source commit at baseline: `f39ee00e6a7a30fde2618f5e94788c94b5ead2ba` (C13 squash).
Implementation commit: `c37db55781ec1608354665930640075464eacac7`.
File: `src/features/interactive/shared/manifest-runtime/content-renderers.tsx`

## Before

- Lines: 4891
- Kind handlers in `createManifestContentModuleRegistry`: 85
- Unique handler bodies: 46
- Duplicate pattern: 28 identical `summaryContent` + `SummaryCard` branches;
  3 identical no-column `CardGrid` branches; 4 column-variant `CardGrid`
  branches; 3 identical `NativeTable` branches; 3 identical rust payload
  summaries; 2 identical `FormulaCard` branches; 3 identical empty-guard
  `StepReveal` branches.

## After

- Lines: 4747 (−144)
- `function` / `export function` count: 171 → 177 (+6 named helpers)
- Kind handlers: 85 keys retained
- Unique handler bodies reduced by the 6 helper families above
- Named helpers: `renderSummaryModule`, `renderSummaryCardGrid`,
  `renderNativeTableModule`, `renderPayloadTextSummary`,
  `renderFormulaModule`, `renderStepRevealModule`

## Import / public surface (unchanged)

Production imports still use
`@/features/interactive/shared/manifest-runtime/content-renderers`.
Public exports unchanged:

- `createManifestContentModuleRegistry`
- `ManifestCodeBlock`
- re-exports `tryBeginControlWorkbenchSubmission`,
  `buildControlWorkbenchRequestForSubmission`,
  `buildSharedControlWorkbenchEvidenceDraft`

No new files under `manifest-runtime/`. Plugin compose remains
`[staticSurface3DPluginSet, controlWorkbenchPluginSet, interactiveFigurePluginSet]`.

## Verification commands (exit 0 unless noted)

| Command | Result | Coverage |
| --- | --- | --- |
| `npx vitest run …/manifest-runtime-plugin-registry.test.ts` | 23 passed | plugin compose, missing/ambiguous/version, unclaimed, registration retirement |
| `npx vitest run …/real-manifest-static-surface-plugin.test.tsx` | 5 passed | 1-2 static-surface-3d plugin path, student/teacher identical projection |
| `npx vitest run …/interactive-module-registry-gate.test.ts` | 85 passed | canonical classes, role chrome, missing kinds, control-workbench, formula/figure/table |
| `npx vitest run …/unit-1-2-course.test.ts` | 23 passed | compute.panel plugin, no interactive-figure-panel leak |
| `npx vitest run …/generated-courseware-resource-renderer.test.tsx` | 3 passed | generated-courseware uses canonical registry |
| `npx vitest run …/manifest-response-prefill-renderer.test.tsx` | 3 passed | response prefill |
| `npx eslint src/features/interactive/shared/manifest-runtime/content-renderers.tsx` | clean | |
| `npm run typecheck` | exit 0 | |
| `git diff --check` | clean | |

`interactive-manifest-runtime.test.tsx` still has 1 pre-existing failure in
`activity-renderers.tsx` drag-match source scan (`onDrop`/`assignToSlot`);
that file was not modified.

Role: static-surface-3d student/teacher HTML identical (plugin test).
Missing-renderer: plugin-registry version-missing marker, no fallthrough.
Evidence: rendering remains side-effect free; workbench evidence re-exports
unchanged.

## Accepted transformations

1. Deduplicate 28 summary-card kind branches into `renderSummaryModule`.
   Behavior: unchanged `titleFromModule(module)` + `summaryContent`.
   Tests: registry-gate canonical classes, manifest-runtime formula/table/reveal.
2. Deduplicate CardGrid text-item branches into `renderSummaryCardGrid`
   with optional `columns` (omit vs pass preserved).
3. Deduplicate native table kinds into `renderNativeTableModule`.
4. Deduplicate rust payload summaries into `renderPayloadTextSummary`.
5. Deduplicate formula-card / formula-card-row into `renderFormulaModule`.
6. Deduplicate step-reveal / reveal-chain / step-reveal-chain into
   `renderStepRevealModule`; `step-reveal-column` uses the helper then
   summary fallback.
7. Unclaimed/fallback SummaryCard sites call `renderSummaryModule`.
8. `comparison-table` uses table helper then summary fallback.

## Rejected

- Mapping object that hides kind keys (grep/callers need explicit keys).
- Merging `content.reveal` into `renderStepRevealModule` (`titleFromModule(module, step)` differs).
- File split of `content-renderers.tsx` (spec: not a simplification).
- Plugin contract / registry compose changes.

## Deferred

- Remaining unique kind branches (visual.*, compute.panel plugin lookup,
  image galleries with extra conditions). C14 does not require emptying the map.
