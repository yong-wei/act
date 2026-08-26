## Context

当前 learner-state 服务从 `learningFact`、portrait v2、student evidence cache、Arena writeback、path、risk、ability estimate 和资源偏好等多处直接读取，并在同一文件中声明 payload、字段合同、goal slice、课程/任务常量以及 role projection。`readAdaptiveLearnerState`、`readPathPlannerLearnerState` 和 `isAdaptiveLearnerStateServiceEnabled` 被 API、Konling、graph center、recommendation、profile 和测试大量直接引用。

canonical `adaptive-learner-state-service` 已规定 server-owned、portrait v2、量化/隐私、增量、幂等和历史 revision；canonical `adaptive-mastery-state` 已规定 assessment-backed mastery 的保守置信度。此 change 只重新划分计算与读取边界，沿用这些事实和算法，不增加第二套画像或掌握度模型。

## Goals / Non-Goals

**Goals:**

- 让 reducer 在没有 Prisma、Next、React、Arena client 或网络副作用时可确定性测试。
- 使 Learning Record facts/snapshots 与 Assessment durable outcomes 成为 learner-state 的唯一输入来源。
- 让 role/goal projection、freshness、confidence、privacy、provenance 和 no-evidence/unavailable 状态保持现有语义。
- 迁移真实调用者后物理删除旧 service public entry，不保留转发或 re-export。

**Non-Goals:**

- 不重新设计 portrait v2 维度、BKT/评分、LearningFact schema、事件幂等或历史 migration。
- 不在本 change 引入 control-correction 的课程/lesson/Arena 插件；插件由下游 change 负责。
- 不让 reducer 读取 Prisma、route handler、客户端 profile hints、原始答案或模型叙述。
- 不同时实现新的 recommendation 或 path planning 算法。
- 不部署、不做生产回填或生产激活。

## Decisions

### 1. 计算层只接收归一化 read-port 输入

定义 `LearnerStateReducerInput`，包含已通过 Learning Record read port 的 `LearningFact`/snapshot/evidence window、通过 Assessment read port 的 durable outcome/mastery references、授权 role scope、goal contract、algorithm version 和 evaluation time。reducer 只执行状态归约、confidence/freshness 合并和 privacy-safe projection，不执行 I/O、写库或队列。

```text
Learning Record read port ─┐
Assessment read port ──────┼─> LearnerStateReducer -> role/goal projection
Goal plugin context ───────┘
```

同一输入、同一算法版本和同一时钟应产生同一结果；无事实、stale 或 partial 输入输出显式限制，不伪造零掌握度或完整诊断。

### 2. Application 负责读取，adapter 负责基础设施

新的 Personalization application service 组合 `LearningRecordReadPort`、`AssessmentReadPort`、必要的受治理 feature read port 和 role projector。Prisma、Redis、Arena writeback、path 读取和旧兼容 snapshot 仅在 adapters 中实现。`readAdaptiveLearnerState` 的现有响应可由 public API 映射保持兼容，但 route 不再直接传 Prisma 给领域 reducer。

Learning Record 仍拥有“发生了什么”的事实；Assessment 仍拥有评估结果和 assessment-backed mastery authority；Personalization 只归约和投影，不把浏览、提示或未验证模型输出变成 mastery。

### 3. 一条公开边界服务不同消费者

公开 API 按 `readLearnerState({ actor, subject, roleScope, goal })` 提供 student、teacher、admin 和 system projections；path planner 可用同一边界的明确 path read projection。不能通过另一个 `readPathPlannerLearnerState` 私有实现绕过 reducer。响应字段继续按 canonical governance contract 标注 privacy 和 confidence。

### 4. 课程特定数据只以 plugin context 进入

本 change 允许 reducer 接收已声明的 goal/plugin context 接口，但不在通用层保存 `courseId`、`lessonId` 或 Arena task 常量。control-correction 的具体映射、证据规则和持久化策略由后续 plugin 注册；没有插件时返回 unsupported-goal 或显式 limitation。

### 5. 迁移完成即删除旧入口

先用 import graph 和 characterization 列出所有 `adaptive-learner-state-service` imports，再按 route → application → reducer → ports → adapters 迁移。所有生产、worker、测试和工具调用者完成替换并通过回归后，删除旧 service exports、兼容文件和仅供旧实现的类型；不以 re-export 延长寿命。仍有其他域需要的数据表和 read adapters 不因入口删除而删除。

## Risks / Trade-offs

- [read-port 投影丢失某一历史来源] → 为每个 field family 保留 source coverage、freshness、limitation 和 identity；先跑 characterization 再切换调用者。
- [纯 reducer 与现有大 service 输出不一致] → 用同一输入 fixture 做 byte/field-level parity，差异只有明确的旧兼容 bug 或 canonical contract 修正。
- [调用者遗漏导致运行时仍引用旧模块] → architecture fitness 和生产 import graph 必须为零旧 authority imports，否则不执行删除。
- [role scope 被 reducer 错误放宽] → reducer 只接受已授权 scope，adapter 在读取前完成 subject/class authorization，负向测试覆盖 student/teacher/admin。
- [时间依赖造成增量结果漂移] → reducer 输入显式传入 evaluation time，测试固定时钟；elapsed age 只能改变 evidence age，不重置状态。

## Migration Plan

1. 验证 Assessment public API 和 charter/dependency contracts，冻结现有 service 输出与调用者分母。
2. 定义 read ports、归一化输入、纯 reducer 和 role/goal projector，加入 parity/不变量测试。
3. 迁移 API、profile、Konling、graph center、recommendation、feature cache 和 worker 读取路径。
4. 删除旧 service public entry 与转发，更新退役台账，运行 Personalization/Learning Record/Assessment 相关测试、typecheck、strict validation 和 diff check。
5. 回滚只回退 application wiring；事实、snapshot、mastery 和历史 revision 不改写。生产部署和回填不在本 change 内。

## Open Questions

无。是否读取额外 feature cache 由既有 governance contract 决定；任何新来源必须先进入 Learning Record/Assessment read port，不能临时向 reducer 注入 Prisma 查询。
