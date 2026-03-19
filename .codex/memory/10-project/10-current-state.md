# 当前状态

状态: active
最后更新: 2026-03-19
摘要: 记录项目当前的重要现状，帮助跨会话快速回答“现在做到哪里了、最近重点在哪”，并提醒最近刚收敛的教师端学情入口、学生端个人中心六维画像收口与本地启动链路变化。
上游:
- [00-overview.md](/Users/YW/Documents/Site/act.just.edu.cn/.codex/memory/10-project/00-overview.md)
下游:
- [20-roadmap.md](/Users/YW/Documents/Site/act.just.edu.cn/.codex/memory/10-project/20-roadmap.md)
相关:
- [docs/ProjectDescription.md](/Users/YW/Documents/Site/act.just.edu.cn/docs/ProjectDescription.md)
- [../30-operations/50-known-deploy-risks.md](/Users/YW/Documents/Site/act.just.edu.cn/.codex/memory/30-operations/50-known-deploy-risks.md)

## 当前高优先级现状

- 统一课程框架已明确为 DB BOPPPS + `TeachingResource/registry` + `ClassSession`
- 多门精品课程已接入独立入口与教师/学生双端课堂页，包括 L-2a、L-2b、L-2c、L-2d、L-sum 等
- 运行时课程资源已转为镜像外置部署，远端通过 `rsync` 同步 `course-content/runtime`
- 容器启动阶段默认执行 Prisma 迁移，但真实线上仍需警惕迁移状态与实际表结构漂移

## 最近值得记住的变化

- 学生个人中心 `/profile` 已不再使用旧的五维仿真雷达或课外展示补强卡口径，而是统一消费数据治理六维能力快照；姓名下显示学号，页面只保留学生态信息，不再显示“学生”角色文案
- 学生个人中心的最近活动已经改为真实聚合：来源包括 `StudentState/ClassSession` 的课堂加入记录、`InteractionLog` 的互动/知识卡/跨域探索行为、`SimulationLog` 的仿真记录，以及 `LearningFact(question)` 的题目与自适应练习记录
- 个性化补强路径已接入 `generateRecommendations(userId)` 与自适应习题诊断摘要；个人中心现在直接展示资源推荐卡和 `/assessment/adaptive-practice` 的继续练习入口
- 成长中枢 `/profile/growth` 所依赖的 `/api/student/competency-snapshot` 已对重复 `StudentRiskFlag` 和重复建议做接口层去重，因此 UI 中“学习活跃度低/增加学习活跃度”类重复卡片已明显收敛
- 教师端班级链路已重构为“教师首页/班级页 -> 班级学情总览 -> 学生个体学情”模式；不再把教师引向独立的数据治理入口或无上下文的 `analytics-v2` 坏路由
- 教师端新增聚合接口 `/api/teacher/classes/[classId]/insights` 与 `/api/teacher/classes/[classId]/students/[studentId]/insights`，班级页、班级学情页与学生详情页已改为直接消费治理产物
- `src/app/api/teacher/classes/[classId]/heatmap/route.ts` 已修复；此前会因原生 SQL 错把 Prisma 驼峰列名写成下划线列名而返回 500
- 本地 `startup/shutdown` 脚本已补上“按端口释放前端残留进程 + 记录真实监听 PID”的兜底逻辑；启动脚本不再只依赖 pid 文件去杀 `npm` 父进程
- 管理员后台已经改为“统一入口 + 三个子路由”结构：`/admin` 为管理总台，`/admin/users` 负责账号管理，`/admin/states` 负责使用量统计，`/admin/data-governance` 负责数据治理看板
- 用户管理页已统一接入后台全局视觉样式，浅色模式下不再保留深色硬编码表格与容器
- 系统使用量统计真实数据入口为 `/api/admin/system-usage`，与演示数据共用同一前端面板
- 数据治理页已经中文化，并下钻到事实分布、队列健康、风险清单与快照明细，不再只是基础计数
- `PlatformSetting` 已被纳入平台级开关体系，首页动态模型渲染可后台切换
- 远端部署链路新增 `scripts/remote-deploy.sh`，并带有 Prisma 失败迁移自愈逻辑
- 会话同步已经从部分精品课程打通到真实 `/api/session` 与 `/api/session/[id]/state` 链路
- 数据治理事件归一化链路已收口，课堂内的 `lesson_submit` 等事件现在可以通过 worker 或回放脚本沉淀到 `LearningFact`
- 本地已形成“远端数据库全量替换开发数据库”的确定性脚本流程，默认入口是 `scripts/db/sync-remote-db-to-local.sh`

## 当前主要风险

- 旧前端 chunk 与新后端同时存在时，浏览器可能出现与当前源码不一致的报错
- 教师端学生学情页会直接暴露治理层历史风险记录；如果本地数据里存在重复未解决风险，会在 UI 上形成大量重复卡片，当前已通过接口去重为摘要态，但排障时仍应先确认数据是否异常膨胀
- 数据库迁移元数据和实际 schema 可能短时不一致，导致 Prisma 缺表类故障
- 会话类页面既依赖公开 session 读取，也依赖受保护的 state 接口，排障时必须区分两者
- 数据治理链路目前只确认了事件批次和学生快照在持续产生，班级快照仍明显偏少，不能假设远端班级画像调度已经稳定
