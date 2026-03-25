# 2026-03-16 会话接口报错排查：鉴权与部署混合态

状态: active
最后更新: 2026-03-17
摘要: 复盘一次课堂页面同时出现 `/api/session/[id]` 报 500 与 `/state` 报 401 的排查，结论偏向部署/发布窗口期问题。
上游:
- [00-index.md](/Users/YW/Documents/Site/act.just.edu.cn/.codex/memory/60-incidents/00-index.md)
下游: []
相关:
- [../20-architecture/30-auth-and-session.md](/Users/YW/Documents/Site/act.just.edu.cn/.codex/memory/20-architecture/30-auth-and-session.md)
- [../30-operations/50-known-deploy-risks.md](/Users/YW/Documents/Site/act.just.edu.cn/.codex/memory/30-operations/50-known-deploy-risks.md)

## 结论

- `/state` 的 `401` 更像未登录或登录态未恢复，不是服务端炸掉
- 当时看到的 `500` 没有在后续线上实测中稳定复现
- 综合旧 chunk 证据和迁移历史风险，根因更偏向部署/发布混合态，而不是这两个接口的当前源码稳定缺陷

## 关键证据

- 线上后续实测 `GET /api/session/[sessionId]` 返回 `200`
- 未登录时 `GET /api/session/[sessionId]/state` 稳定返回 `401`
- 报错时的前端 chunk 名与当前线上实际构建不一致
- 本地日志曾暴露 `PlatformSetting` 缺表，且部署脚本专门加入了 Prisma 迁移自愈逻辑

## 后续建议

- 前端遇到 `401` 时应停止静默轮询并给出明确登录态提示
- 服务端会话接口异常应打印更明确日志
- 发布后应验证新 chunk、生效路由和关键 API 的一致性
