## 1. Freeze the current UI gap

- [x] 1.1 Add failing tests for the active single-select type dropdown, inline horizontal relation buttons and permanent visible node directory.
- [x] 1.2 Record desktop/mobile toolbar collisions, long English labels, keyboard order and Teaching-unavailable/edge-empty fallback behavior.
- [x] 1.3 Define one stable filter-state model for registered materialized node types and loaded/available relation families.

## 2. Build the dedicated filter panel

- [x] 2.1 Implement one responsive panel/drawer with independent multi-select node-type and relation-family controls.
- [x] 2.2 Reuse registered node glyph and relation line/direction samples, including evidence/failure states, without displaying raw enums.
- [x] 2.3 Move family loading errors, retries and availability status into the panel while keeping the existing bounded shard loader.
- [x] 2.4 Keep the global workspace toolbar limited to version, language, dimension, fit, reflow and domain return actions.

## 3. Preserve graph and locale state

- [x] 3.1 Preserve coordinates, pins, settlement, camera, selection, loaded shards and inspector state across type/relation toggles.
- [x] 3.2 Reheat only the affected scope when a newly enabled family adds verified nodes or edges; do not reheat on visibility-only changes.
- [x] 3.3 Preserve filter values by stable identity across 2D/3D and Chinese/English while keeping Active and Legacy sessions isolated.

## 4. Remove the visual node directory safely

- [x] 4.1 Keep semantic node controls screen-reader accessible but visually hidden in ordinary graph states.
- [x] 4.2 Remove the Teaching-unavailable and edge-empty conditions that expose the bottom all-node grid.
- [x] 4.3 Provide bounded search/focus recovery and explicit accessible empty states without loading or listing the full domain.
- [x] 4.4 Add keyboard, focus trap/restore, screen-reader name and mobile drawer tests.

## 5. Verify the change

- [x] 5.1 Run direct filter model, family loading, state preservation, accessibility and responsive component tests plus the affected graph domain suite.
- [x] 5.2 Run bilingual desktop/mobile visual and interaction checks for long panels, every control family, zero-edge domains and absent Teaching.
- [x] 5.3 Run typecheck, lint, full `npm run test`, build, commercial UI governance and strict OpenSpec validation on the final clean revision.
  - typecheck、lint（零警告）、full `npm run test`（干净树 receipt exit 0）、OpenSpec strict 通过。
  - commercial UI governance：4 项预存在失败（edge-presentation source-scan、semantic-map artifacts 截图、governance 2 项）经 stash 对照与本变更无关。
  - `npm run build`：`/ai` 页面 collect 失败于 `teacher-assignment-review-derivative-storage.ts` 字体 `fileURLToPath(new URL(...))` 的 turbopack SSR 模块评估（本机 Node 26 环境），与本 change 无依赖交集，属预存在构建链债务，需独立跟踪。
- [ ] 5.4 Obtain independent review of legacy-equivalent control semantics, no visible node directory and no hierarchy/state regression.
  - 由 PR 的 `@codex review` 承担独立审查。
