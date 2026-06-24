# Profile、Review 与仿真深层页面审计续篇

日期：2026-06-20
范围：学生个人中心子页、内部 review 子页、仿真详情全集与 `/virtual-lab` 兼容入口。
截图证据：`screenshots/20-auth-student-profile/`、`screenshots/21-review-pages/`、`screenshots/22-simulation-details/`。
采集清单：`screenshots/deep-route-capture-manifest.json`。

## 1. 覆盖范围

本轮新增 21 个页面的桌面与移动首屏截图，共 42 张。

- 学生 profile：`/profile`、`/profile/evidence`、`/profile/growth`、`/profile/portfolio`。
- 内部 review：`/review` 与 8 个 review 子页面。
- 仿真详情：`/simulations/container`、`/simulations/destroyer`、`/simulations/dredger`、`/simulations/drilling`、`/simulations/icebreaker`、`/simulations/lng`、`/simulations/cruise`。
- 兼容入口：`/virtual-lab`，实际重定向到 `/simulations`。

## 2. 学生个人中心与证据页面

路径：`/profile`、`/profile/evidence`、`/profile/growth`、`/profile/portfolio`
证据：

- `screenshots/20-auth-student-profile/desktop-profile.png`
- `screenshots/20-auth-student-profile/mobile-profile.png`
- `screenshots/20-auth-student-profile/desktop-profile-evidence.png`
- `screenshots/20-auth-student-profile/mobile-profile-evidence.png`
- `screenshots/20-auth-student-profile/desktop-profile-growth.png`
- `screenshots/20-auth-student-profile/mobile-profile-growth.png`

健康度：中等。

观察：

- 个人中心子页整体保留学生身份、驾驶舱/个人中心分段、筛选与记录列表，信息结构连续。
- `/profile/evidence` 能显示来源质量、时间线和隐私范围，方向符合学习证据复盘需求。
- `/profile/growth` 与 `/profile/portfolio` 能承接成绩、成长与作品集语义。

问题：

- P1：移动端 `/profile/evidence` 首屏几乎被筛选卡占满，证据列表第一条被底部控灵/工具浮层遮挡。证据复盘页面最关键的信息是“最近发生了什么”，不应被筛选器优先占据。
- P2：筛选项中的课次值被截断为 `unit-5-2...`，学生难以确认当前过滤条件。
- P2：profile 子页仍然只用“学生驾驶舱 / 个人中心”两个 tab 区分大类，证据、成长、作品集之间的当前页提示不够强。

建议：

- 移动端 evidence 首屏应先显示一条最近证据摘要，再展开筛选。
- 筛选器可默认折叠，只保留当前条件 chips 和“筛选”按钮。
- profile 子页需要二级 tabs 或面包屑，明确“证据 / 成长 / 作品集”的当前位置。

## 3. 内部 Review 页面

路径：`/review` 与 8 个 review 子页面
证据：

- `screenshots/21-review-pages/desktop-review.png`
- `screenshots/21-review-pages/mobile-review.png`
- `screenshots/21-review-pages/mobile-review-visual-stage-runtime-561.png`
- `screenshots/21-review-pages/mobile-review-structure-diagram-runtime-563.png`
- `screenshots/21-review-pages/mobile-review-annotated-media-activity-564.png`
- `screenshots/21-review-pages/mobile-review-unit-5-2-arrow-markers.png`

健康度：中等；作为内部验收页可用，但不宜暴露为学生主体验。

观察：

- review hub 能聚合已合并或待验收页面，适合开发人员进入。
- 多个 review 子页能在移动端渲染，说明内部验收面并非桌面专用。
- 视觉舞台、结构图、标注媒体等页面保留了当前步骤和验收对象说明。

问题：

- P1：`/review/visual-stage-runtime-561` 移动端公式卡出现明显裁剪，`T = G/(1 + GH)` 的下缘被容器截断。若 review 页面用于视觉验收，它自身不能产生视觉误判。
- P2：review 页面缺少内部用途标识和非学生链路隔离，登录学生也可看到 review hub。
- P2：多个 review 子页移动端留白与卡片高度不稳定，不能直接作为“移动端已验收”的证明。

建议：

- review 子页应明确标记“内部验收页”，避免进入学生导航语义。
- 公式和结构图验收页应把移动端作为受支持 viewport，修复公式裁剪、卡片高度和底部浮层避让。
- review hub 可按状态分组：待验收、已合并、仅保留历史证据。

## 4. 仿真详情全集与 Virtual Lab

路径：7 个 `/simulations/*` 详情页与 `/virtual-lab`
证据：

- `screenshots/22-simulation-details/desktop-simulations-container.png`
- `screenshots/22-simulation-details/mobile-simulations-container.png`
- `screenshots/22-simulation-details/desktop-simulations-destroyer.png`
- `screenshots/22-simulation-details/mobile-simulations-destroyer.png`
- `screenshots/22-simulation-details/desktop-simulations-cruise.png`
- `screenshots/22-simulation-details/mobile-simulations-cruise.png`
- `screenshots/22-simulation-details/mobile-virtual-lab.png`

健康度：中等偏好。

观察：

- 七个仿真详情页都能返回 200，移动端也能显示全局导航、场景画布、视角按钮和任务说明。
- `/virtual-lab` 是兼容入口，实际重定向到 `/simulations`，没有形成第二套仿真实验室页面。
- 邮轮、破冰船、LNG 等页面首屏有对象名称、控制主题和操作提示，仿真对象识别度较强。

问题：

- P1：移动端仿真详情页的全局导航和局部工具同时展开，`/simulations/cruise` 首屏中工具按钮覆盖在导航区域，底部控灵覆盖仿真底部工具条。
- P1：WebGL 场景首屏和下方说明卡缺少稳定安全区；底部相机/倍率工具与全局浮层发生冲突。
- P2：`/virtual-lab` 重定向到 `/simulations` 是合理兼容策略，但页面和报告中需要明确它不是独立功能区，避免审计重复计数。
- P2：仿真详情页移动端第一屏可见对象，但学习任务、参数调节和数据观察的优先级仍被导航高度稀释。

建议：

- 仿真详情页在移动端应默认折叠全局导航，只保留返回、当前对象、主要任务和必要视角工具。
- WebGL 工具条需要声明全局 floating dock safe area，或者在仿真详情页隐藏/合并全局控灵入口。
- `/virtual-lab` 应在 route inventory 中标记为兼容重定向入口，不作为独立体验评分。

## 5. 横向更新

1. P1：学生证据页、review 验收页、仿真详情页均证明移动端全局浮层问题跨越公开、认证、内部与 WebGL 场景。
2. P1：review 子页不能替代真实视觉验收；它们自身也需要移动端布局质量门槛。
3. P2：深层页面普遍存在“筛选/导航先于任务”的倾向，尤其是 profile evidence 与仿真详情。
4. P2：兼容重定向入口应在报告中单独标注，避免把 `/virtual-lab` 误判为缺失页面。
