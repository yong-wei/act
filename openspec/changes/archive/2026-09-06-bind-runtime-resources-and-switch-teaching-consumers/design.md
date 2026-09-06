## Context

三套教学存储必须继续分治：A 是 domain-fragments overlay（画布关系，live `proj-05984a0f…`）；B 是课程 Teaching Projection（资源/绑定/cards-index，当前 `proj-c9a6f33e…`）；C 是 prerequisites 出版物。本变更只重物化 B 为 B′，并让所有读教学资源语义的消费方同时指向 B′。

当前 B：1058 资源 / 891 绑定 / 293 唯一已绑定 / 765 未绑定（633 张中文 slug 卡、85 课堂仿真、31 讲义、15 习题、1 视频）。无教科书行。消费方针：

- `projection/current.json` → layered-graph resolver
- overlay `inspector-sidecar.json` → 抽屉资源列表（courseProjectionId = B）
- consumer-activation `activation-0b72f577…` 把 `course-runtime` / `konling` / `learning-path` / `teaching-resource-rag` 钉在同一 B
- `engineering-graph` / `engineering-rag` 的 `projectionId` 为 null，不得改

权威提取源（v0.37 `source_edition_id` 归一化）只有三本：Dorf 14th、Franklin 7th、胡寿松第 8 版。任务仿真：12 个 Arena 任务 + 仿真任务目录中的奥德赛关卡与 `control-workbench:free`。

## Goals / Non-Goals

**Goals:**

- 运行态文件集作为绑定分母；Git 夹具只服务 CI。
- 精确身份或一对一 crosswalk 绑定；例外账本记录真正无节点项。
- 全部教学语义消费方同时切到 B′。
- 合入 `origin/integration` 后冻结该 SHA 执行 `deploy:runtime`。

**Non-Goals:**

- 不改 overlay A 关系、不改 Engineering 拓扑、不切生产应用镜像、不关 #1033、不认领 #2006。
- 不把题海/Ogata 等非提取源教科书纳入本轮。
- 不对中国 slug 做模糊匹配来制造 BOUND。
- 不把 1236 张卡 JSON 提交进 Git。

## Decisions

1. **复用现有 builder，不新开投影合同。** 从当前 B 工件反构 authoring，追加精确绑定与新资源，走 `buildTeachingProjection` → `stageTeachingProjectionArtifacts` → `activateTeachingProjection`。备选是手写 JSONL；拒绝，因为 gate/hash/identity 已有实现。

2. **消费方切换以 `current.json` + sidecar 为活教学针。** 分片信封钉死 consumer-activation `activation-0b72f577`；改该指针会让图谱加载失败。B′ 写入 `projection/current.json` 与 inspector sidecar 后，控灵 / 路径 / 课程页 / teaching-resource-rag 在 authorityRelease 一致时覆盖活投影 ID。engineering 消费方保持 `projectionId: null`。overlay A 不动。

3. **课堂仿真按课次单元绑定，无单元进账本。** `lessonNN-*` 用 overlay `nodeUnits` 的对应课次核心；`classroom-*` / 无课次前缀的进例外账本。Arena/奥德赛/工作台任务新增 `act:simulation:<taskKey>`，绑定只用精确 canonical 或一对一 crosswalk（含 Arena `relatedKnowledge` 仅当目标已是 canonical 或 crosswalk 命中）。

4. **中文 slug 卡：保留已 BOUND 的 205 条；其余 633 条无精确 crosswalk 则进账本。** 运行态 Authority 卡（`ctc:` / `ctkg:`）对 overlay 核心做精确 ID 绑定并进入 B′。v2 清单仍是运行态工件。

5. **教科书走已有 locator 投影。** 只投影三本提取源的 SourceDocument/SourceAnchor，生成 `act:textbook:*` 与 EXPLAINS 绑定。locator 已钉 v0.12 源 stubs；本轮不升级到新书，只把已有精确 locator 行并入 B′。

## Risks / Trade-offs

- [例外账本过大] → 脚本打印账本计数；超过“极少”阈值（默认 50）失败，需人工审查后才能 `--allow-ledger=N`。
- [consumer-activation 哈希漂移] → 从 B′ 文件重算 artifactHashes；activation 不可变写入，不覆盖 `activation-0b72f577`，新 activation id 后改 `current.json`。
- [REQUIRED 未绑定导致 gate 失败] → 新绑定资源用 OPTIONAL 直到绑定成功再升 REQUIRED；账本项保持 NONE。
- [运行态发布早于合入] → `deploy:runtime` 只允许冻结 `origin/integration` 且该 SHA 已含 B′ 指针。

## Migration Plan

1. 本地 restage B′ + 指针集，跑 gate、inspector、控灵绑定测试。
2. PR 合入 `integration`。
3. 冻结该 SHA，`npm run deploy:runtime`。
4. 回滚：consumer-activation / projection current 拨回 `proj-c9a6f33e…` 与 `activation-0b72f577…`。

## Open Questions

无。用户已选定：课堂有单元绑定、提取源教科书、全部教学消费方同时切换、绑定完成后授权运行态发布。
