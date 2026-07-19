# ACT 领域上下文地图

## 上下文

- [教师备课](./CONTEXT.md) — 管理教师课程依据、智能备课、教案、互动课件及其发布语言。
- [课程知识基座](./docs/contexts/course-knowledge-base/CONTEXT.md) — 管理规范知识概念、领域、关系、课程编排、知识卡和资源知识绑定。
- [课程知识基座治理来源与派生契约](./docs/proposals/course-knowledge-base-governance-source-derivation-contract.md) — 规定阶段一清单的真实 ADR 索引、输入闭包、规范化、摘要分层、隐私与漂移报告。
- [课程知识基座治理来源注册表](./docs/proposals/course-knowledge-base-governance-source-registry.yaml) — 机器可读地规定仓库 glob、数据库字段与 JSON selector、快照边界、namespace 和直接写入口。

## 关系

- **教师备课 → 课程知识基座**：备课知识点可以引用已发布的规范知识概念，但教师在单次备课中选定或修改的备课知识点不会自动创建知识图谱节点。
- **课程知识基座 → 教师备课**：规范知识 ID 为教学目标、教案、课件、活动和习题提供稳定知识引用；课程知识基座不拥有教师的课程依据和教案版本。
- **共同约束**：两个上下文共享教学资源身份和课程运行能力，但分别维护备课决策与规范知识真相。
