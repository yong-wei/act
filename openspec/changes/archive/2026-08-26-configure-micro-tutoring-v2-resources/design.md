# Design

资源按规范知识节点聚合，但关系覆盖来自 v2 每个错误选项。当前 v2 归因目录有 272 个错误选项，折叠为 268 个唯一节点/错因对；投影按这些唯一对绑定学生可见资源，使每个错误选项仍能解析到合格动作。

验证题从同一规范目标的已审核 v2 题目中做确定性循环置换，保证题目身份、内容哈希和来源题不同，同时保持可审计 revision。用途决定只从 `micro-tutoring-validation-purpose-reviews-v1.jsonl` 读取；普通 assessment approval 不能单独授权验证用途。

运行时默认读取 v2 attribution、v2 baseline、`micro-tutoring-resource-projection-v2.json` 和 `micro-tutoring-validation-registry-v2.json`。v1 的 `micro-tutoring-resource-projection.json` 与 `micro-tutoring-validation-registry.json` 保持只读历史兼容，供 v1 覆盖审计和资格回执使用。本变更不改 v1 覆盖审计分母，也不签发新的生产资格回执。
