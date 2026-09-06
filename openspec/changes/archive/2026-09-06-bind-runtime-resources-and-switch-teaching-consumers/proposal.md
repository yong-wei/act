## Why

当前课程教学投影 `proj-c9a6f33e…` 有 1058 条资源、765 条未绑定；知识卡/信息图的产品分母是运行态文件集，不是 Git 跟踪的 1 节点 v2 夹具。图谱浏览、路径规划和控灵因此跳过大量真实资源。#2008 只闭合了 Git 夹具门禁，不能作为产品绑定分母。

## What Changes

- 以运行态文件集为绑定分母：知识卡、信息图、讲义、提取源教科书、全部视频/音频/习题，以及已形成任务的仿真（课堂有课次单元、竞技场任务、控制工作台任务、奥德赛关卡）。
- 绑定只允许精确身份或一对一 crosswalk；禁止中文模糊匹配。课堂仿真无课次单元、以及确实没有对应节点的资源进入例外账本，必须极少。
- 本轮教科书只纳入权威图谱提取源：`dorf-modern-control-systems-14th`、`franklin-feedback-control-7th`、`hu-shousong-auto-control-8th`。题海、Ogata 等非提取源不纳入。
- **BREAKING**：重物化课程教学投影 B′ 后，`projection/current.json` 与 inspector sidecar 必须同时切到 B′；控灵、路径规划、课程页和 teaching-resource RAG 必须解析该活指针。密封 consumer-activation `activation-0b72f577` 不得改写（分片信封钉死该 identity）。
- 不改 overlay A（domain-fragments 画布关系）、不改 `engineering-graph` / `engineering-rag` 的无投影组合、不关 #1033、不认领 #2006。绑定合入 `integration` 后授权 `deploy:runtime`。

## Capabilities

### New Capabilities

- `runtime-teaching-resource-binding`：运行态分母、任务仿真、提取源教科书、例外账本，以及全部教学语义消费方同时切换。

### Modified Capabilities

- `canonical-knowledge-resource-binding`：活跃教学资源不得孤儿；分母改为运行态文件集，任务仿真与提取源教科书纳入绑定。
- `act-teaching-projection`：协同消费方选择必须同时覆盖课程投影指针、inspector sidecar 与 consumer-activation 教学针。
- `authority-surface-complete-linkage`：产品链接分母是运行态卡/信息图/绑定集；Git 夹具只做 CI fail-closed，不得再当产品覆盖率分母。

## Impact

影响 `projection/current.json`、B′ release、inspector sidecar、consumer-activation（四教学消费方）、控灵/路径/资源 RAG、运行态卡 v2 导出、教科书 locator 投影。不改 Engineering 拓扑、不改 overlay A 关系、不改应用镜像。运行态发布走 `deploy:runtime`，在 B′ 合入 `origin/integration` 并冻结该 SHA 之后执行。
