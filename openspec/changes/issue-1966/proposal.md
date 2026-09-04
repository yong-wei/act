# 提案：控灵主动陪伴：页面感知的低打扰陪伴与会话内资源呈现

## Why

控灵当前主要在学生主动打开对话后提供帮助；错题归因、教材检索、微辅导和治理资源已经存在，但缺少从学习行为到控灵会话的主动入口。学生在停顿、受挫或取得进步时无法及时得到合适支持，教师侧治理好的资源也无法在学习现场被低打扰地呈现。

## What Changes

- 新增全局陪伴信号采集：Provider 采集页面可见性、焦点、最近有效学习操作和媒体状态；页面通过类型化 Hook 上报题目、互动步骤、资源与播放状态。
- 新增服务端触发决策核心：按页面类型证据加权、两阶段停顿确认、优先级队列、冷却、过期与多标签页展示租约；全部为纯函数可单测。
- 新增数据模型 `KonlingCompanionEvent` 与 `KonlingCompanionDelivery`（含迁移与回填验证脚本），数据仅供控灵运行时与策略评估。
- 首期四类触发：资源/教材页自然停顿提醒、自适应练习错题安慰、有效学习进步表扬、资源完成后的下一步建议。
- 新增低打扰气泡：非模态、不发声不震动不发系统通知、约 10–15 秒自动收起、同一事件不重复展示；点击后打开控灵侧栏。
- 会话集成：复用或创建学生私有控灵会话，服务端写入 companion-origin 助手消息并执行一次主动回合，不伪造用户消息。
- 会话内治理资源呈现：资源卡保存稳定 resourceId、版本/内容哈希与原因摘要，打开/恢复时重新校验权限与版本；视频/录音提供播放、暂停、继续、进度、音量/静音与原生全屏且禁止自动播放；互动资源卡先说明资源定位再提供站内跳转；教材无可靠跳转时展示摘要并允许继续讲解。
- 默认 feature flag 关闭（`KONLING_COMPANION_ENABLED`）；关闭或服务端异常时普通控灵与学习流程不受影响。

## Capabilities

### New Capabilities

- `konling-proactive-companion`: 控灵主动陪伴的信号采集、触发决策、投递去重、气泡呈现、会话集成与治理资源呈现契约，以及事件/投递数据的隐私边界。

### Modified Capabilities

（无——既有 konling 会话、资源治理注册表与自适应练习的需求不变，本变更只消费它们。）

## Impact

- `prisma/schema.prisma`：新增 `KonlingCompanionEvent`、`KonlingCompanionDelivery` 两表及迁移；新增数据治理门禁核验（不写 LearningFact、不进画像、教师端不可见）。
- `src/features/ai/companion/`：新增触发决策纯函数、信号采集 Hook、气泡组件与资源卡组件（Arena 按需面板不动）。
- `src/components/providers/global-ai-provider.tsx` / `global-ai-sidebar.tsx`：接入气泡挂载与 companion-origin 会话定位。
- 新增 API：陪伴事件上报/确认/投递路由（仅学生本人授权）。
- 布点页面：资源/教材页、自适应练习页（其余页面零改动）。
- 风险面：risk:high，涉及 AI runtime 交互、资源治理校验、数据治理新增表；按 tasks 分四批交付，每批独立可验证。
