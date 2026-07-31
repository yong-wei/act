## 1. 服务端比较模型

- [x] 1.1 扩展已保存候选路径解析，保留比较所需的路径身份、节点、时长、资源、准备度、检查点、锁定节点、终点验证和限制事实。
- [x] 1.2 生成确定性的共同节点、独有节点、顺序差异、量化指标、取舍、相同路径状态和数据不足状态。
- [x] 1.3 为真实差异、顺序差异、完全相同、数据不足和无效方案补充 Konling runtime 定向测试。

## 2. 学生端展示

- [x] 2.1 解析服务端结构化比较结果，并在所选路径模块中展示比较对象、节点差异、指标、取舍和限制。
- [x] 2.2 在候选路径组变化时清除旧解释，并保持既有调整、选择和反馈操作不变。
- [x] 2.3 补充学习中心 UI 契约测试，覆盖结构化展示、结果失效和响应式边界。

## 3. 验证

- [x] 3.1 运行 `openspec validate explain-adaptive-path-option-differences --type change --strict`、相关 Vitest（258 tests passed）、目标 ESLint 和 `git diff --check`；类型检查仅保留既有 `src/lib/konling-conversation-library.ts:122` 基线错误。
- [x] 3.2 在 Issue 工作树以 `http://127.0.0.1:3003` 启动项目，使用 Playwright route mock 完成桌面端与 320px 移动端验收；证据保存为 `artifacts/adaptive-learning/issue-1160/desktop.png` 与 `artifacts/adaptive-learning/issue-1160/mobile-320.png`，并验证移动端 `scrollWidth <= 320`。
