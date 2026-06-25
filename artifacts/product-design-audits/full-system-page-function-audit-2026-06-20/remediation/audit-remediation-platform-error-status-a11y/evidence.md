# audit-remediation-platform-error-status-a11y Evidence

日期：2026-06-26
OpenSpec change：`audit-remediation-platform-error-status-a11y`
关联 issue：#672

## 覆盖范围

本变更关闭平台错误、权限边界、课堂码错误、密码校验错误、全局浮动控件/AI 侧栏焦点证据这一组横向问题。不关闭所有垂直业务页的坏 ID 和动作状态机；报告交付、评分、治理、学习路径等业务恢复状态仍由各自变更关闭。

## 审计证据来源

- `chapters/40-function-state-flows-batch32.md`：145、146。注册短密码 runtime error 与课堂码错误缺少可访问播报。
- `chapters/42-function-state-flows-batch34.md`：166、170。权限边界缺少可审计状态；全局浮动工具菜单缺少语义和焦点边界。
- `chapters/52-function-state-flows-batch44.md`：266、271、273、274、275、276。坏 ID、互动资源、教师班级、移动错误页、live/status 和 API/UI 错误语义。
- `chapters/54-function-state-flows-batch46.md`：297。课堂码、模板下载、配置保存、治理加载等状态缺少 `alert/live` 的代表证据。
- `remediation/audit-remediation-mobile-a11y-shell/evidence.md`：继承全局浮动工具、Global AI 侧栏、管理员改密弹窗和教师开始上课弹窗的 Playwright 键盘焦点证据。
- `remediation/audit-remediation-p0-stability/evidence.md`：继承注册短密码与课前包缺存储 P0 回归闭环。

## 已落地整改

- `src/lib/platform-recovery-contract.ts`
  - 新增平台恢复状态合同，覆盖 `invalid-object-route`、`missing-object`、`permission-boundary`、`classroom-code-error`、`password-validation`、`recovery-action` 和 `storage-unavailable`。
  - 统一生成 `AuditedActionState`，保留恢复类型、状态、恢复动作、播报文案和截断后的安全引用。
- `src/components/platform/action-status.tsx`
  - 增加 `data-platform-recovery-kind` 与安全引用展示。
  - 保持错误态为 `role=alert` / `aria-live=assertive`，非错误态为 `role=status` / `aria-live=polite`。
- `src/app/classroom/join/page.tsx`
  - 课堂码/班级码错误接入 `buildPlatformRecoveryState` 与 `ActionStatusPanel`。
  - 保留 `data-classroom-join-state="recoverable-error"` 与个人课堂证据恢复入口。
- `src/app/(auth)/register/page.tsx`
  - 注册短密码错误使用 `role=alert` 与 `aria-live=assertive`，继续通过 `normalizeRegistrationError` 防止 Zod 对象直接渲染。
- `src/app/admin/page.tsx`
  - 非管理员访问管理员控制台显示 `permission-boundary` 恢复状态，而不是裸权限文字。
- `src/features/lesson-engine/lesson-plan-missing-recovery.tsx`
  - 教师/管理员坏教案恢复状态接入共享恢复面板。
- `src/app/teacher/classes/[classId]/page.tsx`
  - 教师坏班级状态接入共享恢复面板，包含返回班级列表动作和安全引用。
- `src/app/interactive-learning/resources/[id]/page.tsx`
  - 互动资源坏 ID 状态接入共享恢复面板，提供返回来源资源域动作。

## Finding 对应

- 已关闭：145 中“注册短密码 runtime error”由既有 P0 证据持续守住，本变更补 `role=alert` 播报；146 的课堂码错误播报通过共享恢复面板关闭；166 的管理员权限边界通过可审计 `permission-boundary` 状态部分关闭；170 的全局浮动工具菜单语义和焦点边界由既有 Playwright 证据覆盖。
- 部分关闭：266、271、273、274、275、276 中属于互动资源坏 ID、教师坏班级、教师/管理员坏教案、权限边界和 live/status 合同的部分已关闭；课程、仿真、Arena、播放列表、学习路径、证据筛选等垂直坏 ID 仍由对应变更处理。
- 保持关闭：注册短密码与课前包缺存储 P0 回归由 `audit-remediation-p0-stability` 的单元和 Playwright 证据继续覆盖。

## 验证记录

```bash
rtk npm run test:unit -- src/lib/__tests__/platform-recovery-contract.test.ts src/app/__tests__/action-status-panel.test.ts src/app/__tests__/platform-recovery-source.test.ts src/features/interactive/__tests__/classroom-join-entry.test.ts src/app/__tests__/teacher-prep-packs-page.test.ts
```

结果：5 个测试文件、17 个用例通过。

```bash
rtk npm run lint
```

结果：通过，0 warning。

```bash
rtk npx playwright test tests/mobile-a11y-shell.spec.ts
```

结果：2 个 Playwright 用例通过，0 失败。覆盖 320px/390px 管理员与教师移动页面、全局浮动 dock、Global AI 侧栏、管理员新建/改密弹窗和教师开始上课弹窗的焦点 containment、Escape 关闭、opener 焦点恢复与移动安全区域证据。

```bash
rtk openspec validate audit-remediation-platform-error-status-a11y --strict
```

结果：通过。

```bash
rtk git diff --check
```

结果：通过。
