# Arena V2 任务 07：提交记录与排行榜规范化

> 面向执行代理：榜单只读真实提交；不要让 UI 自己拼 Prisma row 或从静态 seed 伪造成绩。

## 目标

把提交和榜单从可用状态升级为可解释、可筛选、可长期维护。主榜、方法榜、指标榜、Pareto 榜、班级榜、赛季榜都基于同一组 `ArenaSubmissionRecord[]` 生成。

## 依赖

- 任务 05 已能从工作台创建正式提交。
- 任务 06 已稳定 protocolVersion 与评测结果结构。

## 触及文件

```text
src/features/arena/leaderboards/leaderboard.ts
src/features/arena/leaderboards/leaderboard-service.ts
src/features/arena/submissions/prisma-store.ts
src/features/arena/submissions/persistence.ts
src/features/arena/stats.ts
src/features/arena/challenge-detail.tsx
src/features/arena/__tests__/arena-leaderboard.test.ts
src/features/arena/__tests__/arena-prisma-store.test.ts
```

## 执行步骤

- [ ] 新增或完善 `leaderboard-service.ts`，职责仅限：

```text
读取 submissions
应用榜单规则
返回 leaderboard view model
```

它不得做评测，不得写数据库。

- [ ] 统一榜单输入类型为 `ArenaSubmissionRecord[]`。
- [ ] 主榜规则：

```text
只纳入 evaluation.valid === true；
同一学生同一任务只取最高分；
score 降序；
同分按 LeaderboardPolicy.tieBreakers；
```

- [ ] 方法榜：

```text
按 artifact.method 分组；
仍只纳入 valid=true；
同一学生同一方法保留最好提交；
```

- [ ] 指标榜：

```text
对每个 primaryMetric 生成单指标排名；
metric direction 来自 MetricDefinition.direction；
minimize 升序，maximize 降序；
缺失指标不得按 0 填充；
```

- [ ] Pareto 榜：

```text
针对 task.primaryMetrics 计算非支配集合；
输出 paretoTier 或 dominated 标记；
缺失任一 Pareto 指标则不进入 Pareto 集；
```

- [ ] 班级榜：

```text
利用 ArenaSubmission.classId；
无 classId 时不混入班级榜；
```

- [ ] 赛季榜：

```text
利用 seasonId；
无 seasonId 时归入默认公开练习视图或从赛季榜排除，按现有产品语义选择一种并写进测试。
```

- [ ] `challenge-detail.tsx` 展示真实榜单摘要，覆盖无提交、无有效提交、全部无效提交三种空态。
- [ ] 保护 `artifactHash + protocolVersion` 缓存复用逻辑，不因榜单改造重复评测。

## 验证命令

```bash
rtk npm run test:unit -- src/features/arena/__tests__/arena-leaderboard.test.ts src/features/arena/__tests__/arena-prisma-store.test.ts
rtk npm run lint
```

## 验收条件

- challenge detail 展示真实提交数据生成的榜单摘要。
- 主榜、方法榜、指标榜、Pareto 榜均有单元测试。
- 同一学生重复提交不会刷屏主榜。
- 指标榜排序方向来自 `MetricProfile`，不在榜单函数中硬编码。
- 无提交和全无效提交有明确空态。
- 协议版本改变后，榜单不会混入旧协议评测结果。

