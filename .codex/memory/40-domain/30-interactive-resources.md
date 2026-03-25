# 互动资源

状态: active
最后更新: 2026-03-17
摘要: 记录互动组件、仿真和课堂渲染器之间的协作方式。
上游:
- [00-index.md](/Users/YW/Documents/Site/act.just.edu.cn/.codex/memory/40-domain/00-index.md)
下游: []
相关:
- [../20-architecture/50-resource-registry.md](/Users/YW/Documents/Site/act.just.edu.cn/.codex/memory/20-architecture/50-resource-registry.md)

## 当前约束

- 互动/仿真资源优先放在 `src/resources`
- 可编排资源必须通过资源注册体系暴露
- 课堂播放器通过统一渲染器加载资源，而不是每门课自行拼接组件路径
