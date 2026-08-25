# v0.37-r3 协调切换问题与上游修复交接

## 目的与结论

本文记录一次生产切换准备中发现的缺口，供上游实现修复。目标是将现行 Authority v0.22 协调升级至当前已发布的 ActKG 聚合包 `control-theory-engineering-v0.37-r3`，而不是修复 v0.22 后直接把它当作目标版本。

截至 2026-08-25，v0.37-r3 不具备生产激活资格。原因不是 bundle 版本失效，而是活动资源基线、图谱控制面和 Runtime 生命周期尚未形成同一份可验证的候选闭包。任何绕过这些缺口的 selector 写入都会造成资源连续性或图谱/Runtime 组合漂移。

## 版本与生产基线

| 项目 | 已核实身份 | 说明 |
| --- | --- | --- |
| 最新 ActKG v0.37 聚合包 | `ctb:control-theory-engineering-v0.37:r3` | 远端已有 r2/r3，没有 v0.37-r4 聚合包。 |
| r3 的源输入 | `control-theory-engineering-v0.37-source-r4`，`3e98864…` | bundle revision 为 r3，源修订为 r4，两者不是冲突。 |
| r3 release | `ctr:release:control-theory-engineering-v0.37`，`cc73fa15…` | stable，Schema 0.3。 |
| 当前生产 Authority | v0.22，snapshot `snap-9c4b2c1c…` | 这是接手时服务器的现行选择，不是本次选择的目标版本。 |
| 当前生产 Runtime v2 | `runtime-bb309e6a…`，manifest `11c8185d…`，tree `801e9966…` | generation 34，7277 个逻辑文件。 |
| 已阶段化 Runtime 后继 | `runtime-a1a454a7…`，manifest `31565412…` | 仅处于 lifecycle `publishing`；未写 desired/active，未改 view 或服务。 |

`build-v037-authority-snapshot.ts` 与 remediation evidence 当前明确引用 r3，因此本次准备没有误用 v0.37-r1。问题在于这些版本常量不能代替执行时的“最新完整发布捕获”；后续应由 capture 层解析远端正式标签和完整组件闭包，再将结果传给构建器。

## 已修复但必须防回归的问题：Authority catalog overlay 漂移

### 现象

生产 Authority 指针已指向 v0.22，但 `knowledge/authority-domain-catalog/catalog.json` 仍来自 v0.9。认证后的 `_active-authority` 路由检测到 catalog 与 Authority pointer 不一致，返回 `runtime-pointer-mismatch`，因此用户无法读取新版图谱。

### 已采取的恢复

已将 catalog 恢复到与 v0.22 Authority 一致的已验证内容，并以受认证请求复核图谱接口返回 200。代码侧已提交 `339e8e363 fix(runtime-release): validate authority catalog overlay closure`：Runtime Release 选择前会检查 catalog overlay 与 Authority pointer 是否闭合。

### 上游仍需处理

恢复不能替代协议修复。生产选择必须把 Authority snapshot、catalog、shards、projection、prerequisites、consumer activation 和 Runtime Release 作为一个组合候选验证；不能先单独切 Authority，再依赖文件布局或人工补拷贝修复 catalog。

## 阻塞一：活动 Runtime 的逻辑资源分母不完整

### 根因

`runtime-bb309e6a…` 的 7277 个 manifest 文件是物理对象，不等同于 7277 个教学资源。当前 `formal-resource-remediation` 有 1058 条标记为 `ACTIVE_BASELINE` 的处理记录：

| 子类 | 数量 | 当前来源 |
| --- | ---: | --- |
| 知识卡片 | 838 | Runtime card 节点文件 |
| 讲义 | 31 | authoring 讲义与 runtime 派生讲义 |
| 音频 | 28 | Runtime lesson media |
| 互动练习 | 32 | Runtime interactive manifest |
| 导入视频 | 31 | Runtime intro-video 文件 |
| launcher | 85 | 生产数据库 `TeachingResource` |
| 讲义练习 | 13 | 讲义内锚点 |

旧 evidence 把旧 v0.9 的单个非资源项作为 baseline，并把 1058 条全部列为 `NEW` delta；另一份交接又把所有 Runtime Blob 当作 baseline。这两种算法都不符合“生产活动逻辑资源 + 明确非资源处置”的规范：前者丢失当前 v0.22/Runtime 前任，后者混淆 Blob 与资源。

### 生产数据不一致

`scripts/knowledge-cutover/process-simulations.ts` 仅处理 `ETHICS_SCENARIO`、`INTERACTIVE_COMP`、`SIMULATION_APP` 三种数据库资源，得到 85 条 launcher 记录。生产数据库实际有 105 条带 `registryId` 的 `TeachingResource`：额外 20 条为 `STATIC_MEDIA`，其中 5 条已被 `LessonItem` 引用。它们既不在现有 1058 条记录中，也没有获得资源、非资源或 owner retirement 处置。

这说明现有 resource envelope 不能被用作当前活动基线的完整证明。

### 上游应提供的修复

1. 从活动 Runtime Release 的 immutable manifest、active receipt、lifecycle generation 建立新的 baseline capture，而不是读取工作目录、历史 release 或现成 output。
2. 建立显式分类工件：每个逻辑资源需绑定资源 ID、子类、受控来源、关联的 Runtime 路径或数据库来源；每个不属于逻辑资源的 Runtime 文件必须带有明确非资源处置。
3. 将所有带 `registryId` 的生产 `TeachingResource` 纳入该捕获。对 `STATIC_MEDIA`：若进入活动课程，则必须进入原子绑定与连续性 gate；若确属当前课程外资源，必须由可审计的范围/非资源决定排除，不能由类型过滤隐式忽略。
4. 保持一对多关系：一个 Runtime manifest 文件可以承载多个逻辑资源（例如互动 manifest 或讲义内练习），一个数据库资源也可以没有对应 blob；分类工件需要明确这种来源关系。
5. 由新的 baseline 与有序 `NEW`/`CHANGED` successor delta 计算 denominator。活动 baseline 的技术失败必须阻断；只有独立、证据绑定的 owner retirement 才能移除它。

## 阻塞二：v0.37 图谱控制面尚未物化为可激活组合

v0.37-r3 已产生 candidate-only 的 Authority snapshot、Teaching Projection、prerequisite publication 和 consumer activation 工件，但它们还没有与生产 Authority store 所需的 catalog/shard payload 及 Runtime manifest extension 形成同一闭包。

现有 v0.22 admit 链消费旧 aggregate 协议；v0.37-r3 为 public bundle 0.3，不能通过“同 Schema 直接 admit”绕开新的 coordinated candidate。上游实现应：

1. 从已捕获的 r3 bundle 生成 Authority store snapshot、catalog 和完整 shard set，并在构建端验证它们的 release/snapshot/locale identity 一致。
2. 让 projection、prerequisites、consumer activation、catalog、shards 和 Runtime extension 都绑定同一 allocation record；不得回写或引用尚未生成的 candidate/active receipt hash。
3. 在 candidate sealing 前重新打开并验证每一份内层工件及其哈希。单独存在的 v0.37 snapshot 或 Runtime candidate 都不能被认定为可选。

## 阻塞三：现有远端切换脚本不能表达 v0.22 的混合前任

生产前任不是“全部 selector 缺失”的 first activation：Authority v0.22 已存在，而 projection、prerequisites、catalog、shards、consumer activation 和 transaction receipt 的运行时指针处于缺失状态。旧 first-activation 脚本要求 all-ABSENT，不能安全复用于该组合。

上游需要一个版本无关的 outer transaction：

1. 在一个外层排他锁内停止图谱、应用、worker 与 Runtime 消费者，随后重读并精确匹配完整前任组合。
2. 先写入 durable write-ahead journal，记录预分配 transaction ID、candidate receipt、每个 selector 的前任/后继预期、顺序和补偿计划。
3. 每一次图谱 selector 与 Runtime lifecycle 写入都必须 CAS 前任或 journal 中的预期中间态，并产出绑定 transaction ID 与 candidate receipt 的内层 receipt。
4. 所有后继状态重读成功后才写 coordinated active receipt；它是允许服务恢复的唯一 commit marker。
5. 任一 pre-readiness 失败只回滚仍与 journal 匹配的状态；遇到未知外部变更必须失败关闭，不得覆盖。

当前 `runtime-a1a454a7…` 仅证明 Runtime Blob 可以从当前前任继承并物化，不满足上述 transaction 输入，禁止单独 active。

## 阻塞四：最新发布捕获被版本常量替代

当前脚本中 `control-theory-engineering-v0.37-r3`、source commit 和 bundle ID 以常量写入。它们在本次核验时与远端最新正式聚合包相符，但这不是通用的“最新完整 Authority”实现。

上游应把以下检查移到一次性 capture 阶段：刷新正式远端 tag、解析最新完整 aggregate、验证 Module/Terminology/Integration/Coverage/Overlay/Registry 六类组件闭包、验证 publication/lineage/hash、拒绝脏 ActKG worktree，并验证既有 adapter 的 public schema/contract/required members/representative parse。任何不兼容结果都必须为 `ADAPTATION_REQUIRED`，且不得生成 selector 或可选 candidate。

## 建议的验收测试

1. 模拟 Authority 已更新而 catalog 仍为旧版本，候选和运行时读取均失败关闭。
2. 删除一条活动逻辑资源、遗漏一条非资源处置、或把活动资源错误标记为 `NEW`，baseline qualification 必须失败。
3. 增加已被 LessonItem 引用的 `STATIC_MEDIA`，但不提供原子绑定/处置，continuity gate 必须阻断。
4. 校验同一 Runtime 文件承载多条逻辑资源，以及数据库 launcher 无 blob 路径的合法情形。
5. 将 v0.22 Authority PRESENT、其余图谱 selectors ABSENT 作为 transaction 前任，验证成功切换和每个 selector/Runtime mutation 点的失败回滚。
6. 验证 Runtime 与 graph successor 的 Authority、allocation、denominator、resource envelope、projection、shards、prerequisites、consumer activation 或 candidate receipt 任一不一致时，active receipt 不变。
7. 在 r3 candidate 尚未完成时发布一个后续同 Schema release，确认 r3 候选不被改写；下一次执行才单独捕获新 release。

## 非目标与操作限制

- 不通过手工复制 `catalog.json`、直接改 `current.json`、重命名 Runtime release 或关闭 continuity gate 来完成 v0.37 激活。
- 不删除 v0.22 Authority、现行 Runtime、旧候选、Blob 或生产数据库记录；它们是回滚与审计证据。
- 不在服务器重新构建 Authority 或 Runtime 输入；构建应从冻结 Git tree 完成，服务器只接收不可变、已校验工件。
- 不把 candidate 发布、应用部署和生产 activation 混为单一授权或单一步骤。

## 修复完成判据

上游交付必须能够生成一份新的、不可选的 v0.37-r3 coordinated candidate。该 candidate 应重新绑定当前 Runtime 前任、完整逻辑资源/非资源分类、`STATIC_MEDIA` 处置、v0.37 图谱控制面、Runtime materialization receipt、完整 selector 前任和 journaled transaction 实现身份。通过上述测试后，才可单独申请部署与生产激活授权。
