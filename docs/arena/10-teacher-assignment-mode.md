# Arena V2 任务 10：教师端 Arena 作业模式

> 面向执行代理：第一版只做教师选择现有 task 发布为班级挑战，不做完整可视化挑战编辑器。

## 目标

教师能够把 `homeworkEligible=true` 的 Arena 任务发布为班级或课堂挑战；学生从作业入口进入后提交记录写入 `classId`，榜单展示遵守作业模式可见性。

## 依赖

- 任务 07 榜单支持 classId。
- 任务 09 事件和学习证据已能记录 Arena 作业行为。

## 触及文件

```text
src/app/teacher/arena/page.tsx
src/features/arena/teacher/configuration.ts
src/features/arena/teacher/teacher-arena-config.tsx
src/app/api/arena/teacher/*
src/features/arena/submissions/persistence.ts
src/features/arena/submissions/prisma-store.ts
src/features/arena/challenge-detail.tsx
src/features/arena/__tests__/arena-teacher-config.test.ts
src/features/arena/__tests__/arena-prisma-store.test.ts
```

## 执行步骤

- [ ] 教师 Arena 页面展示可发布任务列表：

```text
任务名称
任务来源
是否作业可用
推荐工作台
评价指标
榜单可见范围
允许方法
```

- [ ] 发布配置第一版字段：

```ts
export interface ArenaAssignmentConfig {
  taskId: string;
  classId: string;
  titleOverride?: string;
  openAt?: string;
  dueAt?: string;
  leaderboardVisibility: 'hidden-until-due' | 'anonymous' | 'open';
  gradingPolicy: 'pass' | 'score-bonus' | 'rank-bonus';
}
```

- [ ] 发布时只允许 `homeworkEligible=true` 的 task。
- [ ] 学生从班级或作业入口进入 challenge 时，将 class/session 上下文传递到提交链路。
- [ ] `ArenaSubmission.classId` 写入当前班级；无班级上下文时保留公开练习语义。
- [ ] 作业期间榜单展示策略：

```text
hidden-until-due：截止前不公开完整榜单；
anonymous：截止前显示匿名百分位；
open：公开练习式榜单。
```

- [ ] 成绩解释不能只按排名，至少支持：

```text
达标分
过程分
改进分
性能附加分
反思说明
```

- [ ] 教师端不重写评测逻辑，只读取 Arena 任务、提交和榜单服务。

## 验证命令

```bash
rtk npm run test:unit -- src/features/arena/__tests__/arena-teacher-config.test.ts src/features/arena/__tests__/arena-prisma-store.test.ts
rtk npm run lint
```

若新增 API route：

```bash
rtk npm run test:unit -- src/app/api/arena/teacher
```

## 验收条件

- 教师能查看 Arena task 列表和详情。
- 教师只能发布作业可用任务。
- 发布配置能绑定班级。
- 学生从班级任务进入后提交写入 `classId`。
- 班级榜可按 `classId` 过滤。
- 截止前榜单显示策略可配置。
- 教师端没有重复实现评测算法。

