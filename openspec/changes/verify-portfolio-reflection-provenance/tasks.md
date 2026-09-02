## 1. Reproduce forged provenance

- [x] 1.1 Add a route/browser regression showing arbitrary URL `source`, `assignment` and `intent` values can currently become immutable saved provenance.
- [x] 1.2 Inventory every platform entry point that creates a portfolio-reflection candidate and identify its server-owned source identity.

## 2. Establish the provenance trust boundary

- [x] 2.1 Define the minimum source identity and provenance classification for platform-verified and student-provided reflections.
- [x] 2.2 Resolve canonical platform fields and learner authorization on the server before model execution and draft creation.
- [x] 2.3 Preserve free reflection through explicitly labeled student-provided fields without presenting them as verified sources.
- [x] 2.4 Keep saved provenance immutable while allowing only draft content edits and preserving discard/idempotency behavior.

## 3. Verify compatibility and auditability

- [x] 3.1 Prove forged URL display text cannot create platform-verified provenance or access another learner's source.
- [x] 3.2 Prove valid platform entry points save canonical provenance and survive refresh unchanged.
- [x] 3.3 Prove free reflection remains available with a visible student-provided classification and no formal learning-state writeback.
- [x] 3.4 Run focused task-boundary, draft route/database and browser tests, typecheck, strict change and repository OpenSpec validation, and `git diff --check`.

## 完成记录

- 1.1 复现证据：变更前 `parsePortfolioReflectionDraftInput` 接受任意 ≤160 字符无控制字符的 `source/assignment/intent/title`（既有用例「accepts the bounded displayed candidate」即以任意文本入库），PUT 契约 strict 仅允许 content，故 URL 文本一旦保存即为不可变 provenance。回归：`src/app/__tests__/portfolio-reflection-drafts-route.test.ts`（伪造载荷 400/学生分类）、`tests/portfolio-reflection-provenance-1865.spec.ts`（伪造 URL → 学生提供载荷，无 platform-verified 声明）。
- 1.2 入口清单：平台入口仅两个静态来源种类 `portfolio`（`portfolio/page.tsx` EmptyState 与重新生成链接）与 `learning-journal`（`ai-workshop-collections.ts` journals 动作）；无任何入口携带对象级任务/证据 ID。
- 2.1 `PortfolioReflectionSourceKind = 'portfolio' | 'learning-journal'` 注册表（`src/lib/ai-task-boundary-contracts.ts`）+ Prisma `PortfolioReflectionProvenance`（PLATFORM_VERIFIED / STUDENT_PROVIDED / LEGACY_UNVERIFIED，默认回填存量草稿）。
- 2.2 聊天边界：`resolveAiAuditTaskContext` 接受可选 `sourceKind`，命中注册表即用 canonical 字段覆盖展示文本并标记 `sourceTrust: 'platform-verified'`，未知 kind fail closed（invalid-shape → 400 INVALID_AI_TASK_CONTEXT）；草稿边界：POST 按 `provenance` 判别，平台类只收 kind+content+idempotencyKey，`resolvePortfolioReflectionDraftRecord` 从注册表派生 canonical 字段落库。授权：两种平台 kind 对全部已认证学生开放（静态标签），学生角色门禁保持原状。
- 2.3 学生自填候选渲染可编辑的 title/source/intent/assignment 输入并标注「学生提供」；平台候选只读展示「平台核验」。
- 2.4 PUT 契约维持 strict content-only；新增 provenance/sourceKind 改写尝试 400 回归；discard/idempotency 用例原样通过。
- 3.1 路由：伪造展示字符串附 platform-verified 声明 → 400；未知 sourceKind → 400（无 canonical 元数据泄露）。浏览器：伪造 URL 保存载荷为 student-provided 且不含 sourceKind。
- 3.2 浏览器：`source=portfolio` 入口保存载荷恰为 `{provenance, sourceKind, content, idempotencyKey}`，重开（draftId）后 canonical 快照与「平台核验」标注不变；Postgres 脚本断言 canonical 派生。
- 3.3 浏览器：任意 source 的自由反思可保存、重开、继续编辑内容，分类显示「学生提供」；Postgres 脚本断言 LearningFact 计数为 0。
- 3.4 聚焦 vitest 5 文件 70 用例通过；`npm run typecheck` exit 0（web graph blocked 为基线既有 course-content fixtures 噪音，干净基线同样存在）；Playwright `portfolio-reflection-provenance-1865.spec.ts`（3 用例）+ `portfolio-reflection-drafts-1321.spec.ts` 通过；`openspec validate verify-portfolio-reflection-provenance --type change --strict` 通过；`git diff --check` 通过。全量 vitest A/B（父提交 vs 本提交，同工作树）：失败集逐测试完全一致（102 个环境类预存失败：未构建 WASM identity、sealed authority 工件、DB 依赖路由），本变更新增失败 0；`openspec validate --specs --strict` 仅 1 项预存旧债（student-micro-tutoring-eligibility-projection），与本变更无关（本提交未触碰任何 openspec/specs 文件）。
