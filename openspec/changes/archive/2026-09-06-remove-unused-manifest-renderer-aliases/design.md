## Context

中心 `createManifestContentModuleRegistry` 现有 85 个 handler：17 个 canonical 与 68 个旧 alias。现用 manifest 通过 normalization 后按 canonical kind 渲染，课程私有 registry 仍直接调用 13 个别名。

## Goals / Non-Goals

目标是把分发表从 85 项减至约 30 项，去掉无效兼容分支。

不改 `module-taxonomy.ts` 的别名规范化/拒绝规则，不删 `payload.legacyKind`，不处理历史 review JSON，不移动现有组件，不改 compute plugin owner、学生/教师投影和持久化。

## Decisions

1. 保留实际调用的 `interactive-figure-panel`、`native-formula-table`、`native-figure`、`stat-panel`、`equation-card-row`、`comparison-table`、`question-card-row`、`formula-card`、`native-table`、`template-card`、`evidence-bank`、`example-card`、`summary-card`。
2. 删除其余 55 个旧 handler：stage-map、goal-card-row、goal-card-set、question-card-set、formula-card-row、formula-chain、summary-card-row、summary-card-grid、question-card、boundary-card、process-card、objective-list、bullet-card、reason-record、notice-card、structured-compare、row-focus-toggle、tab-selector、overlay-strip、graphic、rule-card-row、card-bank、worked-example-card、condition-list、reference-answer-card、comparison-graphic、band-focus-panel、ai-compare-workspace、revision-note、case-context-card、metric-strip、teacher-strip、next-step-card、reflection-card、key-task-card、next-step-card-row、bullet-list-card、table-card、image-panel、figure、media-card、figure-note、rust-analysis-panel、rust-time-compare-panel、rust-bode-compare-panel、learning-stat-panel、performance-summary、problem-statement、title-card、quiz-stack、route-card、step-reveal、reveal-chain、step-reveal-chain、step-reveal-column。
3. 入口先规范化，旧 kind 由现有验证处理；不新增一个通用旧别名 fallback。未知 capability 继续显示既有缺失标记。
4. 只调整验证旧分支存在性的测试，保留有效课程渲染与行为检查。直接引用分析与普通 diff 足够，不生成 caller 清单文件或新证明工具。

## Risks / Trade-offs

课程通过 `legacyKind` 间接调用 → 实施时核对课程私有 registry 和支持的动态输入入口；若出现真实依赖，局部保留或迁至现有 canonical handler，不扩大成整个 manifest 重写。

`unify-interactive-lesson-component-style` 文档涉及同文件样式 → 本项只删 registry entries，不改共享 chrome、样式和 DOM 标记。
