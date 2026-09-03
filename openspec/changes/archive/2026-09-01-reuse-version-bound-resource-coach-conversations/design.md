## Context

资源辅导通过 `assistantEntryPoint.mode='resource-coach'` 和结构化教材身份进入全局控灵侧栏。侧栏在 effect 中调用 `shouldStartTextbookCoachConversation(requested, activeAssistantBinding)`；首次渲染时会话列表尚未加载，`activeAssistantBinding` 必然为空，因此 effect 立即 `createConversation()`。

`createConversation(binding)` 向服务端创建会话时没有发送 binding，只把它写入 `sessionStorage` 并暂存在 React 状态。若刷新发生在首轮消息前，服务端详情只能返回初始页面上下文，binding 恢复为空；新的页面挂载再次创建会话。即使已有完成过问答的精确匹配会话，入口也会在列表加载前抢先创建一个更新的空会话。

## Goals / Non-Goals

**Goals:**

- 同一用户重开同一教材版本、单元和锚点时恢复已有资源辅导会话。
- 在恢复结论确定前不创建持久空会话。
- 让资源 binding 成为服务端可查询、可重验证的会话身份。
- 保持版本、单元、锚点、授权和用户隔离以及原有引用完整性。

**Non-Goals:**

- 不合并不同教材版本或不同结构单元的对话。
- 不恢复只有客户端 binding、没有可验证服务端身份的历史空会话。
- 不增加跨用户共享、会话分叉或全文搜索。
- 不改变资源正文、引用地址或教材发布规则。

## Decisions

### 1. Separate hydration from creation

资源辅导入口引入明确的 `loading | matched | blank | unavailable` 解析状态。只有会话列表和候选 binding 已完成服务端读取，才能判定 `matched` 或 `blank`。effect 不得在 `loading` 状态调用创建 API。

页面身份变化或用户选择变化时使用请求序号或取消信号，较早的匹配结果和创建结果不得覆盖较新的资源身份。

### 2. Match on the complete server-owned resource identity

会话查询返回学生安全的服务端 binding 摘要，或提供等价的受用户归属约束查询。匹配键包括 `resourceId`、`sourceRevision`、`unitId`、`contentHash` 和规范化 `anchorId`；模式必须为 `resource-coach`。客户端 entrypoint 只提供定位提示，服务端重新授权并加载资源后才确认匹配。

查询应有界并避免依次下载全部消息。具体实现可以在会话元数据中物化安全 binding、从关联 AgentSession 查询，或通过专用 server lookup 投影；不得信任 `sessionStorage` 或标题。

### 3. Create on the first intentional question

没有匹配会话时，侧栏展示待提问空白态，不立即写入数据库。学生提交首个问题后，系统建立会话并在模型回答前持久化验证后的完整 binding。创建或首轮绑定失败时不得留下 `libraryVisible=true` 且不可恢复的孤立空会话。

`sessionStorage` 可以作为同一页面生命周期的性能提示，但不能决定恢复、授权或版本匹配。

### 4. Preserve exact-version isolation

旧版本或其他锚点会话不自动替代当前请求。精确匹配不存在时创建新会话；匹配存在但资源已不可读时显示版本不可用，而不是创建最新版本会话并伪装为连续历史。

## Risks / Trade-offs

- [Risk] 查找 binding 增加列表查询成本。 -> 返回有界安全摘要或使用索引化物化字段，不加载完整消息正文。
- [Risk] 首轮创建和发送之间失败。 -> 采用服务端创建加绑定事务或将未完成记录保持不可见，避免孤立空会话。
- [Risk] 多标签页同时首问产生重复。 -> 使用用户与完整 binding 的幂等创建身份或在创建后重读并复用胜者。
- [Risk] 旧空会话仍显示。 -> 本变更停止新增；既有空记录由用户删除或后续数据清理治理处理，不凭推测批量删除。

## Migration Plan

1. 增加慢速列表和页面刷新回归，复现挂载即创建及重复空会话。
2. 增加服务端 binding 恢复投影和精确匹配测试。
3. 将创建移动到首轮明确提问，并处理并发和失败可见性。
4. 验证同版本恢复、跨版本隔离、权限变化、桌面端和 320px 侧栏行为。

Rollback 恢复旧入口会重新产生重复会话，因此只有在保留 hydration gate 时才能回退其他实现部分。
