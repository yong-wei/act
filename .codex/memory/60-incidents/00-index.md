# 事故与复盘索引

状态: active
最后更新: 2026-03-25
摘要: 存放真实故障和排障复盘，帮助跨会话快速识别“这是不是老问题重现”，当前已覆盖会话鉴权/部署混淆、startup 端口残留、本地 Homebrew Octave/Qt 插件缺失，以及 Redis OOM 触发的 worker 日志风暴。
上游:
- [../00-index.md](/Users/YW/Documents/Site/act.just.edu.cn/.codex/memory/00-index.md)
下游:
- [2026-03-16-session-api-auth-vs-deploy.md](/Users/YW/Documents/Site/act.just.edu.cn/.codex/memory/60-incidents/2026-03-16-session-api-auth-vs-deploy.md)
- [2026-03-19-startup-port-residue.md](/Users/YW/Documents/Site/act.just.edu.cn/.codex/memory/60-incidents/2026-03-19-startup-port-residue.md)
- [2026-03-24-homebrew-octave-qt-plugin.md](/Users/YW/Documents/Site/act.just.edu.cn/.codex/memory/60-incidents/2026-03-24-homebrew-octave-qt-plugin.md)
- [2026-03-25-worker-redis-oom-log-flood.md](/Users/YW/Documents/Site/act.just.edu.cn/.codex/memory/60-incidents/2026-03-25-worker-redis-oom-log-flood.md)
相关:
- [../30-operations/50-known-deploy-risks.md](/Users/YW/Documents/Site/act.just.edu.cn/.codex/memory/30-operations/50-known-deploy-risks.md)

## 记录规则

- 标题使用日期 + 问题主题
- 开头先写结论
- 中段写证据
- 末尾写后续行动
