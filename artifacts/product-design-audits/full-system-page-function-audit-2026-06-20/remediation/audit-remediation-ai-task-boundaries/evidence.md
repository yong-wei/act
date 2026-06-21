# audit-remediation-ai-task-boundaries 整改证据

日期：2026-06-21

## 覆盖范围

本变更关闭 AI/Prompt/Copilot 任务边界、学生可见 AI 内容脱敏、Prompt 页面主输入、AI 工坊报告反馈任务候选、Copilot 反思草稿和作品集反思 create 意图相关缺陷。学生报告反馈完整状态机、自适应路径完整执行链路、管理员配置模型测试和治理处置不在本变更中关闭。

## 审计证据来源

- `chapters/50-function-state-flows-batch42.md`：Global AI 可见回答暴露 `pageContext`、`knowledgeWorkspace`、`knowledgeCapabilityContext`、`currentPathId` 等内部上下文；发送按钮缺名称；loading/clear 缺状态播报。
- `chapters/55-function-state-flows-batch47.md`：Prompt 评价动作命中全局 AI 输入框，页面主任务输入优先级不成立。
- `chapters/62-function-state-flows-batch54.md`：Prompt autodemo 与历史 API 口径不清；AI 工坊动作没有形成学习任务；Copilot evidence 暴露内部对象；作品集 reflection query 不进入反思空态。
- `chapters/63-function-state-flows-batch55.md`：Prompt history 模式仍由全局 AI 输入驱动；`/ai?task=report-feedback` 不生成练习候选；Copilot 反思不生成作品集草稿；作品集 `intent=create` 不创建对象。

## 已落地整改

- `src/lib/ai-task-boundary-contracts.ts`
  - 定义 AI 审计任务合同：task type、context policy、output target、writeback behavior。
  - 提供学生可见 AI 内容脱敏，过滤内部上下文字段、诊断 JSON 和 provider/server context 片段。
  - 提供报告反馈练习任务候选和作品集反思草稿对象。
- `src/components/ai/ai-message-content.tsx`
  - 所有 AI message 渲染前经过 `sanitizeAiVisibleContent`。
- `src/components/ai/global-ai-sidebar.tsx`
  - 全局 AI 面板声明 `role="dialog"` 与 `aria-modal`，发送按钮补 sr-only 名称。
  - 增加 `role=status` / `aria-live=polite` 状态播报，清空对话后播报完成。
  - 工具结果不再以 JSON `pre` 暴露，改为产品化摘要。
- `src/app/evaluation/prompt-assessment/page.tsx`
  - 页面主 textarea 增加 `name`、`aria-label` 和 `data-primary-task-input`，避免被全局 AI 输入替代。
  - 显示 Prompt 评价任务状态、模式、输出目标和写回行为。
  - 增加停止当前请求、重试上次动作、清空本次结果动作与 live 状态。
  - `autodemo=1` 使用页面本地演示 fixture，不向真实登录用户历史写入演示轨迹。
- `src/app/ai/page.tsx` 与 `src/features/ai/personal-learning-center.tsx`
  - `/ai?task=report-feedback` 显示三条报告反馈练习任务候选，提供采用、丢弃和标记待写回状态；当前仅为候选/预览，不声明已保存到学习任务。
- `src/app/ai/copilot/page.tsx`
  - `context=evidence` 显示学生可读证据上下文边界，内部诊断不会进入回答正文。
  - `context=portfolio-reflection` 生成作品集反思草稿候选，并提供进入作品集草稿的路径。
  - 工具结果不再暴露原始 JSON。
- `src/app/(main)/profile/portfolio/page.tsx`
  - `category=reflection` 直接切换到反思页签。
  - `intent=create` 显示反思草稿候选对象和状态面板；当前仅为候选预览，不声明已保存到学习档案。

## 验证

- `rtk npm run test:unit -- src/lib/__tests__/ai-task-boundary-contracts.test.ts src/lib/__tests__/ai-task-boundary-ui-source.test.ts src/app/__tests__/action-status-panel.test.ts`
  - 3 files / 18 tests passed。
- `rtk npm run lint`
  - passed。
- `rtk openspec validate audit-remediation-ai-task-boundaries --type spec --strict`
  - passed。
- `rtk openspec validate --specs --strict`
  - 132 specs passed。

## 整改标注

- `chapters/50-function-state-flows-batch42.md` 的 244、245、247、248、249、250、252、253 中与 Global AI 可见上下文、按钮命名、状态播报、清空和移动首屏内部警告相关部分已覆盖。
- `chapters/55-function-state-flows-batch47.md` 的 299 已覆盖。
- `chapters/62-function-state-flows-batch54.md` 的 384、385、386、387 已覆盖；383 中完整学生报告反馈状态机仍由学生闭环变更处理。
- `chapters/63-function-state-flows-batch55.md` 的 398、399、400、401 已覆盖。

## 未关闭项

- 自适应路径页“生成路径 -> 打开控灵 -> 使用路径上下文提问”的完整链路仍需独立验证。
- 学生报告反馈采用/修订/提交新版/教师可见完整状态机仍由 `audit-remediation-student-learning-closure` 处理。
- 管理员治理 AI、配置模型测试和导出状态仍由管理员治理变更处理。
