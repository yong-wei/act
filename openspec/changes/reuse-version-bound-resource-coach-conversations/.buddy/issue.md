<!-- openspec-buddy change_id: reuse-version-bound-resource-coach-conversations -->

## Goal

修复教材资源辅导在会话库尚未加载时抢先新建会话的问题，使同一教材版本与单元在刷新或重开后恢复原有对话，不再累积重复空会话。

## Scope

- 先按服务端验证的完整资源身份查找并恢复匹配会话；客户端 `sessionStorage` 不作为恢复真源。
- 无匹配历史时保持未落库空白态，首轮提问再幂等创建并持久化绑定，失败不得留下可见孤立会话。

## Acceptance

- 页面挂载、侧栏打开、刷新和恢复等待均不创建新会话；同版本重开恢复原消息。
- 不同版本、单元、锚点和用户保持隔离，并通过慢速恢复、并发首问、桌面端和 320px 浏览器验收。

Proposal: https://github.com/yong-wei/act/tree/integration/openspec/changes/reuse-version-bound-resource-coach-conversations
