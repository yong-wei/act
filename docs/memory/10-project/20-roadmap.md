# 路线图摘要

状态: active
最后更新: 2026-06-12
摘要: 记录长期方向和近期工作主线，不替代详细计划文档；当前路线图围绕标准互动课、平台 UI 治理、React Doctor 清理、数据治理和智能助教闭环展开。
上游:
- [00-overview.md](00-overview.md)
下游: []
相关:
- [docs/plans](../../plans)
- [../02-recent-summary.md](../02-recent-summary.md)

## 近期主线

- 完成 React Doctor 系列清理，按 shared、interactive、resource、server 和 aria role 分别消除错误，不扩大到无关页面重构。
- 固化统一 UI 治理门禁，确保 `AppShell`、角色导航、状态证据组件和商业化页面族不会回退。
- 推进 `1-1` 标准互动课从材料齐备到互动课程制作闭环，补齐严格实现契约注册、必要 e2e 和课堂页验收。
- 继续维护作者态到 runtime 的课程内容链路，避免新标准课被旧 legacy/migrated 语义遗漏。
- 基于已落地的控制校正和智能助教 specs，继续把诊断、RAG、批改、备课增强包和 provider 兼容能力接入真实课堂与教师工作台。

## 中期方向

- 巩固统一课程运行时，减少课程私有组件变体和 legacy runtime 路径。
- 把控制工作台、Arena 官方评测、学习事实、能力画像和教师报告连接为可复审的证据闭环。
- 将文档批改、备课增强包、班级诊断和控灵伴学统一纳入同一学生证据与隐私边界。
- 提升远端部署、迁移、回滚、worker/scheduler 和数据治理任务的观测与恢复能力。
- 将高频排障、工作树同步、OpenWolf/claude-mem 维护和课程内容审查继续沉淀为可复用 workflow 与 skill。
