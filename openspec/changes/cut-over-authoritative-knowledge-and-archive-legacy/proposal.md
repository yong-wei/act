## Why

候选底座和各消费者完成迁移后，平台仍需一次可演练、可审计的生产权威切换。长期保留双业务 API 或在线双写会形成双权威，而直接删除旧图又会破坏历史解释和用户笔记。

## What Changes

- 在图谱 API、控灵、RAG、SAR、KAQ、有效资源、聚合 CourseCoverage、路径和新事实写入全部通过门禁，且完整课程 ReleaseSet 与正式 Teaching Projection 已到达后，执行一次性权威切换。
- 建立独立 Legacy Archive 固定快照，延续旧图原访问范围；个人节点笔记仅所有者可见，管理员可审计。
- 切换后主图移除旧版开关，退役旧 DTO、业务 API 和运行读取；归档不提供控灵、资源、路径或新事实能力。
- 正式部署前导出最新生产数据库，在本地恢复并以生产一致修订、Schema、ReleaseSet、Overlay 和迁移命令完成全流程演练。
- 生产停服应用、worker 和 scheduler，备份数据库，执行同一迁移并事务切换活动权威和 Canonical 写入边界，冒烟通过后恢复服务。
- 同一停服事务统一激活资源、RAG、KAQ、SAR、路径和学习事实的 Canonical authority selectors，禁止局部消费者提前切换。
- 服务恢复并产生 Canonical 事实前允许恢复旧数据库和应用；开放写入后只允许再次停服前向修复。
- 重置绑定 Legacy 节点的收藏、画布布局和最近访问记录，不迁移到新图。
- **BREAKING**：生产切换后旧图谱业务 API 与 `UnifiedKnowledgeGraphPayload` 退出正式运行合同。

## Capabilities

### New Capabilities

- `authoritative-knowledge-cutover-and-legacy-archive`: 定义全消费者门禁、Legacy Archive、本地生产数据演练、停服切换和回滚窗口。

### Modified Capabilities

- `knowledge-graph-projection-contract`: 退役旧业务投影并将 ActKG V2 设为唯一活动图谱合同。
- `resource-node-knowledge-workspace-ui`: 切换后移除主图旧版入口，并提供权限受控的独立 Legacy Archive。

## Impact

- 影响生产数据库迁移、部署脚本、worker/scheduler 停启、活动权威配置、旧 API、归档路由和权限测试。
- 依赖标准 Bundle 兼容、候选导入、ReleaseSet Delta、课程覆盖/资源绑定治理、其余消费者变更及完整 ActKG 课程 Release/Teaching Projection；任何仅有工程覆盖的候选 ReleaseSet 均不满足最终门禁。
