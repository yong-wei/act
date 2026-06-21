# audit-remediation-p0-stability Evidence

日期：2026-06-21
OpenSpec change：`audit-remediation-p0-stability`
关联 issue：#610

## 覆盖范围

- 注册短密码普通校验错误不得升级为 Next runtime error。
- 空教案不得保存为可发起课堂状态，既有 0 环节教案不得进入 `1 / 0` 正式课堂。
- 教师投影 demo 不得在主体暴露 `Not found`，demo session 不得写入持久课堂同步 API。
- `/teacher/prep-packs`、`/teacher/prep-packs?cluster=...`、`/teacher/prep-packs?classId=...` 在 `CourseEnhancementPack` 表缺失或无数据时必须进入产品化空态/恢复态，不得返回 500。

## 代码证据

- `src/lib/register-error.ts`：将 API 返回的 Zod `formErrors/fieldErrors` 规整为可渲染字符串。
- `src/app/(auth)/register/page.tsx`：注册页只渲染字符串错误。
- `src/lib/lesson-plan-readiness.ts`：集中定义教案可发起课堂的最小内容要求。
- `src/app/api/lesson-plans/route.ts`、`src/app/api/lesson-plans/[id]/route.ts`：拒绝保存 0 环节教案。
- `src/app/api/session/route.ts`：拒绝直接从 0 环节教案创建课堂。
- `src/features/lesson-engine/lesson-plan-list.tsx`、`src/features/lesson-engine/orchestrator-builder.tsx`、`src/features/lesson-engine/teacher-player.tsx`：UI 层阻止空教案发课，并给既有异常教案恢复状态。
- `src/features/interactive/session-framework/use-teacher-lesson-session.ts`、`src/features/interactive/session-framework/use-session-progress-channel.ts`、`src/features/interactive/hooks/useInteractiveTracking.ts`：教师 demo session 保持本地状态，不再写入持久同步 API。
- `src/app/teacher/prep-packs/page.tsx`、`src/features/teacher/teacher-prep-pack-review-surface.tsx`：缺表或无数据时显示课前包恢复/空态。
- `tests/audit-remediation-p0-stability.spec.ts`：投影 demo 与课前包路由的 Playwright 回归验收。

## 验证记录

```bash
rtk npm run test:unit -- src/lib/__tests__/register-error.test.ts src/lib/__tests__/lesson-plan-readiness.test.ts src/app/__tests__/lesson-plan-session-routes.test.ts src/app/__tests__/teacher-prep-packs-page.test.ts src/features/interactive/__tests__/use-teacher-lesson-session.test.tsx src/features/interactive/__tests__/interactive-tracking.test.tsx
```

结果：6 个测试文件、16 个用例通过。

```bash
rtk npx playwright test tests/audit-remediation-p0-stability.spec.ts --reporter=line
```

结果：2 个 Playwright 用例通过，覆盖教师投影 demo 与课前包 root、cluster、class-scoped 路由。其中教师投影用例遍历 29 个 `teacher/demo` 路由，确认页面不暴露 `Not found`，且 `/api/session/demo`、`/api/interactive/events` 没有产生 4xx/5xx demo 持久同步错误。

```bash
rtk npm run lint
```

结果：通过，0 warning。

## 后续边界

本变更只关闭 P0 稳定性阻断。课前包复核的生成、预览、激活、回滚和影响证据动作仍需要在后续教师报告/治理类变更中继续做功能完整性验收。
