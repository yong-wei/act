## 1. Session Foundation

- [x] Add tests for free-explore session model context, default object fallback, and `objectId` selection.
- [x] Extend route params and session context so free explore can carry a selected object.
- [x] Build the free-explore working model from the selected white-box object while keeping `officialTarget` null and official submission disabled.

## 2. Workbench Entry And Shell

- [x] Add or update route tests for the cross-domain primary entry href and visible “综合仿真工作台” wording.
- [x] Update the cross-domain exploration card to target `/interactive-learning/control-workbench?mode=explore&preset=classic-four-view`.
- [x] Rename the unified shell surface from “工作台外壳” to “综合仿真工作台” and return free exploration to the cross-domain catalog.

## 3. Classic Preset Free-Explore Rendering

- [x] Add tests showing the classic preset can mount without `taskId` when a transfer-function working model exists.
- [x] Remove the `taskId` gate from the classic preset and shell mount condition.
- [x] Pass the selected free-explore plant model into the embedded multi-representation client.
- [x] Extend the multi-representation model hook to use a configured plant model outside Arena challenge mode.

## 4. Validation

- [x] Run `openspec validate comprehensive-simulation-workbench-foundation --strict`.
- [x] Run targeted Vitest suites for control workbench and cross-domain route assertions.
- [x] Run the existing Playwright entry-route check if the local app verification path is available.
