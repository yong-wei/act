## 1. 唯一教学投影与课程先修并入

- [x] 1.1 以 domain-fragments 为唯一活教学顺序；读取课程先修 139 条并保留 strength/evidence
- [x] 1.2 第一波核心 = 领域概览 ∩（课程投影绑定 canonicalId ∪ 课程先修核心/端点）
- [x] 1.3 测试：139 条被并入；未出现在教学内容中的概览点不进 fragment cores

## 2. 按课次单元顺序串联

- [x] 2.1 用 blueprint 单元序（1-1→…）为内容相关节点赋值最早课次
- [x] 2.2 在不反向已发布先修的前提下发布 RECOMMENDED 扩展边，使每个领域的内容相关概览子集弱连通
- [x] 2.3 无课次的内容相关点排在该领域已排课节点之后；不得用 Canonical ID 当教学顺序

## 3. 物化与验证

- [x] 3.1 从前任 `proj-eb4d2d63` 组合并重物化 overlay
- [x] 3.2 断言内容相关领域弱连通、无关领域允许 empty、Engineering 字节不变
- [x] 3.3 `openspec validate adopt-engineering-prerequisites-into-domain-teaching --type change --strict` 与相关单元测试
