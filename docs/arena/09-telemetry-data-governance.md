# Arena V2 任务 09：Arena 埋点与数据治理接入

> 面向执行代理：只记录高价值事件。参数滑块移动等高频噪声不得直接上传服务器。

## 目标

让 Arena 核心行为进入 `InteractionLog`，并把官方提交、无效提交、黑箱实验等关键事件物化为可被个人中心和教师洞察消费的学习证据。

## 依赖

- 任务 05 已产生正式提交事件。
- 任务 08 已覆盖黑箱实验和虚拟仿真预演事件。

## 触及文件

```text
src/features/arena/telemetry.ts
src/features/arena/arena-telemetry-client.tsx
src/features/arena/analytics.ts
src/features/arena/profile.ts
src/app/api/interactive/events/route.ts
src/lib/data-governance/*
src/features/arena/__tests__/arena-telemetry-analytics.test.ts
src/features/arena/__tests__/arena-profile.test.ts
```

## 执行步骤

- [ ] 确认 `/api/interactive/events` 能写入 Arena 事件到 `InteractionLog`。
- [ ] 补齐核心事件触发点：

```text
arena_challenge_open
arena_workspace_start
arena_simulation_run
arena_controller_save
arena_identification_model_save
arena_virtual_simulation_import
arena_submit
arena_evaluation_complete
arena_result_view
arena_leaderboard_view
```

- [ ] 统一 `eventData` 字段。每个 Arena 事件至少包含：

```ts
{
  taskId: string | null;
  objectId: string | null;
  method: string | null;
  workspaceMode: string | null;
  score: number | null;
  valid: boolean | null;
  artifactHash: string | null;
  metricProfileId: string | null;
  leaderboardPolicyId: string | null;
}
```

字段缺失时写 `null`，不要省字段。

- [ ] 数据治理映射至少区分：

```text
arena_evaluation_complete valid=true：有效控制设计证据；
arena_submit valid=false：待改进证据；
arena_identification_model_save：黑箱辨识证据；
arena_virtual_simulation_import：虚拟仿真预演证据。
```

- [ ] 能力维度映射：

```text
控制建模与分析
参数设计与调优
跨域迁移与联动
工程决策与约束
探究反思与提示词
自主学习进展
```

- [ ] 学生 profile 最近活动可显示 Arena 行为；教师班级洞察可聚合 Arena 达标情况。
- [ ] 避免重复打开页面造成大量冗余事件；页面打开事件需要合理去重或节流。

## 验证命令

```bash
rtk npm run test:unit -- src/features/arena/__tests__/arena-telemetry-analytics.test.ts src/features/arena/__tests__/arena-profile.test.ts
rtk npm run lint
```

若治理 worker/backfill 代码改变，增加对应 worker 或 backfill 定向测试。

## 验收条件

- Arena 核心事件能进入 `InteractionLog`。
- `eventData` 字段结构稳定。
- 官方有效提交、无效提交、黑箱辨识至少三类事实可区分。
- 学生个人中心最近活动能看到 Arena 行为。
- 教师端班级洞察能聚合 Arena 达标情况。
- 参数调整不会形成高频服务器事件。

