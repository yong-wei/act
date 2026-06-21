# 认证态角色流程审计续篇

日期：2026-06-20
基线：`dev1` 对齐 `origin/integration`
范围：学生、教师、管理员登录后的主入口与高频后台页面。
截图证据：`screenshots/17-auth-student/`、`screenshots/18-auth-teacher/`、`screenshots/19-auth-admin/`。
采集清单：`screenshots/authenticated-capture-manifest.json`。

## 1. 采集说明

固定账号密码已经通过 `npm run seed:fixed-passwords` 刷新，本轮使用真实 NextAuth 登录态采集。

覆盖页面：

- 学生：`/dashboard`、`/interactive-learning`、`/interactive-learning/courses`、`/assessment/adaptive-practice`、`/review`。
- 教师：`/teacher`、`/teacher/classes`、`/teacher/lesson-plans`、`/teacher/resources`、`/teacher/resources/resource-nodes`、`/teacher/prep-packs`、`/teacher/arena`、`/teacher/history`。
- 管理员：`/admin`、`/admin/users`、`/admin/states`、`/admin/config`、`/admin/data-governance`、`/admin/lesson-plans`。

每个页面均采集桌面 1440x1000 与移动 390x844 首屏，共 38 张认证态截图。

## 2. 学生登录后主链路

路径：`/dashboard`、`/interactive-learning`、`/interactive-learning/courses`、`/assessment/adaptive-practice`、`/review`
证据：

- `screenshots/17-auth-student/desktop-dashboard.png`
- `screenshots/17-auth-student/mobile-dashboard.png`
- `screenshots/17-auth-student/desktop-interactive-learning.png`
- `screenshots/17-auth-student/mobile-interactive-learning.png`
- `screenshots/17-auth-student/desktop-assessment-adaptive-practice.png`
- `screenshots/17-auth-student/mobile-assessment-adaptive-practice.png`

健康度：中等偏好。

观察：

- `/dashboard` 已经从“通用入口”进化为学习者驾驶舱，首屏能回答当前路径、证据置信、缺失来源与下一步动作。
- 学生登录后进入互动学习和课程目录时，角色标签、当前项高亮和学习意图基本连续。
- `/assessment/adaptive-practice` 的首屏能解释为什么当前建议是入门路径，也有“查看学习证据”出口。

问题：

- P1：移动端底部同时出现控灵与另一个圆形工具入口，学生驾驶舱、课程目录、学习路径中心均存在内容下缘被浮动层遮挡的风险。
- P2：学生驾驶舱的“缺失来源”文案偏系统诊断口吻，学生知道缺 Arena/自适应证据，但不知道应先点哪个入口补齐。
- P2：`/review` 对登录学生仍是内部审查聚合入口，缺少“这是内部评审面”的明确边界；从学生主链路进入时容易误解为学习复盘。
- P2：`/assessment/adaptive-practice` 运行时日志出现 `GET /api/adaptive/learner-state?goal=control-correction 503` 与 `path-advisor-context 403`，页面有降级展示，但首屏没有把“生成能力暂不可用”转化为学生可执行动作。

建议：

- 学生驾驶舱应把“缺失来源”改为可点击任务，例如“完成一次 Arena 基础挑战”“做一次自适应诊断”。
- 移动端统一浮动层 safe area；学生主链路优先保证继续学习按钮、证据时间线和筛选控件不被覆盖。
- `/review` 应从学生导航中隔离，或在页面首屏标明内部审查用途。
- 自适应学习路径中心应把接口降级转换为显式状态：当前无法生成路径时保留离线路径和重试入口。

## 3. 教师登录后工作流

路径：`/teacher`、`/teacher/classes`、`/teacher/lesson-plans`、`/teacher/resources`、`/teacher/resources/resource-nodes`、`/teacher/prep-packs`、`/teacher/arena`、`/teacher/history`
证据：

- `screenshots/18-auth-teacher/desktop-teacher.png`
- `screenshots/18-auth-teacher/mobile-teacher.png`
- `screenshots/18-auth-teacher/desktop-teacher-resources-resource-nodes.png`
- `screenshots/18-auth-teacher/mobile-teacher-resources-resource-nodes.png`
- `screenshots/18-auth-teacher/desktop-teacher-prep-packs.png`
- `screenshots/18-auth-teacher/mobile-teacher-prep-packs.png`

健康度：中等；存在一个阻断级问题。

观察：

- 教师首页首屏聚焦当前课堂、备课动作、证据与学生、历史报告，符合教师“继续课堂 -> 备课 -> 复盘”的高频顺序。
- 班级、教案、资源、历史页面都能在真实教师登录态下返回 200。
- ResourceNode 管理页面的信息密度合理，资源总数、映射、规划资格、阻断和告警能够支撑教师判断资源治理状态。

问题：

- P0：`/teacher/prep-packs` 桌面和移动均返回 500。开发日志显示 `CourseEnhancementPack` 表不存在，`src/app/teacher/prep-packs/page.tsx:44` 的 `prisma.courseEnhancementPack.findFirst()` 触发 Prisma `P2021`。这是教师备课包核心入口不可达，不应归为普通视觉缺陷。
  - 整改状态（2026-06-21，`audit-remediation-p0-stability`）：已修复。缺表或无候选包时进入课前包复核空态/恢复态，不返回 500；证据见 `../remediation/audit-remediation-p0-stability/evidence.md`。
- P1：教师移动端顶部导航横向堆叠，`/teacher/resources/resource-nodes` 首屏已经压到筛选区域；底部控灵浮层还会覆盖筛选控件。
- P2：教师首页的“当前课堂”“备课动作”“证据与学生”方向正确，但卡片间的下一步优先级仍不够强，教师不容易判断当前最紧急动作。
- P2：`/teacher/lesson-plans` 列表中重复的 1-2 副本占据首屏，缺少去重、状态分组或最近使用标记。

建议：

- 立即修复 `/teacher/prep-packs` 的迁移/兼容空态：缺表时应显示受控降级或在本地基线补齐迁移，不能让教师核心入口进入 Next 错误覆盖层。
- 教师端移动导航应采用抽屉或折叠菜单，把当前页面主任务留在首屏。
- 教师首页增加“今日优先处理”排序：进行中课堂、待发布课前包、待审核学生证据、待归档课堂。
- 教案列表增加状态过滤、最近使用和重复副本收敛。

## 4. 管理员登录后治理链路

路径：`/admin`、`/admin/users`、`/admin/states`、`/admin/config`、`/admin/data-governance`、`/admin/lesson-plans`
证据：

- `screenshots/19-auth-admin/desktop-admin.png`
- `screenshots/19-auth-admin/mobile-admin.png`
- `screenshots/19-auth-admin/desktop-admin-data-governance.png`
- `screenshots/19-auth-admin/mobile-admin-data-governance.png`
- `screenshots/19-auth-admin/desktop-admin-lesson-plans.png`
- `screenshots/19-auth-admin/mobile-admin-lesson-plans.png`

健康度：良好，局部存在运行态告警。

观察：

- 管理首页把用户管理、使用量统计、数据治理、系统配置拆成稳定通道，符合管理员“看总览 -> 查风险 -> 处理治理 -> 调配置”的顺序。
- `/admin/data-governance` 移动端首屏层级清楚，标题、更新时间、刷新状态和用户身份都可见。
- `/admin/users` 与 `/admin/config` 的操作入口明确，后台语义比学生/教师侧更稳定。

问题：

- P1：`/admin/states` 在开发日志中多次出现 Recharts 容器宽高 `-1` 警告，说明统计图在某些布局阶段没有稳定尺寸；这会影响真实数据图表可信度。
- P2：`/admin/data-governance` 依赖 Redis 队列状态，日志出现 `Redis Connection closed` 和队列统计降级；页面返回 200，但需要首屏明确区分“系统正常”和“队列统计不可用”。
- P2：`/admin/lesson-plans` 没有继承管理员后台的统一顶部导航，移动端第三张卡片标题被底部浮动控件覆盖，后台一致性弱于 `/admin/data-governance`。

建议：

- 后台图表组件需要固定容器高度、最小宽度和加载骨架，避免 Recharts 在首屏布局阶段报无效尺寸。
- 数据治理页应把队列连接失败作为明确子状态显示，而不是仅在日志中可见。
- 管理员教案页应接入统一后台壳层，至少保留返回管理后台、当前身份、四条后台通道和移动端底部避让。

## 5. 横向更新

1. P0：教师课前包入口不可达。
   这是本轮最严重问题，直接阻断教师备课包工作流。
   整改状态（2026-06-21，`audit-remediation-p0-stability`）：已修复入口 500 阻断，证据见 `../remediation/audit-remediation-p0-stability/evidence.md`。

2. P1：移动端浮动层问题从公开页扩展到认证态。
   学生、教师、管理员页面均能看到底部控灵/工具入口覆盖首屏内容或操作控件。

3. P1：教师端移动导航密度过高。
   教师页面首屏被“返回首页、教师工作台、个人中心、一级导航”占用，真正工作对象下移。

4. P2：后台治理页质量明显高于教师资源页和学生任务页。
   说明系统已有较成熟的信息架构样式，但没有统一复用到全部角色。

5. P2：认证态可用性不能只看 HTTP 200。
   `/assessment/adaptive-practice`、`/admin/data-governance`、`/admin/states` 都有运行态降级或布局告警，需要把可见状态和日志状态合并审计。
