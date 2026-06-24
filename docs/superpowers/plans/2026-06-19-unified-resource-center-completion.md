# Unified Resource Center Completion Plan

## Goal

完成所有项目现有资源的集中注册和字段补齐，并验证自适应路径规划与控灵回答都能正确引用这些资源。

## Non-Negotiables

- `course-content/runtime/resources/` 保持为生成产物，不纳入 Git 跟踪。
- 教材原始 MD 继续放在 `course-content/authoring/resources/textbooks/`，runtime 只消费切分后的 section、chunk、figure 与 citation map。
- 教材容器资源不直接作为路径节点；路径规划使用 `textbook_section`，RAG 与混合搜索使用 section/chunk/figure citation target。
- 语义字段必须逐项审查后写入静态元数据或真源 manifest，不能用脚本自动生成。
- 脚本只能用于盘点、校验、导出与缺失字段报告。

## Scope

1. 统一 ResourceNode 类型、source kind 与 semantic projection。
2. 注册旧 `resource-registry`、DB `TeachingResource`、runtime lesson media/handout、simulation、Arena、knowledge card、textbook section/figure。
3. 补齐路径规划所需字段：知识节点、能力目标、时间、认知负荷、证据埋点、可用性、隐私、教师策略、readiness、引用目标。
4. 补齐控灵/RAG 所需字段：sourceRef、span/location、display href、content hash、citation address、privacy、authority、freshness、retrieval tags/use cases。
5. 修复旧注册资源与 DB `registryId` 的断层，不允许继续出现可用资源没有中心节点的情况。

## Implementation Steps

1. 写失败测试：
   - ResourceNode 支持 `textbook_section`，且 section 可路径规划。
   - 教材 chunk/figure 只进入 retrieval/citation，不成为路径节点。
   - planner 在文本、媒体、仿真、Arena、检查点混合场景下引用正确资源。
   - 控灵 citation 校验能通过教材文本、图片描述、音视频时间点、slides 锚点。
2. 扩展资源中心契约：
   - 增加教材相关类型和 source ownership。
   - 增加 runtime textbook catalog loader 的输入形态。
   - 扩展 registry metadata，承载人工补齐的 planning/semantic 字段。
3. 人工补齐第一批稳定资源族：
   - 现有注册资源中的 lesson/unit 互动组件。
   - 7 个 simulation scene 与 12 个 Arena task。
   - runtime lessons 的 handout、media 与 slides。
   - `dorf-modern-control-systems` 已导出 textbook section、chunk、figure。
4. 修复 DB 与 registry 对齐：
   - 将可映射的旧 `registryId` 指向当前真实注册 ID。
   - 对无法渲染的历史资源保留中心登记，但标记为不可路径规划，并给出阻塞原因。
5. 验证：
   - 运行 ResourceNode、planner、RAG、Konling citation 单元测试。
   - 运行资源中心 coverage 检查，确认无未登记现有资源族。
   - 使用子代理 review，修复后复审至无重大问题。

## Acceptance Criteria

- 资源中心能枚举项目现有资源族，且每个节点有 source refs、ownership、governance 与 audit 结果。
- 路径规划节点只来自高置信 PlanningUnit，不把 retrieval chunk 误当作学习路径节点。
- 至少覆盖以下路径场景：基础概念补齐、教材阅读优先、媒体辅助、仿真前置、Arena 终端验证、低证据补救。
- 控灵 citation 至少覆盖：教材文本 section、教材图片描述、视频/音频时间点、slides 页锚、仿真/Arena 证据。
- `npm run test:unit -- ...` 相关测试通过；若全量测试不可行，需要记录不可行原因。
