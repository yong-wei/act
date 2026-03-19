# 渐进读取地图

状态: active
最后更新: 2026-03-19
摘要: 定义 Codex 在不同问题场景下应该如何最小化读取 `.codex/memory`，避免一次性加载过多上下文，并优先读取最近摘要。
上游:
- [00-index.md](/Users/YW/Documents/Site/act.just.edu.cn/.codex/memory/00-index.md)
下游:
- [02-recent-summary.md](/Users/YW/Documents/Site/act.just.edu.cn/.codex/memory/02-recent-summary.md)
- [10-project/00-overview.md](/Users/YW/Documents/Site/act.just.edu.cn/.codex/memory/10-project/00-overview.md)
- [20-architecture/00-index.md](/Users/YW/Documents/Site/act.just.edu.cn/.codex/memory/20-architecture/00-index.md)
- [30-operations/00-index.md](/Users/YW/Documents/Site/act.just.edu.cn/.codex/memory/30-operations/00-index.md)
- [40-domain/00-index.md](/Users/YW/Documents/Site/act.just.edu.cn/.codex/memory/40-domain/00-index.md)
相关:
- [60-incidents/00-index.md](/Users/YW/Documents/Site/act.just.edu.cn/.codex/memory/60-incidents/00-index.md)

## 默认策略

1. 初始化时先读根索引和最近摘要，不直接扫全目录
2. 只在需要具体事实时读取叶子文件
3. 只在出现“为什么会这样”时读取决策记录
4. 只在出现“之前出过类似问题吗”时读取事故复盘

## 场景到读取路径

### 场景 1: 刚进入仓库，需要快速建立上下文

1. [00-index.md](/Users/YW/Documents/Site/act.just.edu.cn/.codex/memory/00-index.md)
2. [02-recent-summary.md](/Users/YW/Documents/Site/act.just.edu.cn/.codex/memory/02-recent-summary.md)
3. [10-project/00-index.md](/Users/YW/Documents/Site/act.just.edu.cn/.codex/memory/10-project/00-index.md)
4. [10-project/10-current-state.md](/Users/YW/Documents/Site/act.just.edu.cn/.codex/memory/10-project/10-current-state.md)

### 场景 2: 要改课堂/会话/同步相关代码

1. [20-architecture/00-index.md](/Users/YW/Documents/Site/act.just.edu.cn/.codex/memory/20-architecture/00-index.md)
2. [20-architecture/20-course-runtime.md](/Users/YW/Documents/Site/act.just.edu.cn/.codex/memory/20-architecture/20-course-runtime.md)
3. [20-architecture/30-auth-and-session.md](/Users/YW/Documents/Site/act.just.edu.cn/.codex/memory/20-architecture/30-auth-and-session.md)

### 场景 3: 要排查线上部署或数据库异常

1. [30-operations/00-index.md](/Users/YW/Documents/Site/act.just.edu.cn/.codex/memory/30-operations/00-index.md)
2. [30-operations/30-database-and-migrations.md](/Users/YW/Documents/Site/act.just.edu.cn/.codex/memory/30-operations/30-database-and-migrations.md)
3. [30-operations/50-known-deploy-risks.md](/Users/YW/Documents/Site/act.just.edu.cn/.codex/memory/30-operations/50-known-deploy-risks.md)
4. 如与历史问题相似，再读 [60-incidents/00-index.md](/Users/YW/Documents/Site/act.just.edu.cn/.codex/memory/60-incidents/00-index.md)

### 场景 4: 要理解精品课程与资源编排

1. [40-domain/00-index.md](/Users/YW/Documents/Site/act.just.edu.cn/.codex/memory/40-domain/00-index.md)
2. [40-domain/20-premium-courses.md](/Users/YW/Documents/Site/act.just.edu.cn/.codex/memory/40-domain/20-premium-courses.md)
3. [40-domain/30-interactive-resources.md](/Users/YW/Documents/Site/act.just.edu.cn/.codex/memory/40-domain/30-interactive-resources.md)
