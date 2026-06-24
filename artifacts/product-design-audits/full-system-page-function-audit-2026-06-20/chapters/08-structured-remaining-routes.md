# 结构化补采页面审计续篇

日期：2026-06-20
范围：公开认证页、Arena、互动学习通用页、资源实例、播放列表、知识图谱、遗留教师学生路由、Arena 发布报告。
截图证据：`screenshots/32-structured-public-auth-routes/`、`screenshots/33-interactive-generic-resource-arena-routes/`、`screenshots/34-teacher-legacy-student-redirects/`、`screenshots/35-teacher-arena-publication-report/`。
采集清单：`screenshots/structured-remaining-routes-manifest.json`、`screenshots/teacher-arena-publication-report-manifest.json`。

## 1. 覆盖范围

本轮新增 50 张截图：48 张来自结构化剩余路线补采，2 张来自教师 Arena 发布报告页补采。按 `route-inventory.md` 的 205 个 App Router 页面模板核对后，当前页面模板截图证据缺口为 0。

有效样本：

- 访客：`/`、`/login`、`/register`。
- 学生账号：Arena、知识图谱、互动学习通用页、资源详情、播放列表播放页、`/data-center` 跳转。
- 教师拥有者账号 `201300000012`：遗留学生诊断/证据路由、Arena 发布报告页。

审计夹具说明：

- 当前数据库没有自然存在的 `ArenaChallengePublication` 记录。为覆盖 `/teacher/arena/publications/[publicationId]`，本轮创建本地审计记录 `audit-publication-full-system-2026-06-20`，其 `config.auditFixture=true`，仅用于打开报告页并截取证据。

## 2. 公开入口与认证页

证据：

- `screenshots/32-structured-public-auth-routes/desktop-home.png`
- `screenshots/32-structured-public-auth-routes/desktop-login.png`
- `screenshots/32-structured-public-auth-routes/desktop-register.png`

健康度：中等偏好。

观察：

- 首页、登录和注册均返回 200，桌面和移动端没有 4xx 子请求。
- 登录页继续承担“角色驾驶舱入口”的解释功能。
- 注册页作为独立入口可访问，没有空白或服务器错误。

问题：

- P2：登录页在无回调参数时仍展示“未指定回调目标”；从受保护页面跳转登录时，用户仍然缺少返回目标确认。
- P2：移动端全局浮动工具在登录和注册周边页面继续挤占底部解释内容。

建议：

- 登录页根据来源展示“登录后返回”的明确目标。
- 认证页移动端为浮动工具预留底部避让距离，避免遮挡意图卡和辅助入口。

## 3. Arena 与通用互动页

证据：

- `screenshots/33-interactive-generic-resource-arena-routes/desktop-arena.png`
- `screenshots/33-interactive-generic-resource-arena-routes/desktop-arena-challenges-task-second-order-lead-pid.png`
- `screenshots/33-interactive-generic-resource-arena-routes/desktop-interactive-learning-control-workbench.png`
- `screenshots/33-interactive-generic-resource-arena-routes/desktop-interactive-learning-pid-simulator.png`

健康度：中等。

观察：

- `/arena` 与挑战详情代表路由桌面/移动均返回 200。
- 控制工作台、PID 仿真、Ten Drops、跨域探索、多表征联动、控制地图、控制航程等通用互动页均可打开。
- 通用互动页整体仍沿用平台 shell 与右下控灵入口，用户从学习页进入后不会遇到空白页。

问题：

- P2：Arena 和工作台页入口密度高，移动端首屏更像工具目录，学生难以快速判断“现在应该提交、练习、看榜还是进入工作台”。
- P2：多个旧式互动页的局部 UI 仍保留独立资源外观，与新 AppShell 的导航语言不完全一致。

建议：

- Arena 首屏增加面向学生的下一步分流：继续挑战、查看我的提交、进入工作台、看榜单。
- 通用互动页逐步统一“任务目标、当前状态、下一步动作”的顶部模式，减少工具型页面的孤立感。

## 4. 资源实例、讲义打印与旧别名

证据：

- `screenshots/33-interactive-generic-resource-arena-routes/desktop-interactive-learning-resources-lesson07-pole-manipulator.png`
- `screenshots/33-interactive-generic-resource-arena-routes/desktop-interactive-learning-resources-control-odyssey-v1-ship.png`
- `screenshots/33-interactive-generic-resource-arena-routes/desktop-interactive-learning-lessons-1-2-handout-print.png`
- `screenshots/33-interactive-generic-resource-arena-routes/desktop-interactive-learning-physics-modeling.png`

健康度：中等。

观察：

- 真实 `TeachingResource.id` 路由可打开；资源详情不再依赖 registry-only id。
- 讲义打印页返回 200，适合作为导出/打印辅助面。
- `/interactive-learning/physics-modeling` 会跳转到 `/interactive-learning`，属于旧别名保留。

问题：

- P2：资源详情页面和课程主入口之间的返回关系仍不够明确，用户从资源页退出时不一定知道回到课程、资源中心还是路径中心。
- P2：`physics-modeling` 旧别名直接回到互动学习总入口，没有解释该内容已经迁移到哪类课程或资源。

建议：

- 资源详情顶部保留来源上下文：来自课程、路径规划、Arena 任务或资源中心。
- 对旧别名提供轻量迁移提示，避免用户把跳转误认为内容丢失。

## 5. 播放列表播放页

证据：

- `screenshots/33-interactive-generic-resource-arena-routes/desktop-playlists-cmkaxvc11000n11d46jntz6nf-play.png`
- `screenshots/33-interactive-generic-resource-arena-routes/mobile-playlists-cmkaxvc11000n11d46jntz6nf-play.png`

健康度：偏弱。

观察：

- `/playlists/cmkaxvc11000n11d46jntz6nf/play` 返回 200，但最终落到 `/`。
- 学生从播放列表意图进入时，没有看到播放、课程或教案上下文。

问题：

- P1：播放列表播放页丢失用户意图。用户点击“播放/开始”后回到首页，会判断为入口失效或权限错误。

建议：

- 播放列表播放页需要保留目标上下文：若无权限或缺少可播放项目，应展示受控空态；若是旧数据，应给出迁移后的课程入口。
- 不应把播放意图静默重定向到首页。

## 6. 数据中心与遗留教师学生路由

证据：

- `screenshots/33-interactive-generic-resource-arena-routes/desktop-data-center.png`
- `screenshots/34-teacher-legacy-student-redirects/desktop-teacher-students-cmma7hgid0079g9q21lqtxv52-diagnosis.png`
- `screenshots/34-teacher-legacy-student-redirects/desktop-teacher-students-cmma7hgid0079g9q21lqtxv52-evidence.png`

健康度：良好。

观察：

- 学生访问 `/data-center` 会进入 `/profile/evidence`，符合“学生证据复盘不再使用运营数据中心”的方向。
- 旧 `/teacher/students/[studentId]/diagnosis` 与 `/teacher/students/[studentId]/evidence` 会跳转到班级范围内的学生详情/证据页。

问题：

- P2：旧教师学生路由跳转成功，但页面没有提示“已进入班级范围视图”；对收藏旧链接的教师来说，信息架构变化不可见。

建议：

- 在班级范围学生页顶部保留来源感知提示，说明旧学生直达链接已合并到班级学生视图。

## 7. 教师 Arena 发布报告

证据：

- `screenshots/35-teacher-arena-publication-report/teacher-arena-publication-report-desktop.png`
- `screenshots/35-teacher-arena-publication-report/teacher-arena-publication-report-mobile.png`

健康度：中等。

观察：

- 教师拥有者账号可打开 `/teacher/arena/publications/audit-publication-full-system-2026-06-20`，桌面/移动均返回 200，没有 4xx 子请求。
- 报告页能展示参与情况、提交次数、平均分、优秀方案、硬约束失败、薄弱指标、方法分布、未提交学生、个人最佳和课堂复盘。
- 空数据状态有文案，不会表现为空白。

问题：

- P2：页面标题直接显示 `task-second-order-lead-pid`，教师更需要任务中文名和班级名称。
- P2：移动端顶部教师导航、用户菜单和报告标题堆叠，占据较多首屏；关键指标需要滚动后逐张查看。
- P2：报告页依赖发布记录存在。当前本地库无自然发布记录，说明真实教师流程还需要从“配置发布”进入报告页继续做提交后状态审计。

建议：

- 报告页用任务中文名、班级名和截止状态作为主标题信息，技术 id 放到辅助行。
- 移动端将四个指标压缩为 2 列或摘要条，让教师首屏能看到参与、提交、平均分和优秀方案。
- 后续从教师 Arena 配置页发起一次真实发布、学生提交、教师复盘，补齐“有数据报告”状态。

## 8. 本轮结论

- 页面模板级截图覆盖已补齐：`route-inventory.md` 205 个页面模板均有当前审计证据或对应动态实例证据。
- 仍不能声明“每个功能状态完成”：表单提交、批量操作、配置保存、真实 Arena 发布后提交数据、键盘可达性和读屏语义仍需要交互态验证。
- 当前最高优先级新增问题是播放列表播放页静默回首页；这是用户意图被中断的问题，优先级高于一般视觉整理。
