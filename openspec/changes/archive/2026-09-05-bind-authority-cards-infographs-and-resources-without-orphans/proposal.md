## Why

新版抽屉几乎看不到知识卡，系统资源对几乎所有节点显示「当前系统资源与所选对象身份不一致」。卡文件、信息图和教学投影绑定其实存在：1236 张 Authority 卡、138 张已在 cards-index 且落在概览、891 条资源绑定。根因是图谱分片信封绑定 domain-fragments 投影 `proj-eb4d2d63…`，卡与资源读取另一份 `projection/current.json` = `proj-c9a6f33e…`。知识卡既然存在就必须全部展示并链到对应节点；系统资源不得成为孤儿。

## What Changes

- 统一 Active Authority 节点详情、学习内容清单与系统资源绑定所消费的 Teaching Projection 身份，禁止两套 `projectionId` 并存于同一 inspector 读路径。
- 导出并只接受 v2 `authority-learning-content-manifest`；v1 桩 MUST fail closed。
- 每张现存 Authority 卡与每张现存信息图 MUST 映射到恰好一个当前图谱 object id。满足质量标准的卡 MUST 在对应节点抽屉中渲染；draft-blocked 不得冒充已审内容，但不得从覆盖账本消失。
- **BREAKING**：任一卡或信息图未链接即阻断该学习内容包发布。
- 教学投影内每一条系统资源 MUST 绑定到合适权威节点，带人类可读标题与可启动类型的安全 launch；孤儿资源 MUST fail closed。
- 修好身份后仍须补资源 `title` 与 launch 投影，避免只把错误文案从「身份不一致」换成「暂无已授权系统资源」。

## Capabilities

### New Capabilities

- `authority-surface-complete-linkage`：定义卡、信息图、系统资源与 Active Authority 节点的完整链接、身份闭合和无孤儿门禁。

### Modified Capabilities

- `authority-card-infograph-inspector`：合格卡与信息图必须出现在对应节点抽屉；身份不一致不得再作为默认全员失败态。
- `canonical-knowledge-resource-binding`：当前教学投影资源不得无 Canonical 绑定；空标题不得 silently 丢弃后伪装成无资源。

## Impact

影响 node-detail API、`attachActiveAuthorityLearningContent`、`attachActiveAuthorityResourceBindings`、learning-content manifest、cards-index、resources/bindings JSONL、RegistryIndex capture 闭合。不改 Engineering Authority 拓扑，不切换生产 selector。依赖教学投影身份与 `adopt-engineering-prerequisites-into-domain-teaching` 重物化后的同一 Teaching 信封。
