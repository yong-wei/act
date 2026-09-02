# Simplification Ledger — simplify-smart-courseware-editor

## Before / After 状态 owner

| 数据 | Before | After |
|------|--------|-------|
| 空 envelope 构造 | 死工厂 `createSmartCoursewareDraftShell`（零调用）与 `page.tsx` 内联字面量并存 | 仅 `page.tsx` 内联（唯一活实现），死工厂删除 |
| envelope 构造参数化 | 工厂固定 `state: 'ready'` + `stalePlan` 参数闲置，`SmartCoursewareProjectionEditor` 构造后 mutate 两个字段 | 工厂签名 `(projection, stalePlan = false, state = 'ready')`，单次构造零 mutate |
| 步骤切换编排 | `onSelectSection` 与 `onSelectStep` 两份相同闭包（confirmVisualDiscard → setSelectedStepId → 首模块选中） | 单一 `selectStep(stepId)` 复用于 shell 侧栏与组合控件 |

## 删除的派生路径

- `createSmartCoursewareDraftShell`（21 行）：全仓零调用；`page.tsx` 的 `initialEnvelope` 字面量是同一结构的唯一活实现。
- `SmartCoursewareProjectionEditor` 中 `initialEnvelope.state = state; initialEnvelope.stalePlan = stalePlan;` 双行事后覆盖：工厂已有 `stalePlan` 参数（原调用未使用）。
- 两份重复的步骤切换回调闭包。

## 保留边界及理由

- `toInitialJob`（page.tsx）：单一 route→view 映射，丢弃 `output/outputTruncated` 是有意裁剪（JobPanel 已处理 undefined）。
- `CoursewareVisualFields` 本地草稿 ref 群（dirtyRef/editGenerationRef/baseVersionRef/localDraftRef）：冲突/恢复/防丢稿语义的最小实现，无重复。
- `SmartCoursewareJobView` 的宽字段：API 合同投影，非重复派生。
- `previewRole`/`studentPreview`/`approvedRevisionId` 等组件状态：各为唯一 owner。

## 行为等价证据

- `npm run test:smart-courseware` 30/30（角色投影、stale-plan、批准、恢复、冲突、本地草稿重试、队列失败、split/merge、教师证据）。
- `smart-lesson-plan-workspace-contract.test.ts` 9/9；preparation-document-editor contract + return-state 5/5。
- Playwright `smart-courseware-public-seam.spec.ts`：授权投影与定向重生成接缝通过（1280×390 / 390×844 双 viewport 双主题截图哈希）；`builds the approved plan ... real workers` 因外部 AI provider（siliconflow）调用失败在干净基线（stash 对照）同样失败，属既有环境失败，与本变更无关。
- `npm run typecheck` 0 错误；`npm run lint` 通过。
- diff：`smart-courseware-editor.tsx` 12 insertions / 38 deletions（净 -26 行），production bytes 净下降。

## Rollback

单一文件 revert 即可恢复工厂与重复回调；无数据、合同或 schema 变更。
