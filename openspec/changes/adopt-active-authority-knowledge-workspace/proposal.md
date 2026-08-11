## Why

生产环境已经以受审计的 selector 事务激活当前 Engineering Authority 与教学投影，但 `/knowledge` 仍把普通用户导向 Legacy，并把固定的旧 V2 候选图谱仅用于受控验证。数据面已切换而学习者可见工作区未切换，且后续应用版本无法在保留 committed selector 的条件下安全更新。

## What Changes

- 新增面向 `/knowledge` 的当前 Authority 工作区：只读取 `engineering-graph` READY activation 身份，并在界面中显示可核验的 Authority 与 activation provenance；教学 Projection 不作为工程图可用性门禁。
- 将历史 Legacy 保留为显式、独立、只读的可切换视图；两个视图不得拼接响应，当前 Authority 不可用时不得静默退回 Legacy。
- 将固定 V2 candidate 收敛为管理员受控诊断入口，避免把已过时的候选 Release 误称为当前权威图谱。
- 新增 cutover-aware 应用更新事务：在不写入、删除或替换已提交 selector、marker、receipt 或 journal 的前提下，校验既有 cutover control plane 后更新固定应用镜像并重建同一模式的 app/worker。
- 补充路由、角色、失败关闭、身份相关性、客户端边界、浏览器及发布运输测试，并刷新知识工作区产品 QA 证据。

## Capabilities

### New Capabilities

- `active-authority-knowledge-workspace`: 在知识工作区呈现当前已激活的 Authority 图谱，并与历史 Legacy 维持独立、可追溯的双视图。
- `cutover-aware-application-refresh`: 在已提交图谱切换环境中，安全发布新的应用镜像而不破坏 Authority/Projection/consumer selector。

### Modified Capabilities

- `candidate-authoritative-knowledge-graph`: 固定候选图谱不再作为普通用户的当前权威默认视图，保留为明确标识的管理员受控诊断能力。

## Impact

- 受影响的应用边界：`src/app/knowledge/`、`src/app/api/knowledge/`、`src/features/knowledge/`、Authority/activation resolver 与其测试。
- 受影响的发布边界：cutover-aware 远端应用更新脚本、部署脚本测试、镜像和远端运行态验收。
- 不修改 Prisma schema、Authority/Projection/consumer 的 `current.json`、历史 Legacy 工件或未完成的资源绑定/KAQ selector。
