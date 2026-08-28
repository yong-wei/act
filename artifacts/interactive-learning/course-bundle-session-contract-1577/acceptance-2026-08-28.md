# Issue #1577 本地验收证据（ordinary runtime-first 路径）

日期：2026-08-28 · dev server http://localhost:3002 · 本地库 act_obe（迁移 20260828100000 已部署）

脚本：`scripts/acceptance/course-bundle-session-1577.ts`（NODE_OPTIONS=--conditions react-server）

结果 10/10 PASS：

1. capture 产出身份完整 bundle（release=unreleased-worktree 本地态，digest=38abfc5075f0…）
2. revision 持久化（bundleRevision=1）
3. 相同内容复用同一 revision（append-only，无原地变更）
4. session 写入绑定（courseBundleRevisionId / bundleRuntimeReleaseId / bundleDigest 一致）
5. plan 标题改名不移动 bound session 参与者路由（仍为 unit-1-1-see-the-full-picture/teacher/…）
6. 媒体对象逐资源记录（mediaObjects=4）
7. 基线 lesson.json hash 与捕获一致
8. 学生页对 bound session 渲染 200（无 drift）
9. runtime 内容漂移（lesson.json 字节变化）→ bound session fail closed（data-course-bundle-drift 状态页）
10. 内容恢复后 bound session 恢复正常渲染

说明：本地开发态无挂载 release manifest，"切换 active runtime release" 以等价的"runtime 内容字节变化"验证身份不变量与 fail-closed；release 定位行为另由单测覆盖（pinned assets URL、verify 漂移、unreleased-worktree 回退）。生成课件路径的发布修订相等性由既有 `resolveGeneratedCoursewareSessionBinding` 守卫与本 change 的 bundle 镜像单测覆盖。

清理：验收教师/教案/session 行已删除；CourseBundleRevision 记录保留（内容寻址、可复用）。
