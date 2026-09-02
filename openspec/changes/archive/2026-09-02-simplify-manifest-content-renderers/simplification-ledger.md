# Simplification ledger (C14)

Source commit at baseline: `f39ee00e6a7a30fde2618f5e94788c94b5ead2ba` (C13 squash).
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
- Same public `createManifestContentModuleRegistry` keys
- Named helpers: `renderSummaryModule`, `renderSummaryCardGrid`,
  `renderNativeTableModule`, `renderPayloadTextSummary`,
  `renderFormulaModule`, `renderStepRevealModule`

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
