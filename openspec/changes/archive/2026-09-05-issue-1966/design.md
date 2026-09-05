# 设计：控灵主动陪伴

## Context

已有资产（本变更全部复用，不重建）：
- `src/components/providers/global-ai-provider.tsx`（343 行）：`pageContext`、`openSidebar`、`assistantEntryPoint` 机制。
- `src/components/ai/global-ai-sidebar.tsx`（1343 行）：侧栏、会话切换、连续性卡片挂载。
- `src/lib/konling-agent-runtime.ts`（10699 行）：会话运行时、消息历史、feature flag 先例（`KONLING_SEMANTIC_MEMORY_ENABLED` 等 env flag）。
- `KonlingSession` Prisma 模型：学生私有会话（userId+courseId+pageId 唯一索引、messages JSON）。
- `src/lib/konling-learning-continuity.ts`：学习连续性快照（unfinished_task/recent_mistake）——错题安慰的证据源。
- 资源治理注册表（resource-node-registry 等）：治理资源、版本与下架语义。
- `src/features/ai/companion/`：Arena 按需陪伴面板（不同能力，不动）。

## Goals / Non-Goals

**Goals**：四类首期触发的端到端闭环（信号 → 决策 → 气泡 → 会话 → 资源卡），隐私边界与降级路径成立，flag 默认关闭。

**Non-Goals**（沿用 Issue #1966）：不新增陪伴中心/导航/关闭开关；不做完整视频播放器、不记逐秒观看；不要求显式反馈。

## Decisions

### D1：决策核心为服务端纯函数，客户端只采信号

停顿计时、可见性/焦点判定在客户端 Provider（浏览器信号服务端拿不到）；证据加权、两阶段确认状态机、优先级、冷却、过期、投递去重在服务端纯函数模块 `src/features/ai/companion/trigger-engine.ts`。纯函数入参为事件流快照与配置常量，出参为决策（suppress/confirm/expire/deliver），完全可单测，不碰 IO。

### D2：两阶段停顿确认由状态机承载

`KonlingCompanionEvent.status`：`candidate → confirmed → delivered | suppressed | expired`。客户端检测停顿候选（无操作 + 可见 + 聚焦 + 无媒体播放 ≥ 阈值）→ POST 创建 candidate（服务端即刻做冷却/去重判定，命中则 suppressed）→ 客户端在二次确认窗口后再 PATCH 确认（服务端校验窗口内证据仍成立）→ confirmed 才可投递。离开页面再返回要求重新满足条件：candidate 的确认窗口是滑动限定，返回页面产生新 candidate 而非续用旧 candidate。

### D3：多标签页租约 = localStorage 事件锁 + 服务端 delivered 去重双保险

同一浏览器标签页用 `localStorage` 广播事件展示锁（同源、免服务端往返）；服务端 `KonlingCompanionDelivery` 唯一约束兜底（eventId 上的唯一投递）。两层中任何一层持锁即不展示。

### D4：气泡独立组件，不侵入侧栏状态机

`KonlingCompanionBubble` 挂在 Provider 层（侧栏同级），自行管理 10–15 秒收起计时与已展示事件集合（session 级 Set + localStorage 持久化去重）。点击回调走 Provider 的 `openSidebar` + 会话定位（复用 assistantEntryPoint 通道，新增 companion entry kind）。侧栏流式生成期间：Provider 暴露 `isStreamingOrComposing`，气泡查询后抑制。

### D5：companion-origin 助手消息走既有消息 JSON，sender 标记区分

`KonlingSession.messages` 为 JSON 数组，消息对象增加 `origin: 'companion'` 标记（运行时读取时透传）。主动回合：投递 API 复用 konling-agent-runtime 的回合执行入口，输入为 companion 上下文（触发原因 + 资源卡），不写入任何用户角色消息。

### D6：资源卡 = 治理注册表投影 + 校验降级

投递时保存 `{ resourceId, versionHash, reason, kind }` 快照到 `KonlingCompanionDelivery.resources`；打开/恢复时服务端按 resourceId 重查注册表：不存在/下架/版本不符 → 该卡降级为"资源已更新或不可用"占位，其余卡片与会话不受影响。媒体控件用原生 `<video controls>` / `<audio controls>`（播放、暂停、进度、音量、全屏原生支持），`autoPlay` 一律 false；互动资源卡字段（是什么/解决什么/预计用时/完成内容）由注册表元数据填充。

### D7：数据模型最小化

`KonlingCompanionEvent`：id/userId/pageKind/pageRef/eventType/evidence(Json)/status/confirmedAt/expiresAt/createdAt + 索引（userId,status,createdAt）、（userId,eventType,createdAt）。
`KonlingCompanionDelivery`：id/eventId(unique)/userId/sessionId/resources(Json)/createdAt + 索引（userId,createdAt）。
不建触发历史审计表（Delivery 即审计）；evidence 只存决策必需的粗粒度摘要（页面类型、停顿时长档、操作计数），不含原始答案或内容载荷。

### D8：布点收敛为两个页面 + 一个 Provider

接入面：资源/教材渲染页（停顿 + 完成）、自适应练习页（错题 + 进步）。其余学生页面通过全局 Provider 获得采集与气泡能力但不主动上报，零改动。

## Risks / Trade-offs

- [客户端时钟不可信] → 停顿判定只做候选信号，最终窗口判定在服务端（createdAt/confirmedAt 服务端时间）。
- [localStorage 租约被禁用] → 服务端 delivered 唯一约束兜底，最坏情形同一事件多标签各展示一次，不破坏隐私与正确性。
- [触发打扰用户] → flag 默认关闭；冷却/优先级/每会话展示上限进入配置常量并可在 spec 演进中收紧。
- [messages JSON origin 标记破坏旧读取方] → origin 为可选字段，未标记消息按用户/助手既有判定，向后兼容。
- [治理门禁新增表] → 迁移与验证脚本纳入批 1 交付；数据治理套件补陪伴表不写 LearningFact 的断言。

## Migration Plan

四批交付，每批独立 PR 单元可验证：
1. 批 1：Prisma 两表 + 迁移 + 触发决策纯函数 + 单测（无 UI，flag 无关）。
2. 批 2：陪伴 API（事件上报/确认/投递）+ 授权与隐私边界测试。
3. 批 3：Provider 采集 + 上报 Hook + 气泡组件 + 多标签租约。
4. 批 4：会话集成（companion-origin + 主动回合）+ 资源卡与媒体控制 + 两页布点 + 端到端回归。

回滚：flag 关闭即全量停用；批 1-2 无 UI 影响可独立保留。

## Open Questions

无（四类触发阈值以配置常量落地，后续按策略评估数据调优，不在本变更内固化数值）。
