## Context

路径规划生产链路为：控灵工具 `generate_learning_path` / `revise_learning_path_options`（`src/lib/konling-agent-runtime.ts:8002-8011`）→ `runAdaptivePathToolOperation`（:4263）→ `planLearningPath`（`src/features/personalization/path-planning/application/plan-learning-path.ts:150`，七阶段端口管线）。候选池由 `resolveAdaptivePathGenerationRegistry`（`src/lib/konling-agent-runtime.ts:5529-5582`）装配，当前四个候选源：DB TeachingResource（teacherOnly:false）、运行态课次目录、运行态教材结构、`runtime-resource-projections.jsonl` sidecar，汇入 `buildResourceNodeRegistryFromTeachingResources`（`src/lib/teacher-resource-node-data.ts:71`）→ `buildResourceNodeRegistry`（`src/lib/resource-node-registry.ts:1080`），由 `mergeOverlappingSources`（:2718）按 id 合并。

ResourceNode 现有 20 种类型（`src/lib/resource-node-registry.ts:12-33`），无 exercise、无 textbook_chapter。`pathEligible` 三层判定：`auditResourceNode`（:1233-1319）、高置信审计（:2868-2929）、评审批次白名单（`resource-node-path-readiness-review-batch.ts`）——未评审资源一律 excluded-with-rationale blocking。

教学投影 B′（proj-d22e0cca）有 1227 资源 / 2458 绑定 / 434 canonical。B′ 绑定与既有 ResourceNode 的重叠度已核实：card 338 中 205 命中 sidecar `knowledge-card:<同id>`；handout 28 全命中 `runtime-handout:<课次>`；video 31 / audio 28 全命中 `runtime-media:<课次>:*` 但 mix 不含；simulation 42 中 3 个 arena + 9 个 DB cuid 后缀可对应，约 30 个 lessonXX 课堂仿真 id 不同名需映射；exercise 44 无对应类型；textbook-section 3 可对应；textbook/textbook-chapter 容器不可（textbook 容器被审计硬阻断 :1239）。canonical↔旧节点 id 桥存在于 cutover 分母证据 `course-content/authoring/knowledge/cutover/candidates/control-theory-engineering-v0.37-r4-c5/denominator.json`（键形如 `knowledge-card:比例控制_1_1`，resourceId 同时承载 `act:*` 投影 id 与旧节点 id）。

`allowedResourceMix` 目标定义在 `src/features/personalization/path-planning/internal/assemble-plan.ts`（AUTOCONTROL :1113、FOUNDATION :1128、control-correction :1469、frequency-response-foundations :1521——唯一含 handout/slides）；插件策略在 `path-planning-policy.ts:10-24`；所有 mix 均不含 video/audio。`nodeMatchesGoal`（assemble-plan.ts:3338）目前只比旧节点 id 目标集合。`/api/learning-paths/*` 只持久化不规划，不在本变更范围。

## Goals / Non-Goals

**Goals:**

- 教学投影绑定作为第五候选源进入 `planLearningPath` 候选池，全资源类型（讲义/卡/视频/音频/习题/仿真/教材节）可被控灵生成的路径包含。
- 目标匹配、排序、解释消费 canonical 绑定信号；候选计数按资源族报告。
- 类型与 mix 扩展走治理流程：评审扩容先生效，新族才可入选。
- 现有路径测试不回退；typecheck 通过。

**Non-Goals:**

- 不新建第二规划器；不接线 `planActPrerequisitePath`（测试态实现，core-nodes 为空时任何目标 goal-not-found blocked），只预留 CandidateProvider 端口形状。
- 不绕过评审/审计准入：未评审资源仍 excluded-with-rationale blocking。
- 不改 `/api/learning-paths/*` 持久化合同、不改 UI、不改正文 sanitizer。
- 不做投影数据修复（属 Change 1）；不执行生产发布或运行态切换。
- 不对 lessonXX 课堂仿真做模糊 id 匹配；无显式映射表的资源跳过并计数。

## Decisions

1. **适配器作为第五候选源，不是独立管线。** 在 `resolveAdaptivePathGenerationRegistry` 追加 `loadCandidateSourceFamily('teaching-projection-bindings', ...)`，读取活投影 resources/bindings/cards-index，产出 ResourceNode 补丁后汇入 `buildResourceNodeRegistryFromTeachingResources`，复用 `mergeOverlappingSources` 按 id 合并。备选是新建 CandidateProvider 实现直接读投影；拒绝，因为候选族诊断、准入审计与合并语义已在 registry 装配点实现，第二通道会绕过它们。

2. **身份映射只用确定性规则，禁止模糊匹配。** 映射表：
   - `act:handout:<lessonKey>` → `runtime-handout:<lessonKey>`
   - `act:card:<stableCardId>` → `knowledge-card:<stableCardId>`（经 denominator.json 桥核对）
   - `act:video:<lessonKey>:<mediaId>` / `act:audio:<lessonKey>:<mediaId>` → `runtime-media:<lessonKey>:<mediaId>`
   - `act:simulation:arena-task-<taskId>` → `arena-task:<taskId>`
   - `act:simulation:lesson<N>-*` → 显式课堂仿真映射表（无条目跳过并计数，不猜测）
   - `act:textbook-section:<sectionId>` → 既有 textbook_section 节点
   - `act:textbook` / `act:textbook-chapter` 容器不产出路径节点（审计硬阻断容器类型）
   - `act:exercise:*` → 新 `exercise` 类型节点（见决策 3）
   映射规则与 `src/lib/teaching-projection/identity.ts:68-105` 的派生规则保持一致，适配器只做投影 id → ResourceNode id 方向的反解。

3. **exercise 新增 ResourceNode 类型，不映射 quiz。** 取舍：映射 quiz 复用既有准入与 mix，但习题（课后作业）与测验（评分证据）的完成证据语义不同，混淆会污染 readiness 与 evidence 归因；新增类型需要评审扩容与 mix 扩展，但保持资源族语义清晰，与 spec 已有的"资源族计数"报告一致。选择新增 `exercise` 类型，准入走完整三层判定。

4. **canonical 目标经 denominator.json 桥映射，规划器内部仍以旧节点 id 为准。** `nodeMatchesGoal` 的目标集合扩展：把 LearningGoal 的 canonical 目标经桥映射回旧节点 id 后加入比较集合；桥只消费 cutover denominator 的精确行；无桥映射的 canonical 目标不参与匹配并计入诊断限制。canonical id 不作为 ResourceNode 主键，避免双重身份。

5. **准入真源不动，评审扩容先于 mix 生效。** 适配器补丁只补 canonical 绑定信号、标题与资源族信息，不写 `pathEligible`、不覆盖审计/评审字段。`resource-node-path-readiness-review-batch.ts` 扩容覆盖 video/audio/exercise 及新增仿真节点；治理顺序为：类型落地 → 评审批次扩容通过 → mix 扩展合入。mix 扩展合入时若对应族评审未覆盖，该族候选仍被准入层排除。

6. **`planActPrerequisitePath` 只预留端口形状。** CandidateProvider 端口允许未来接入 Projection 先修候选端口，但本变更不实现、不接线；前置条件（Change 1 的 core-nodes 喂回、REQUIRED 边数据）成熟后在独立变更中评估。

## Risks / Trade-offs

- [denominator.json 版本漂移导致桥映射错位] → 适配器加载桥时断言 capture 修订与基线 hash 字段存在并计入诊断；桥缺失或版本不符时该族为空并标记 limited，不回退模糊匹配。
- [lessonXX 课堂仿真无映射条目被静默丢弃] → 跳过项按族计数进入候选池诊断与例外报告，治理消费者可见。
- [与进行中变更 `explain-active-path-node-decisions` 的解释面重叠] → 边界划分：该变更拥有节点级入选/调整/锁定决策投影；本变更只追加候选族计数与绑定来源信号到生成期诊断，不改节点决策投影字段。两变更修改同一 spec（`adaptive-learning-path-planning`）的不同 Requirement，归档时按合并顺序重放 delta。
- [mix 扩展引入未评审媒体/习题] → 治理顺序约束（决策 5）；评审未覆盖时准入层 fail closed。
- [投影输入缺失导致候选池萎缩] → 与既有族一致的降级：族状态进诊断，路径标记 limited，不阻断其余四族。

## Migration Plan

1. 类型与适配器落地（`exercise` 类型、第五候选源、桥加载），单测覆盖映射表与降级路径。
2. `nodeMatchesGoal` canonical 目标扩展 + 诊断限制报告。
3. 评审批次扩容执行并通过（治理动作，产物入库）。
4. 各注册目标 `allowedResourceMix` 扩展 video/audio/exercise。
5. 回归：现有路径测试、typecheck、候选族计数断言。
6. 回滚：移除第五族装配调用即可恢复四族行为；类型与 mix 扩展为增量字段，无数据迁移。

## Open Questions

- `planActPrerequisitePath` 何时可作为管线内候选端口评估：依赖 Change 1 的 core-nodes 喂回与 REQUIRED 边数据，本变更不做结论。
- video/audio 节点完成证据语义（播放完成事件是否进 readiness 证据）留待后续变更；本轮只保证可入选与可解释。
- exercise 节点完成证据走现有 quiz 目录通道还是新建通道，实现期按评审结果定。
