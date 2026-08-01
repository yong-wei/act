## Context

SAR 需要跨多个治理域查找相关上下文。权威对象、KAQ、资源、路径和学习状态具有不同生命周期，不能复制为新的统一图。

## Goals / Non-Goals

**Goals:**

- 在请求期间组合多个权威边界。
- 保留每个结果的 namespace、authority 和版本。
- 生成可重建、不可回写的候选投影。

**Non-Goals:**

- 不建立物化混合图真源。
- 不让未知类型自动参与扩展。
- 不改写任何来源关系。

## Decisions

1. 查询计划从明确种子和 scope 出发，分别调用 Repository 与 Overlay 公开接口。
2. 跨域跳转只使用聚合 ReleaseSet 下经审阅的显式绑定实体和 SAR 明确支持的边类型，限制跳数和候选量。
3. 每个节点和边携带来源 namespace、ReleaseSet/Release 或 Overlay version 和 authority。
4. 组合缓存键包含所有输入版本；任一来源变化只使相关缓存失效。
5. 结果只服务当前检索和上下文组织，不晋升为正式关系或写回各真源。
6. SAR authority selector 只在最终停服事务中统一激活；本变更的组合查询完成度不得造成局部生产切换。

## Risks / Trade-offs

- [多源查询增加延迟] → 并行独立查询、有限跳扩展和版本化缓存。
- [来源版本不一致] → 响应保留版本并在无法构成一致快照时显式降级。
- [候选结果被误用为事实] → 类型和 API 明确 candidate projection，不暴露写入入口。

## Migration Plan

以固定聚合候选 ReleaseSet、聚合 CourseCoverage、经治理的 ACT Crosswalk/资源绑定和测试 Overlay 验证组合，再接入 KAQ；在切换前只进行影子对比。

## Open Questions

无。
