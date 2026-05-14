# Arena V2 任务 05：工作台控制器工件生成与官方提交

> 面向执行代理：提交必须调用现有 `/api/arena/evaluate`，不得新增平行提交 API。

## 目标

学生在多表征工作台完成设计后，能够从当前工作台状态生成标准化 `ControllerArtifact`，运行预提交检查，并通过 `/api/arena/evaluate` 创建正式 `ArenaSubmission`。

## 依赖

- 任务 03 已能加载 challenge 上下文。
- 任务 04 已能展示预评测结果。

## 触及文件

```text
src/features/arena/submissions/controller-artifact-builder.ts
src/features/arena/workbench/artifact-mappers.ts
src/features/interactive/multi-representation-linkage/model.ts
src/features/interactive/multi-representation-linkage/page-client.tsx
src/features/interactive/multi-representation-linkage/arena-submit-panel.tsx
src/features/arena/__tests__/arena-controller-artifact.test.ts
src/features/interactive/__tests__/multi-representation-arena-context.test.tsx
```

## 执行步骤

- [ ] 新增 `buildArenaArtifactFromMultiRepresentationState(input)`，输入包含 task、arenaContext、gain、当前 correction 状态和必要元数据。
- [ ] 映射 PID/PI/PD：

```text
method = pid
params = { kp, ki, kd }
```

- [ ] 映射 lead/lag：

```text
method = serial-compensator
params = { gain, zero, pole }
```

- [ ] 对 lead_lag 或当前官方 artifact 不支持的结构，显示“可预评测，暂不可官方提交”，不得伪造成单一 lead。
- [ ] 新增 `buildPreviewMetricsFromControlAnalysis(context, adaptedAnalysis)`，用于预提交检查展示。
- [ ] 在工作台 challenge mode 中增加操作区：

```text
运行预评测
提交官方评测
查看挑战详情
```

“保存方案”如未落库，必须禁用并显示准确原因；不要伪装为已保存。

- [ ] 提交调用：

```text
POST /api/arena/evaluate
```

请求体使用现有 API 约定，不新增 `/api/arena/workbench-submit`。

- [ ] 提交成功后显示：

```text
score
valid
metrics
hardConstraintResults
explanation
reusedEvaluation
```

- [ ] 发送核心事件：`arena_submit`、`arena_evaluation_complete`、`arena_result_view`。
- [ ] 处理错误状态：未登录、非学生、非 allowedMethods、表单缺失、硬约束失败、服务端评测失败。

## 验证命令

```bash
rtk npm run test:unit -- src/features/arena/__tests__/arena-controller-artifact.test.ts src/app/api/arena/evaluate/__tests__/route.test.ts
rtk npm run test:unit -- src/features/interactive/__tests__/multi-representation-arena-context.test.tsx
rtk npm run lint
```

## 验收条件

- 多表征工作台能从当前 PID 参数生成 `ControllerArtifact`。
- lead 或 lag 参数能生成可提交 `serial-compensator` artifact。
- 不支持的校正结构被明确拦截。
- 提交只调用 `/api/arena/evaluate`。
- 提交成功后数据库出现真实 `ArenaSubmission`。
- 相同 artifact 再次提交能复用已有评测结果。
- 挑战详情页刷新后能看到提交摘要或榜单变化。
- 非学生身份和未登录请求被拒绝。

