## Context

当前 `/ai/copilot`、global AI/sidebar、Konling sidebar 和 interactive hook 对消息形状与流协议存在历史兼容层。部分调用已经通过 `/api/ai/sessions/[id]/messages` 使用持久 AgentSession，另一些仍依赖 `useLegacyChat` 的本地消息数组和兼容 parser。C29 的目标是把保留表面映射到同一 canonical session/provider path，并把旧桥接留在可审计的删除边界内。

## Goals / Non-Goals

**Goals:**

- 每个保留聊天表面只有一个会话、消息转换和流处理 owner。
- 保留持久化、刷新恢复、资源切换隔离、错误/重试和工具结果的可观察行为。
- 证明 legacy bridge 删除不会绕过认证、角色、资源边界或 provider capability gate。

**Non-Goals:**

- 不重建聊天产品，不新增万能 AI workspace、第二 conversation store 或新的路由族。
- 不删除 `/ai/copilot` 或其他产品入口，除非调用图和验收明确证明该表面本身已废弃。
- 不改变 Konling tool registry、业务 owner、LearningFact、评分、发布或生产状态语义。
- 不改变 AppShell、SSR/R3F、teacher/student projection 或 provider 配置真源。

## Decisions

### 1. Migrate callers to the existing session route

持久聊天表面通过现有 AgentSession/message route 恢复和追加消息；interactive course AI 继续使用其资源 session contract。route 负责鉴权、服务端 page/resource context 和 C28 provider runtime，UI 不直接选择 provider 或拼装模型消息。

### 2. Keep compatibility at the ingress edge only

若外部 caller 仍需要旧 `content`/`parts` 形状，只在单一 ingress adapter 转换到 canonical UI/message contract。该 adapter 不持有会话、不解析 provider stream、不写业务事实；迁移完成后删除。禁止在每个组件保留局部 `toLegacyMessage`、parser 或 retry 状态。

### 3. Preserve session and resource identity

恢复、发送、切换资源和重新打开页面都必须携带服务端可验证的 user/session/course/resource identity。客户端 query/path hint 不能扩大上下文；恢复失败显示明确 retry/unavailable，而不是伪造空会话。

### 4. Treat stream lifecycle as shared behavior

所有保留入口共享 C28 的 normalized stream event、terminal/error、abort 和 timeout 状态。UI 可以选择不同呈现，但不能改变事件顺序、重复工具调用、终止状态或错误脱敏。

### 5. Delete only after dynamic evidence

静态 import inventory 不能单独证明安全删除。对每个 bridge 做 route/component mounted coverage、refresh/resume、resource switch、stream failure 和 no-double-submit 证据；确认无动态 import 或外部兼容 caller 后再移除文件。

## Risks / Trade-offs

- [Risk] 旧 bridge 承担了未记录的浏览器兼容行为。→ 保留入口的 mounted contract 先锁定消息、focus、loading、error 和 retry 结果，再删除实现。
- [Risk] 会话切换泄漏上一资源上下文。→ 以服务端 session/resource identity 作为唯一恢复资格，切换时显式关闭旧上下文并测试隔离。
- [Risk] 删除 facade 使 worker 或 SSR import 失败。→ 分别扫描 Web/worker/tool/test graph；仅删除零 caller 文件。
- [Risk] provider-specific stream payload 泄露。→ UI 只消费 C28 normalized event 和 redacted error，不接触 raw provider chunks。

## Migration Plan

1. 绘制 `useLegacyChat`、message/stream compat 和 sidebar/copilot 的静态及运行时调用图。
2. 为持久 session、interactive resource session 和旧无 session caller 建立行为基线与失败 fixture。
3. 按表面迁移到现有 session/message route 和 C28 runtime，保持 AppShell/role/SSR boundary。
4. 删除无调用者的 bridge；必要的 ingress adapter 只保留到公开 contract 迁移完成。
5. 运行 AI route、session、interactive、component、accessibility、typecheck、lint 和 OpenSpec strict 验证，并记录删除/保留理由。

回滚只恢复被删除的 bridge 或导入映射；恢复路径仍必须转到 canonical session/provider contract，不恢复第二套会话或 provider authority。

## Open Questions

无。任何无法证明迁移等价的 caller 应保留为非权威 ingress adapter，并登记后续删除条件。
