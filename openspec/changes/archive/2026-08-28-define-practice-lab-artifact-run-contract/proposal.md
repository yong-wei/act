## Why

Practice live runs、Arena preview、Arena official evaluation 和 standalone SimulationRun 目前各自携带 task、controller、model、result 和 replay 字段，身份映射依赖 payload 约定。缺少一个不新增第二套 run schema 的公共合同，会让 preview、Practice 结果被误接入官方评价或让不同 revision 的证据被错误合并。

## What Changes

- 建立 `ControllerArtifact`、Practice run、Arena preview、Arena official evaluation 和 `SimulationRun` 之间的规范化身份映射合同。
- 统一记录 `owner`、`taskId`、`specHash`、`artifactHash/controllerSnapshotRef`、protocol/runtime/model/controller schema revision、parameter/result visibility、seed、checksum、tolerance profile、`executor` 和 `authoritySource`。
- 保持 `ArenaEvaluationRun`、`ArenaSubmission`、`SimulationRun` 各自的 owner/authority 语义；Arena evaluation 的共享评测身份不被错误折叠为另一名用户的 run。
- Preview 固定 `evaluationVisibility=preview`、`officialEligible=false`；Practice result 只属于 Practice 自己的 run/outcome，永不成为 official score 或 leaderboard 输入。
- `/api/arena/virtual-simulation-runs` 的持久化校验、Rust 重算、trace/summary 生成、checksum 计算和写入只接受 R1 server façade 的结果；browser façade 只允许非持久展示，并拒收 client trace/summary/checksum。
- 固定 surrogate 必须记录 `modelRelation=surrogate`、教学语义和 `prohibitsMixedClaims=true`；identified model 只有在 Rust capability 实际消费经授权模型参数时才可声称。
- 合同的公开部分不包含 black-box hidden inputs、hidden scenario 参数、私有 dataset/model/reference trajectory 或原始高频答案/轨迹。
- 复用既有 `simulation-scene-trace-protocol`、`simulation-runtime-replayability` 和 `simulation-arena-evidence-governance`，以投影和校验统一身份，而不是建立第二套持久化 run 表。

## Capabilities

### New Capabilities

- `practice-lab-artifact-run-contract`: 定义控制产物、Practice/Arena/Simulation 运行身份、所有权、可见性和可复核元数据的公共映射合同。

### Modified Capabilities

None。现有 `simulation-scene-trace-protocol`、`simulation-runtime-replayability`、`simulation-arena-evidence-governance`、`arena-model-registry-preview-adapters`、`arena-blackbox-official-evaluation` 和 `control-workbench-contracts` 继续作为具体系统的权威规范；本 change 仅统一交叉边界。

## Impact

- **Owner**：Platform/Control Artifact & Run Contract；Practice Lab、Arena 和 Simulation 保留各自数据与业务 authority。
- **Models**：`ArenaControllerArtifact`、`ArenaEvaluationRun`、`ArenaSubmission`、`ArenaVirtualSimulationRun`、`SimulationTaskSpec`、`SimulationRun`、`SimulationTrace`。不新建第二个 run schema，也不要求本 change 做 Prisma 大迁移。
- **Routes/APIs**：`/api/arena/blackbox-experiments`、`/api/arena/virtual-simulation-runs`、`/api/arena/evaluate`、`/api/arena/submissions`、`/api/simulation/runs` 及 standalone Practice/simulation callers；实现时以 route inventory 冻结完整集合。virtual preview route 只接受 server façade 派生的 trace/summary/checksum 并负责写入既有 preview records，browser façade 不得写入。
- **Scripts/tests/callers**：`src/features/arena/blackbox/controller-preview.ts`、`src/features/arena/submissions/workbench-preview.ts`、`src/lib/data-governance/simulation-scene-run-persistence.ts`、evidence/replay materializers、对应 Arena/Simulation contract tests 和所有调用者。测试分母必须区分官方、preview、Practice、teacher/admin preview。
- **Identity denominator**：以 captured `a3e6ce7435503050146cadeae6359d6b8eb9a2a5` 的 tracked models/routes/writers/tests 为初始观察，执行时重算 `git ls-files`、读写符号图和 Prisma 字段；不得把旧 payload 字段直接视为完整合同。
- **Dependencies**：硬前置为 `establish-modular-monolith-refactor-charter`、`enforce-modular-domain-dependency-contracts`；R3、R4、R5 依赖 R1+R2，R6 依赖 R3-R5。tracking parent 不作 blocker。
- 不改 Arena 评分产品规则、DB 大迁移、课程 manifest、榜单策略、生产部署或 official evaluator authority。
