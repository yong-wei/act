# AI-OBE 船舶智控平台 - 项目说明

## 1. 项目愿景

AI-OBE (Artificial Intelligence - Outcome Based Education) 船舶智控平台是一个结合了**工程教育认证 (OBE)** 理念与**人工智能辅助教学**的综合性教育平台。本项目旨在通过高保真的虚拟仿真、个性化的 AI 学习路径以及伦理意识的培养，解决传统船舶控制工程教育中理论与实践脱节、伦理教育缺失等痛点。

## 2. 项目状态

✅ **开发阶段**：主要功能已完成，系统可用于教学实践
📅 **最后更新**：2026-03-19
🛠️ **课堂服务与导航回补（2026-03-19）**：按 `docs/server_optimize.md` 与 `docs/plans/nevplan.md` 重新校正课堂链路和导航统一方案；学生端课堂会话默认关闭 SSE，去除“实时连接失败，已降级到轮询模式”页面提示，修正 Redis 发布/订阅频道不一致问题，并进一步收窄 `student-view` 查询与 `/api/session/[sessionId]` Redis 快路径返回；L-2a/L-2b/L-2c/L-2d/L-sum 的互动提交补齐“提交成功”常驻提示与锁定逻辑，L-sum 第 10 页按钮文案改为“打开控灵助手”且页内控灵头像在消息气泡中恢复显示；知识图谱、评审入口、互动学习、互动课程、跨域探索、章节组件与 Lesson-02 页面重新接入 `UnifiedTopBar`，控灵浮动按钮位置下调；本地 `startup/shutdown` 同步纳入 Redis、`worker:dev` 与 `worker:scheduler`
🔧 **L-sum课程演示模式与教师页面错误修复（2026-03-18）**：修复 L-sum 课程演示模式 "Maximum update depth exceeded" 无限渲染错误（`step-panels.tsx` 使用 `useMemo` 缓存 `getStepActivity` 返回值）；修复教师页面不显示课堂码问题（显式构建包含 `joinCode` 的 session 对象）；优化课堂同步轮询错误处理（`use-session-progress-channel.ts` 添加错误退避、状态合并更新、5秒暂停机制，防止多轮询竞争导致的抖动和 fetch 失败）
🗃️ **数据治理系统（2026-03-18）**：新增数据治理核心模块（competency-engine, risk-detector, event-buffer），实现学生六维能力画像计算、风险学生检测、学习事实追踪；配套新增学生成长追踪页面（`/profile/growth`, `/profile/portfolio`）、教师分析 v2（`/teacher/classes/[classId]/analytics-v2`）、学生诊断（`/teacher/students/[studentId]/diagnosis`）及相关 API；管理员统计面板支持演示/真实数据切换；新增 vitest 单元测试配置与数据治理模块测试套件
🔧 **L-2d课堂服务稳定性整改（2026-03-18）**：针对L-2d课程期间出现的服务不稳定问题（数据库连接池耗尽、外键错误、页面回跳），实施P0级紧急整改：
- 调整Prisma连接池配置（limit=3→10, timeout=10s→20s）
- 修复InteractionLog外键错误，添加resourceId格式校验与降级处理
- 修复教师端页面回跳，实现基于时间戳的版本控制机制
- 添加sharp库解决图片处理警告
- 详见部署指南：`docs/L2D-STABILIZATION-DEPLOY.md`
🧠 **长期记忆骨架（2026-03-17）**：新增 `.codex/memory/` 分层长期记忆目录，按“项目总览 / 架构 / 运维 / 业务域 / 决策 / 事故 / 工作流 / 归档”组织跨会话知识，作为 `AGENTS.md` 规则与 `docs/ProjectDescription.md` 阶段进展之外的第三层项目记忆
🧩 **整改进展**：统一课程框架已确立为 DB BOPPPS 教案 + TeachingResource/registry + 互动埋点主链路（规范见 `docs/Unified_Lesson_Framework.md`），课次整改与预置教案对齐中；统一仿真内核（固定步长时钟 + Tustin 离散化 + 非线性积分器）覆盖 Control Odyssey 与虚拟仿真，Control Odyssey 关卡扩展至 15 关；仿真规范说明见 `docs/Simulation_Guidelines.md`
⚡ **首页与仿真加载优化（2026-03-02）**：首页船模改为“截图优先 + 3D 后台懒加载”，移除首屏一次性预加载全部 7 个 GLB（约 125MB）策略，改为按轮播仅预热“当前 + 下一”模型；仿真页改为“场景先渲染、船模独立 Suspense 加载”，在船模解析期间显示“模型加载中”占位动画，避免黑屏等待
🧰 **首页模型策略开关（2026-03-03）**：新增平台级配置 `PlatformSetting` 与管理接口 `/api/admin/platform-settings`、公开读取接口 `/api/platform/settings`；管理员可在 `/admin/config` 切换“首页动态模型渲染”，首页根据开关在静态截图与动态 3D 预览间切换
📉 **弱网与并发降载（2026-03-03）**：首页仿真入口与学生高频入口关闭仿真路由预取，船模预加载改为串行队列，并在 `saveData/2g/3g` 网络下自动静态回退；模型加载失败时自动重试并回落静态图
🧪 **邮轮仿真教学标定（2026-03-02）**：重构邮轮舒适度评估模型（横摇 + 横向加速度 + 转艏角速度耦合），并引入“满舵转向横倾激励”，使海况等级、波向、减摇鳍与陷波滤波器开关在状态监控与舒适度评级中具备显著可感知差异；同时新增单次仿真校验时长（180s）与到时自动结束机制，结束后锁定评估参数用于一次性一致性校验
🐘 **容器运行时兼容修复（2026-03-02）**：`prisma/schema.prisma` 增加 `binaryTargets = [\"native\", \"linux-musl\"]`，并将构建脚本调整为 `prisma generate && next build`，解决 Podman/Alpine 环境下 `linux-musl` Query Engine 缺失导致的课外展示页加载失败
🧱 **容器自动迁移（2026-03-04）**：镜像新增 `docker-entrypoint.sh`，容器启动时默认执行 `prisma migrate deploy`（可通过 `RUN_MIGRATIONS_ON_START=0` 关闭），并将 `prisma/migrations`、`@prisma`、`prisma` CLI 一并打包进运行镜像，避免部署后出现 `PlatformSetting` 等缺表问题
📊 **管理员统计页（2026-03-05）**：新增 ` /admin/states ` 静态统计面板（全量模拟数据），按教师 18 人、学生 1890 人规模展示互动类型拆分、7类仿真访问量、Control Odyssey 高访问量、月度访问趋势与完课率趋势图，支持管理后台直接跳转访问
🧭 **导航更新**：预置教案/教案新建与编辑/教学资源管理页面新增“返回教室工作台”入口（`http://localhost:3001/teacher`）；首页与认证导航新增“评审入口”（`/review`），汇总 DevelopmentPlan 用户备注对应的分支页面
📺 **课外展示班级落地（2026-03-01）**：演示学生数据并入 `2023自动化启航班`（30 人，`demo` 脱班保留账号），班级描述更新为“AI-OBE平台教改班”；课堂历史重建为 17 次（2025-03 至 2025-06 每周一节 + 当前展示课《柔性之海——豪华邮轮的舒适度控制》）；课堂记录详情页改为按当前课程 `course_review` 数据展示“课前/课后能力追踪 + 课后个性化补强路径”，柔性之海固定重点学生 `20230010102608/20230010102605`，其余课程重点学生按课次随机化
🛟 **仿真统一改造**：7 个船舶仿真统一为左侧监控、右侧“控制/评估/AI伴学”标签式面板，支持收起/展开与统一配色主题
🎥 **视角统一**：主视角统一为左舷后方约 45° 且默认跟随，统一相机距离与目标中心构图，跨仿真保持一致
🧩 **场景合并**：`/simulations/cruise-comfort` 与 `/simulations/icebreaker-robust` 能力合并入 `/simulations/cruise` 与 `/simulations/icebreaker` 主场景
🧠 **知识点同步**：启动脚本默认执行 `npm run seed:knowledge`，确保预置教案克隆所需 KnowledgeNode 已补齐
📘 **课程更新**：新增 Lesson 01「反馈：控制原理的核心思想」、Lesson 02「拉氏变换：工程直觉的数学实现」与 Lesson 05「方框图、信号流图与梅森公式」预置教案与互动学习入口，原 Lesson 02 建模课迁移为 Legacy；Lesson 03 预置教案与知识节点绑定已完成；新增 Lesson 16「非线性系统与描述函数基础」与 Lesson 17「描述函数分析法与自振判别」预置教案、互动学习入口与知识节点；新增 L-2a「三张面孔，同一系统 · 时域直觉速通」与 L-2b「根轨迹直觉速通 · 极点迁移的几何感知」两门精品互动课堂，按重构课程入口独立展示，其中 L-2b 已打通 `course-content/runtime` 运行时媒体链路与双端同步课堂页
🧾 **教案管理**：我的教案支持三点菜单删除并二次确认
🚀 **部署方式**：本地开发 + Docker 容器化部署
🚚 **远端部署脚本（2026-03-11）**：新增 `scripts/remote-deploy.sh`，在本机调用 `scripts/build.sh` 完成镜像构建后，自动上传 `deploy/images/act-obe.tar` 到服务器 `/home/projects/act/images/act-obe.tar`，执行远端 `/home/projects/act/scripts/0-one-key.sh`，并验证公网、数据库与 systemd/Podman 服务状态
🗂️ **课程内容目录迁移（2026-03-11）**：新增 `course-content/` 作为课程制作统一目录，采用 `authoring/` 与 `runtime/` 分层，沉淀 L-2a 课次设计稿、图谱增量、知识卡片、媒体目录骨架与面向 Claude 的迁移/闭环说明
🧠 **runtime 知识源接线（2026-03-13）**：新增 `course-content/scripts/export-runtime.sh` 导出链路，当前已完成 L-2b 试点：全局知识图谱改从 `course-content/runtime/knowledge/graph/{nodes.json,relations.jsonl}` 读取；`authoring/knowledge/cards/nodes/*.md` 与 `content/concepts/*.mdx` 会同步到 `course-content/runtime/knowledge/cards/`；L-2b 额外生成 `lesson.json`、`graph-overlay.json` 与 `handout.md`，为后续 L-2c 及新课次统一接入 runtime 奠定基础
🗺️ **L-2b 首页 runtime 导学（2026-03-13）**：L-2b 课程首页已接入 runtime lesson bundle，入口页可直接展示本课知识点网络、节点卡片正面与统一 `详情 / 概览` 视图、按 sequence 排列的知识卡片预览，以及支持 LaTeX/媒体渲染的讲义入口
🧾 **L-2b 首页二次收口（2026-03-13）**：按最新课程规范将教师入口/自由浏览/学生入口上移至首页最上方；知识点网络增加前置/后置箭头关系；讲义入口改为智能摘要并支持导出 PDF；学生页与教师页新增按 runtime 编排驱动的步骤知识卡抽屉，且仅在当前步骤存在知识卡时显示
🧩 **L-2b 知识卡统一框架（2026-03-13）**：首页节点卡片与步骤抽屉统一复用 `KnowledgeCard` runtime 分节渲染；`course-content/runtime/knowledge/cards/nodes/*.md` 只在概览态展示 `## 首页`，通过 `详情 / 概览` 切换到 `## 详情`，标题保持不变；非首页知识卡入口统一挂到页面标题模块右上角
🎨 **L-2b 主题框架收口（2026-03-13）**：L-2b 首页与课堂内页已统一切到精品课深浅主题语义类；深色模式下移除残留的深字深底与浅色突兀块，浅色模式保持原有高对比；同时新增 `test-l2b-theme-no-hardcoded-styles.ts`，明确禁止在课程模块继续新增 `dark:`、十六进制色和旧式色阶硬编码
🧾 **L-2b 讲义 PDF 服务端导出（2026-03-14）**：弃用首页讲义入口此前依赖 `window.print()` 的前端导出方式，新增 `/interactive-learning/lessons/[lessonId]/handout-print` 服务端讲义打印页与 `/api/course-runtime/lessons/[lessonId]/handout-pdf` 下载接口；当前由服务端使用 Playwright/Chromium 渲染 runtime 讲义并生成 PDF，前端仅负责触发下载，从而避免用户浏览器打印能力差异导致的空白页或无文件产出
📡 **L-2c 频域直觉课首轮落地（2026-03-14）**：新增 L-2c「频域直觉速通 · Bode图与相位裕度初识」精品互动课，完成 `course-content/authoring -> runtime` 导出、17 步课堂配置、首页 runtime 导学、页内 AI 助手、选择题/文本题教师汇总、步骤知识卡抽屉与教师/学生双端课堂页；同时将首页知识图/讲义/PDF 模块提炼为共享 `LessonEntryRuntimeSections`，供 L-2b/L-2c 统一复用，并补做浏览器级验收与共享知识卡链路的主题语义化收口，继续明确拒绝旧式颜色硬编码
🧪 **L-2d 三域联动实践课已接入验收链路（2026-03-14）**：`L-2d`「三域联动探索 · 平台操作初体验」现已完成 `practice-guide.md -> runtime/handout.md` 导出、14 步课堂配置、首页 runtime 导学、三面板联动工作区、任务一/二/三即时评分、步骤知识卡抽屉与教师/学生双端课堂页；同时补齐 `test-l2d-*` 定向验证脚本，并修复 runtime 导出测试在 ESM 执行下的路径兼容问题
🧭 **L-sum 设计可行域课同步闭环落地（2026-03-15）**：`L-sum`「设计可行域——让约束成为指南针」在正式课堂框架基础上，本轮继续接入真实 `/api/session` 会话读取与步骤推进、教师端 `teacher:course-sync` 广播、学生端 `student:lsum:state` 持久化、首次对齐/不同步提示、课堂结束态提示，并修复课程总入口的精品课程过滤链路，使 `L-sum` 正式出现在 `/interactive-learning/courses` 的精品课程区；同时新增 `tests/lsum-premium-course.spec.ts` 与 `tests/lsum-live-classroom-sync.spec.ts` 浏览器回归，覆盖课程总入口卡片、demo 学生端知识卡抽屉/页内 AI、以及真实教师/学生双账号创建课堂、加入课堂、不同步跳转、前测释放与答案揭示链路；入口路由测试 `tests/interactive-learning-entry-routes.spec.ts` 也同步改为更稳的 `href + direct goto` 校验，避免 Next 开发态并行编译导致的伪失败；当前 `test-lsum-runtime-export.ts`、`test-lsum-course-registration.ts`、`test-lsum-step-knowledge-drawer.ts`、`test-lsum-assessment-controls.ts`、`test-lsum-teacher-session-sync.ts`、`test-lsum-student-session-sync.ts`、`npm run lint`、`npm run test`、`npm run build`、`npm run test:integration` 均已通过
📦 **运行时资源外置部署（2026-03-12）**：`scripts/build.sh` 现在要求通过 `.dockerignore` 排除 `course-content/runtime`，镜像不再打包运行时课程资源；`scripts/remote-deploy.sh` 会使用 `rsync` 将本地 `course-content/runtime/` 同步到服务器 `/home/projects/act/course-content/runtime/`，并同步最新 `deploy/podman/deploy.sh` 到远端 `scripts/4-deploy.sh`，由 Podman 以只读挂载方式映射到容器内 `/app/course-content/runtime`

## 3. 核心功能模块

### 3.1 用户认证与管理 ✅
- **NextAuth.js 认证系统**：支持邮箱/用户名登录，JWT 会话管理
- **角色权限管理**：学生、教师、管理员三级权限体系
- **自动档案创建**：新用户自动创建学生档案和解锁第一关
- **账号安全**：个人中心支持修改密码与退出登录
- **演示账号**：
- 演示教师账号：`test_teacher`，密码：`TestTeacher@Just2026!`
- 演示学生账号：`demo`，密码：`DemoStudent@Just2026!`

### 3.2 驱逐舰航向控制仿真 ✅
- **3D 可视化**：基于 Three.js / React Three Fiber 的沉浸式体验
- **仿真模块化**：各虚拟仿真模块已完成组件化与资源注册，支持按模块独立加载与复用
- **Nomoto 船舶模型**：高保真物理模拟，支持自定义 K、T 参数
- **多种控制模式**：
  - 手动控制
  - P 控制器
  - PD 控制器
  - PID 控制器
- **多种视角**：追踪视角、俯视视角、战术视角
- **任务场景**：
  - 90° 直角转向
  - 绕圈航行
  - 避障机动
- **实时性能监控**：HUD 显示航向、偏航率、舵角、航迹误差
- **海况模拟**：5 级海况，动态风浪干扰

### 3.3 AI 虚拟总工 ✅
- **智能对话系统**：基于硅基流动 API + Qwen/Qwen3-Omni-30B-A3B-Thinking
- **Function Calling**：
  - `get_simulation_status` - 获取实时仿真状态
  - `set_simulation_params` - 修改 PID/环境参数
  - `analyze_result` - 分析仿真结果
- **PID 调参建议**：智能分析控制性能，提供优化建议
- **知识问答**：解答船舶动力学、PID 控制理论问题
- **流式响应**：使用 Vercel AI SDK 实现实时对话

### 3.4 伦理熔断系统 ✅
- **实时监控**：
  - 舵角速度限制：≤ 5°/s（CCS 规范）
  - 横摇角度限制：≤ 15°
- **全屏违规提示**：红色警告界面，强制暂停仿真
- **整改机制**：必须提交整改方案才能继续
- **伦理分扣减**：每次违规扣 5 分，最低 0 分
- **违规记录**：记录违规类型、阈值、实际值、AI 批评

### 3.5 任务链解锁系统 ✅
- **7 个渐进式任务**：
  1. **初识航向控制** (EASY) - 手动控制，平静海面
  2. **P 控制器入门** (EASY) - 理解比例控制
  3. **PD 控制器进阶** (MEDIUM) - 减少超调
  4. **PID 控制器精通** (MEDIUM) - 完整 PID
  5. **海况挑战：中浪** (HARD) - 3 级海况
  6. **海况挑战：大浪** (HARD) - 4 级海况
  7. **综合评估：专家认证** (EXPERT) - 5 级海况
- **解锁机制**：完成上一关（≥60 分）自动解锁下一关
- **进度追踪**：记录最佳成绩、尝试次数、完成时间

### 3.6 学生能力画像 ✅
- **五维能力评估**：
  - **稳态精度**：控制系统稳定后的误差控制能力
  - **动态响应**：对变化的快速响应能力
  - **鲁棒性**：应对环境干扰的稳定性
  - **安全性**：遵守安全规范的程度
  - **能耗控制**：舵机动作的能耗效率
- **雷达图可视化**：使用 Recharts 展示能力分布
- **综合评级**：卓越/优秀/良好/及格/待提升
- **学习统计**：
  - 完成仿真次数
  - 完成任务数
  - 伦理违规次数
  - 仿真总时长
  - 平均得分

### 3.7 Monte Carlo 参数优化 ✅
- **智能搜索**：随机采样 + 局部搜索混合策略
- **优化目标**：
  - 最小化航迹误差
  - 限制舵角速度
  - 减少超调量
  - 缩短调节时间
- **快速收敛**：提前停止机制，通常 50-100 次迭代
- **参数推荐**：返回最优 Kp、Ki、Kd 和性能指标

### 3.8 个人中心 ✅
- **用户信息管理**：查看和编辑个人资料
- **能力雷达图**：直观展示五维能力
- **学习统计**：完成任务、仿真次数、技术分、伦理分
- **最近活动**：仿真练习、任务完成、伦理违规记录
- **任务进度**：进度条和完成率

### 3.9 主控制台 (Dashboard) ✅
- **统计卡片**：完成任务、仿真次数、技术分、伦理分
- **功能模块网格**：
  - 🎯 任务大厅
  - 🚢 驱逐舰仿真
  - 🤖 AI 虚拟总工
  - 👤 个人中心
  - ⚠️ 伦理案例
  - 📚 知识库
- **快速开始**：一键进入主要功能
- **顶部导航**：用户信息、个人中心入口、登出

### 3.10 知识库 (Knowledge) 🚧
- **PID 控制理论**：比例、积分、微分原理
- **船舶动力学**：Nomoto 模型、操纵性
- **海洋环境**：风浪流影响
- **安全规范**：CCS 船舶操纵规范
- **状态**：知识图谱节点点击显示完整基础信息，知识卡片统一以模态展示，教师编排预览同渲染；MDX 附件支持 PPT 尺寸渲染
- **知识图谱融合（2026-02）**：接入 `data/knowledge_graph.json`（节点）与 `data/relations.jsonl`（关系），统一映射为现有图谱 API；支持关系类型、关系强度阈值筛选，并在侧栏/悬浮卡片展示节点 Bloom 分类

### 3.11 伦理案例库 (Ethics) 🚧
- **工程伦理场景**：两难决策模拟
- **案例分析**：海洋环保与开发平衡
- **伦理评估**：量化决策能力
- **状态**：框架已搭建，案例待补充

### 3.12 互动学习 (Interactive Learning) ✅
- **模块入口**：`/interactive-learning`
- **入口路由拆分（2026-02）**：
  - `/interactive-learning/cross-domain-exploration`（跨域探索，原“趣味探索”命名升级）
  - `/interactive-learning/courses`（互动课程，原“线下课程入口”命名升级）
  - `/interactive-learning/chapter-components`（各章节互动组件入口）
  - `/interactive-learning/chapter-components/[category]`（章节组件独立路由）
- **精品课程入口（2026-02-28）**：
  - `/interactive-learning/courses/cruise-comfort-boppps`（45 分钟课堂实录互动流程入口）
  - 新增课堂隔离路由：`/interactive-learning/courses/cruise-comfort-boppps/teacher/[sessionId]` 与 `/interactive-learning/courses/cruise-comfort-boppps/student/[sessionId]`
  - 教师端从入口创建课堂（自动克隆 `cruise-comfort-v1` 并创建 `ClassSession`），第一页展示课堂码；学生端输入课堂码加入，也可进入 `student/demo` 自由浏览
  - 入口按账号角色隔离显示：学生隐藏“开始上课（教师）”，教师隐藏“输入课堂码加入课堂”；两端保留演示模式
  - 教师/学生动态路由增加服务端角色守卫：学生访问教师页自动跳转学生页；教师访问学生页自动跳转教师页（`demo` 例外）
  - 课程导航统一为“返回 + 标题 + 环节下拉 + 下方左右箭头”；课程标题统一为“柔性之海：豪华邮轮舒适度控制”
  - 演示模式提示文案合并进课程导航栏中部，压缩竖向占用
  - 教师端保留完整环节；学生端从“工程目标设定”起进入“仿真 + 多表征联动”综合工作台（标签切换），可直接跳转收尾总结
  - B 阶段接入 `public/videos/luxury-liner-intro.mp4`（缺失时显示空白播放框）
  - O 阶段支持布鲁姆动词目标设计与个性化目标发布；P1 阶段支持能力点绑定前测与教师端统计
  - 教师端保留 NeuralODE 静态嵌入页，资源目录：`public/assets/cruise-comfort-boppps/`
  - 2026-02-28（二次迭代）：
    - 删除 `/interactive-learning` 顶部“课堂快速加入”入口；保留课程内独立入口流程
    - 修复教师“开始上课”`preset not found`：将 `cruise-comfort` 预置教案注册进 `ALL_PRESETS`
    - 教师/学生课堂页移除课堂码信息栏展示；课堂码发放环节改为“等待教师开始授课”+课堂思考提示
    - 教师与学生端课堂码页均新增“已加入学生名单 + 总人数”动态刷新显示
    - 课程导航压缩为三段式：左侧英中双行标题，中部 BOPPPS 阶段，右侧环节下拉 + 左右翻页
    - 学生端从工程目标设定起采用“仿真/多表征”常驻工作台；切换环节不重载 iframe，仅更新提示文案
    - 仿真控制面板修正：`PD` 模式下 `Kp/Kd` 可调、`Ki` 锁定；课程模式一致性评语保留在评估标签
    - 课堂总结新增 LLM 洞察接口：`POST /api/simulation/cruise-summary-insight`（教师班级洞察 / 学生个人洞察）
  - 2026-03-01（三次迭代：展示页重构）：
    - 新增课程显示单一配置源：`CRUISE_STEP_DURATION`、`TEACHER_STAGE_COPY`、结构化 `STUDENT_STAGE_TASKS`（bullets/keyQuestion/tips/checks）
    - 教师端 14 步显示页按 `docs/platform-display-design.md` 重构：Bridge 三约束卡片、Objective 布鲁姆动词高亮、Precheck 教学决策提示、NeuralODE 双栏对比、Summary 回环文案 + 达成总览
    - 学生端显示页重构：Bridge 场景卡与约束速览、Objective 薄弱点标签、Precheck 大字号引导、Summary 设计档案卡
    - 学生工作区任务条升级为统一结构组件（🔑关键问题 / ⚡提示 / ✅检查清单），并显示当前环节时长
    - 课程导航栏压缩并增强中部信息：BOPPPS 阶段 + 环节时长 + 当前环节标题，保持教师/学生端一致
  - 2026-03-01（四次迭代：仿真交互增强）：
    - 7 个仿真统一接入相机条速度控制（`- / +`，最高 `8x`），位于网格按钮右侧并直接作用于固定步长仿真推进
    - 邮轮仿真航线可视化强化：期望航线与当前航向改为同色系箭头、轨迹与航向主色统一，船体水线位置下调
    - 课堂综合工作台新增实时指标条：在“仿真/多表征”切换旁显示控制器参数与时域/频域关键指标，支持跨 iframe 实时同步
    - 邮轮课程模式新增“虚拟仿真观察”开关、学生侧评估约束手动填写、结构化提示词“发送+即时反馈”、一致性校验改为基于真实仿真数据（未运行时提示先运行）
    - NeuralODE 环节教师端/学生端公式改为 LaTeX 渲染（`react-katex`）
  - 2026-03-10（L-2a 精品课重构）：
    - 新增 `/interactive-learning/courses/l2a-time-domain-fasttrack` 精品互动课堂入口，以及教师端 `/teacher/[sessionId]`、学生端 `/student/[sessionId]` 同级隔离路由
    - 互动课程页重组为“精品课程 + 默认折叠的旧版章节课程”；保留“柔性之海”精品入口，并将原 `lessonXX` 系列统一收纳到默认收起的折叠菜单
    - 新课采用与“柔性之海”一致的精品课程结构，围绕 L-2a 材料实现 18 步 BOPPPS 课堂流程，并提供左侧常驻双面板工作区（极点平面 + 时域响应）
    - 课堂状态与统计埋点复用现有 `/api/session`、`/api/session/[id]/state` 与 `useInteractiveTracking`，演示模式静默同步，避免为匿名访问新增接口
  - 2026-03-11（课堂链路稳定性修复）：
    - 统一课堂码跳转解析：`/api/session/join` 返回按课堂所属课程计算出的教师/学生目标地址；`/dashboard`、`/classroom/join`、精品课程入口页输入同一课堂码后会跳转到同一正确课堂页面
    - 旧 `/classroom/teacher/[sessionId]` 与 `/classroom/student/[sessionId]` 路由增加精品课程自动转发，教师后台与历史链接可继续复用旧入口
    - L-2a 与“柔性之海”教师页补齐“结束课堂”按钮；教师班级详情页支持直接停止进行中的课堂，避免残留 `ACTIVE` 课堂
    - 教师端翻页改为“本地权威 + 服务端确认”模式，消除轮询导致的偶发回跳；学生端改为“检测不同步并手动跳转”，不再强制追页
    - `/api/session/[sessionId]/state` 增加 `scope=self` 与 `scope=student-view` 查询范围，学生端不再轮询全班完整状态；课堂关键节点增加结构化日志（入课、翻页推进、结束课堂、到场、教师同步发布）
  - 2026-03-11（L-2b 精品课首轮落地）：
    - 新增 `/interactive-learning/courses/l2b-root-locus-fasttrack` 精品互动课堂入口，以及教师端 `/teacher/[sessionId]`、学生端 `/student/[sessionId]` 同级隔离路由
    - `course-content/authoring/lessons/L-2b/media/raw/*.py` 补齐 `--output` 输出参数；新增 `scripts/generate_l2b_runtime_media.py`，把根轨迹性能区、45°射线定位图与三阶穿越图直出到 `course-content/runtime/lessons/L-2b/media`
    - 新增 `/course-runtime/[...assetPath]` 运行时资源路由，页面直接读取 `course-content/runtime` 下 SVG 产物，不再依赖 `public/` 占位图
    - L-2b 学生端保留首次对齐、后续不同步提示与手动跳转；教师端复用结束课堂回跳、课堂码解析与会话广播链路
    - 工作区按步骤分化为反馈框图认知卡、广播/独立根轨迹工作台、轨迹选点信息卡与 45° 射线几何定位区，补齐预测→验证→AI 对比→总结回看链路
- **跨域探索置顶组件**：`/interactive-learning/multi-representation-linkage` 作为跨域探索首个入口
- **资源来源**：动态加载教学资源库中 `INTERACTIVE_COMP` 单页互动资源
- **资源查看入口**：`/interactive-learning/resources/[id]`
- **定位**：以单页互动资源浏览为主，提供精选课程入口；课程编排与播放入口统一在管理员课堂流程
- **统一框架**：课程播放统一走 `TeachingResource` + `LessonPlan` + `ClassSession` 的 BOPPPS 编排链路
- **新增**：跨域探索分类与十滴水关卡进度/排行榜支持
- **Control Odyssey**：关卡扩展至 15 关与青铜/白银/黄金分级解锁、统一仿真内核（固定步长 + Tustin 离散化 + 非线性积分器）、控制商店积分换购与控制器升级体系、测速反馈/前馈/史密斯预估器复合控制、难度滑块与积分倍率、配置面板分区与控制框图高亮、暗流扰动（含惯性滤波）与通道包络生成、通关结算三指标（超调/稳态/平均相对误差）与分支得分基准、榜单分支标识与指标展示、全息能量壳层飞船外形与动态尾迹、AI 控制建议（20 积分调用，关卡/配置/指标上下文，关卡内最新建议共享与高分配置上下文，建议历史落库）、失败结算详情曲线入口
- **仿真规范**：统一仿真接口与时间步进规范入口 `docs/Simulation_Guidelines.md`
- **Lesson 01 反馈：控制原理的核心思想**：从生活场景引入反馈思想的 90 分钟预置教案，覆盖控制系统组成、开环/闭环与反馈价值
- **Lesson 02 拉氏变换：工程直觉的数学实现**：以 RLC 电路为切口的 90 分钟预置教案，覆盖 s 域直觉、常用定理与反变换路径
- **Lesson 03 微分方程与控制系统基础模型**：微分方程建模与系统基础模型的 90 分钟预置教案，覆盖建模方法、步骤、典型案例与线性化
- **Lesson 04 传递函数与控制系统数学模型**：传递函数定义、推导与零极点判读的 90 分钟预置教案，覆盖典型环节识别与传函推导演练
- **Lesson 05 方框图、信号流图与梅森公式**：结构图等效化简、信号流图拓扑建模与梅森公式应用的 90 分钟预置教案，覆盖结构图化简路线、信号流图速练与梅森公式数圈圈挑战
- **Lesson 06 指标裁判席**：基于 BOPPPS 的时域性能指标课程，包含指标速判、裁判手册、裁判席计分器与后测评估，并输出 AI 课堂报告
- **Lesson 07 衰减振荡**：欠阻尼二阶系统互动课程，覆盖标准型、极点关系、阶跃响应与参数挑战，“极点操纵器”支持 S 平面缩放/平移、等阻尼/等频率网格、三曲线挑战与课堂成绩大屏统计，并提供 90 分钟预置教案
- **Lesson 08 稳定性与稳态误差**：基于稳定判据与误差度量的 90 分钟预置教案，涵盖劳斯判据、终值定理与静态误差系数互动环节
- **Lesson 09 校正与时域综合**：基于校正手段与航向系统案例的 90 分钟预置教案，覆盖 PD/输出反馈、前馈/扰动补偿与时域综合验证
- **Lesson 10 根轨迹法**：根轨迹大局与细节修正的 90 分钟预置教案，涵盖模值/相角条件、分离点、渐近线与出射角挑战
- **Lesson 11 参数根轨迹与图形化思考**：以参数根轨迹广义定义为核心，聚焦稳定范围判断、主导极点选择与仿真验证流程
- **Lesson 12 频率特性与伯德图**：频率响应与伯德图的 90 分钟预置教案，覆盖对数频率特性、斜率叠加绘图与读图反推传函
- **Lesson 13 幅相特性与稳定判据**：Nyquist 图与对数稳定判据的 90 分钟预置教案，覆盖幅相特性特征点、幅角原理与判稳场景演练
- **Lesson 14 稳定裕度与三频段**：稳定裕度与三频段分工的 90 分钟预置教案，覆盖相角/幅值裕度估算、频段性能匹配与频域权衡策略
- **Lesson 15 串联校正与滞后超前**：超前/滞后与联合校正的 90 分钟预置教案，覆盖校正策略决策、参数估算与联合设计流程
- **Lesson 16 非线性系统与描述函数基础**：非线性现象与描述函数基础的 90 分钟预置教案，覆盖谐波线性化与典型非线性特性识别
- **Lesson 17 描述函数分析法与自振判别**：负倒描述函数与自振判别的 90 分钟预置教案，覆盖交点判别、稳定性判断与参数求解
- **知识卡片嵌入**：所有预置教案在参与式环节补齐知识卡片，并与知识图谱节点绑定，支持课堂内讲授与后续互动巩固

### 3.13 管理员后台 (Admin) ✅
- **全局态势总览**：用户规模、活跃会话、仿真与伦理风险指标统一汇总
- **账号管理**：新建/查看/改密/删除账号，支持角色区分
- **批量导入**：Excel 模板支持账号批量导入/更新（前三列必填：账号/姓名/角色；其他字段选填），重复账号按账号更新，前端展示失败明细
- **权限控制**：仅管理员登录可访问

### 3.14 多表征联动可视化引擎 ✅
- **页面路径**：`/interactive-learning/multi-representation-linkage`
- **开环根轨迹联动**：复平面以开环极点配置为输入，实时绘制根轨迹并叠加闭环极点（不同颜色）
- **开环零点扩展**：支持添加开环零点（实零点 / 共轭零点对），并参与根轨迹、Bode、Nyquist 联动计算
- **闭环极点拖拽**：支持在根轨迹上拖拽闭环极点，自动联动等效增益，时域响应按闭环极点位置重算
- **共轭极点约束**：开环共轭极点联动移动；极点与图表关键数据均统一保留三位小数
- **刷新策略优化**：拖拽过程中仅本地预览，松开后触发后端重算，降低交互延迟
- **频域联动升级**：Bode 幅频/相频合并为同模块上下子图（共享十倍频程刻度），可勾选显示相角裕度与幅值裕度
- **Nyquist + 提示分区**：下方拆分为 Nyquist 图（含裕度标注）与跨域关联提示模块
- **后端计算 API**：
  - `POST /api/linkage/calculate-time-domain`
  - `POST /api/linkage/calculate-frequency-domain`
  - `POST /api/linkage/stability-analysis`
- **教学提示**：基于极点分布、增益裕度、相位裕度自动生成跨域关联提示
- **课程模式（2026-02-28）**：
  - 通过 query `courseMode=cruise-boppps` 启用课堂模式，默认注入“邮轮模型 + PID 控制器”近似开环
  - 课程模式禁用“添加极点/零点”和删除操作，仅保留本课所需联动操作
  - 与 `/simulations/cruise` 通过同源 `postMessage` 联动：仿真控制器模式与参数变化会更新开环/闭环极点，跨域页手动调整闭环极点（根轨迹）后会反向同步控制器参数
  - 课程模式下新增一致性评语接口：`POST /api/simulation/cruise-consistency-comment`（评估数值 + LLM 文本）

### 3.15 自适应跨域题库系统 ✅
- **页面路径**：`/assessment/adaptive-practice`
- **能力诊断**：计算型/跨域型/设计型三维能力估计与薄弱项识别
- **自适应出题 API**：
  - `GET /api/assessment/diagnostic`
  - `POST /api/assessment/next-question`
  - `POST /api/assessment/generate-question`
  - `POST /api/assessment/submit-answer`
  - `GET /api/assessment/ability-report/:userId`
- **题库能力**：内置 50 道跨域题，支持按薄弱知识点生成新题

### 3.16 工程场景扩展（邮轮舒适度 / 破冰船鲁棒） ✅
- **页面路径**：
  - `/simulations/cruise`（右侧标签 `评估`）
  - `/simulations/icebreaker`（右侧标签 `评估`）
- **合并说明**：原 `cruise-comfort`、`icebreaker-robust` 变体页面已并入主仿真页面，不再单独维护
- **邮轮舒适度扩展**：多目标权衡（舒适度/性能/能耗）评分与建议
- **破冰船鲁棒扩展**：不确定参数区间 + 扰动场景 Monte Carlo 鲁棒评估
- **分析 API**：
  - `POST /api/simulation/cruise-comfort-analysis`
  - `POST /api/simulation/icebreaker-robust-analysis`

### 3.17 AI伴随探究系统 ✅
- **介入判定**：连续失败、停滞、约束违规三类触发规则
- **介入生成 API**：
  - `POST /api/ai/intervention/check`
  - `POST /api/ai/intervention/generate`
  - `POST /api/ai/intervention/feedback`
- **场景融合**：在 7 个仿真右侧“AI伴学”标签提供伴随探究面板，支持“记录尝试→判定介入→生成引导→反馈”

### 3.18 元提示词评价 + 过程一致性校验 ✅
- **页面路径**：`/evaluation/prompt-assessment`
- **提示词质量评价 API**：
  - `POST /api/evaluation/assess-prompt`
  - 评价维度：完整性、精确性、结构化、可执行性
- **过程一致性 API**：
  - `POST /api/evaluation/track-consistency`
  - `GET /api/evaluation/prompt-history/:userId`
- **一致性目标**：覆盖“提示结构—设计行为—结果达成”的过程化评价

### 3.19 教学创新报告配图支持（自适应测评三图） ✅
- **新增聚合页**：`/review/adaptive-assessment-figures`
  - 图 A：`/assessment/adaptive-practice?demo=1&scene=stable`（题库稳定性/标准化）
  - 图 B：`/assessment/adaptive-practice?demo=1&scene=generate`（差异化生成）
  - 图 C：`/evaluation/prompt-assessment?autodemo=1`（结构化评价常态化）
- **自适应题库页面增强**：
  - 支持报告演示模式（`demo=1` + `scene` 参数）用于稳定复现截图
  - 保留真实接口流程，不影响常规训练
- **提示词评价页面增强**：
  - 新增“常态化训练量化追踪”区块（提示词版本轨迹 + 能力成长轨迹）
  - 接入 `GET /api/evaluation/prompt-history/:userId` 与 `GET /api/assessment/ability-report/:userId`
  - 新增“生成常态化演示轨迹”能力，支持快速产出可展示数据

## 4. 技术架构

### 4.1 前端技术栈
- **框架**：Next.js 14 (App Router)
- **语言**：TypeScript
- **样式**：Tailwind CSS
- **UI 组件**：shadcn/ui + Radix UI
- **3D 渲染**：React Three Fiber + Three.js
- **图表**：Recharts
- **图谱可视化**：React Flow
- **公式渲染**：KaTeX
- **数学计算**：mathjs
- **状态管理**：React Hooks

### 4.2 后端技术栈
- **API**：Next.js API Routes (Server Actions)
- **认证**：NextAuth.js (JWT 策略)
- **数据库**：PostgreSQL
- **ORM**：Prisma
- **密码加密**：bcryptjs

### 4.3 AI 技术栈
- **LLM 服务**：硅基流动 (SiliconFlow)
- **模型**：Qwen/Qwen3-Omni-30B-A3B-Thinking
- **SDK**：Vercel AI SDK v3.4
- **功能**：流式对话、Function Calling、参数优化建议

### 4.4 数据库模型
```prisma
User              # 用户账号
StudentProfile    # 学生档案（技术分、伦理分）
Mission           # 任务/关卡定义
UserProgress      # 用户任务进度
SimulationLog     # 仿真记录（参数、指标、轨迹）
EthicalLog        # 伦理违规记录
Session, Account  # NextAuth 会话
LinkageSession    # 多表征联动探索记录
Question          # 跨域题库
UserAnswer        # 学生答题记录
AbilityAssessment # 能力评估快照
AIIntervention    # AI 伴随介入记录
PromptAssessment  # 元提示词评价记录
DesignSession     # 设计行为与一致性记录
```

### 4.5 部署架构
- **开发环境**：Node.js 20+ + PostgreSQL 14+
- **启动脚本**：`npm run startup` (自动化启动)
- **停止脚本**：`npm run shutdown` (清理进程)
- **日志管理**：集中式日志 (`.logs/`)
- **容器化**：Docker + Docker Compose (生产环境)

## 5. 项目结构

```
act.just.edu.cn/
├── src/
│   ├── app/                      # Next.js 应用目录
│   │   ├── (auth)/              # 认证页面（登录、注册）
│   │   ├── (main)/              # 主要功能页面
│   │   │   ├── dashboard/       # 主控制台
│   │   │   ├── missions/        # 任务大厅
│   │   │   └── profile/         # 个人中心
│   │   ├── ai/copilot/          # AI 虚拟总工
│   │   ├── interactive-learning/ # 互动学习模块
│   │   │   ├── argument-principle/  # 幅角原理
│   │   │   └── control-map/         # 控制地图
│   │   ├── simulations/destroyer/  # 驱逐舰仿真
│   │   ├── api/                 # API 路由
│   │   │   ├── auth/            # 认证 API
│   │   │   ├── ai/chat/         # AI 聊天 API
│   │   │   ├── missions/        # 任务 API
│   │   │   ├── user/profile/    # 用户画像 API
│   │   │   ├── simulation/optimize/  # 参数优化 API
│   │   │   └── ethics/violation/     # 违规记录 API
│   │   └── actions/             # Server Actions
│   ├── features/                # 平台功能域组件
│   │   ├── ai/                  # AI 虚拟总工
│   │   ├── ethics/              # 伦理模块
│   │   ├── knowledge/           # 知识库
│   │   ├── lesson-engine/       # 课程引擎
│   │   ├── admin/               # 管理后台
│   │   ├── dashboard/           # 主控制台
│   │   └── mission/             # 任务模块
│   ├── resources/               # 教学资源
│   │   ├── interactive-learning/ # 互动学习组件
│   │   ├── simulations/         # 虚拟仿真与仿真工具
│   │   └── widgets/             # 教学小工具
│   ├── components/              # 平台基础组件
│   │   ├── providers/           # 全局 Provider
│   │   ├── shared/              # 共享组件
│   │   └── ui/                  # UI 基础组件
│   ├── hooks/                   # 平台通用 Hooks
│   │   └── useEthicalMonitor.ts # 伦理监控 Hook
│   ├── lib/                     # 平台工具库
│   │   ├── auth.ts              # 认证配置
│   │   ├── prisma.ts            # Prisma 客户端
│   │   ├── ai-client.ts         # AI 客户端
│   │   ├── ai-tools.ts          # AI Function 定义
│   │   ├── user-sync.ts         # 用户同步
│   │   ├── competency.ts        # 能力计算
│   │   └── constants/ethics.ts  # 伦理常量
│   └── types/                   # 平台 TypeScript 类型
│       ├── next-auth.d.ts       # NextAuth 类型扩展
│       └── curriculum.ts        # 课程结构
├── prisma/
│   └── schema.prisma            # 数据库架构
├── scripts/
│   ├── start.sh                 # 启动脚本
│   ├── stop.sh                  # 停止脚本
│   ├── seed-missions.mjs        # 任务数据种子
│   ├── seed-demo-user.mjs       # 演示用户种子
│   └── README.md                # 脚本使用说明
├── docs/
│   ├── ProjectDescription.md    # 本文档
│   ├── Developmant.md           # 开发计划
│   └── QUICKSTART.md            # 快速开始
└── QUICKSTART.md                # 快速开始指南
```

## 6. 快速开始

### 6.1 环境要求
- Node.js 20+
- PostgreSQL 14+
- npm 或 yarn

### 6.2 安装步骤

```bash
# 1. 克隆仓库
git clone <repository-url>
cd act.just.edu.cn

# 2. 安装依赖
npm install

# 3. 配置环境变量
cp .env.example .env
# 编辑 .env 配置数据库和 API 密钥

# 4. 创建数据库
psql -U postgres
CREATE USER act_user WITH PASSWORD 'act_pass';
CREATE DATABASE act_obe OWNER act_user;
GRANT ALL PRIVILEGES ON DATABASE act_obe TO act_user;

# 5. 推送数据库架构
npx prisma db push

# 6. 填充初始数据
npm run seed:missions  # 7 个任务
npm run seed:demo      # 演示账号

# 7. 启动服务
npm run startup
```

### 6.3 访问系统
- **前端地址**：http://localhost:3000
- **登录账号**：`demo`
- **密码**：`DemoStudent@Just2026!`

### 6.4 常用命令
```bash
npm run startup        # 启动服务
npm run shutdown       # 停止服务
npm run dev            # 开发模式
npm run build          # 构建生产版本
npm run logs           # 查看日志
npm test               # 运行测试
```

## 7. 核心特性

### 7.1 教学创新
1. **渐进式学习路径**：7 个任务从易到难，循序渐进
2. **即时反馈**：实时性能监控，AI 智能建议
3. **个性化学习**：能力画像分析，针对性提升
4. **游戏化设计**：任务解锁、成就系统、排行榜（待开发）

### 7.2 技术创新
1. **Hook 化仿真引擎**：React 风格，易于集成和扩展
2. **Function Calling**：AI 直接操作仿真参数
3. **Monte Carlo 优化**：智能参数搜索，快速收敛
4. **伦理熔断**：首创工程伦理实时监控

### 7.3 工程伦理
1. **安全第一**：强制遵守 CCS 船舶操纵规范
2. **过程监控**：实时检测违规行为
3. **反思机制**：强制整改，培养安全意识
4. **量化评估**：伦理分体系，记录成长轨迹

## 8. 未来规划

### 8.1 短期计划（1-3 个月）
- [ ] 完善知识库内容（PID 理论、船舶动力学）
- [ ] 补充伦理案例库（工程决策场景）
- [ ] 添加教师管理后台
- [ ] 实现班级排行榜
- [ ] 优化移动端适配

### 8.2 中期计划（3-6 个月）
- [ ] 支持更多船型（集装箱船、游轮）
- [ ] 多人协作仿真
- [ ] AI 自动出题系统
- [ ] 学习报告生成
- [ ] 导出数据分析功能

### 8.3 长期计划（6-12 个月）
- [ ] VR/AR 沉浸式体验
- [ ] 与实体设备联动
- [ ] 国际化支持
- [ ] 开放 API 接口
- [ ] 建立开发者社区

## 9. 团队与支持

### 9.1 开发团队
- **项目负责人**：YW
- **技术架构**：Claude (Anthropic AI Assistant)
- **开发框架**：Next.js + React + TypeScript

### 9.2 技术支持
- **文档**：[QUICKSTART.md](./QUICKSTART.md)
- **脚本文档**：[scripts/README.md](../scripts/README.md)
- **开发计划**：[Developmant.md](./Developmant.md)
- **问题反馈**：GitHub Issues

### 9.3 依赖项目
- Next.js: https://nextjs.org
- Prisma: https://www.prisma.io
- NextAuth.js: https://next-auth.js.org
- React Three Fiber: https://docs.pmnd.rs/react-three-fiber
- Vercel AI SDK: https://sdk.vercel.ai
- 硅基流动: https://siliconflow.cn

## 10. 许可证

本项目采用 MIT 许可证。详见 LICENSE 文件。

## 11. 近期更新（2026-03-01）

- 展示班级数据迁移到“2023自动化启航班”：移除展示班 `demo` 学生（保留账号）、30名演示学生并入启航班，启航班描述更新为“AI-OBE平台教改班”，并删除“2023自动化课外展示班”。
- 启航班课堂历史补齐：新增 17 次课堂记录（含本次课堂），可在班级“课堂历史”中查看。
- 新增课堂复盘页：`/classroom/teacher/[sessionId]/review`，用于展示“课前 vs 课后能力追踪”与“课后个性化补强路径”。
- `/review/extracurricular-showcase` 文案和班级定位更新为“2023启航班”。
- 新增课外展示数据填充脚本 `scripts/db/seed-extracurricular-showcase.mjs`：一键填充 `data/test_students.md` 全部 31 个学生账号（含 `demo`）的班级归属、前后测能力、题单作答、提示词评估、设计会话、补强路径与奥德赛进度数据。
- 新增展示班级（班级码 `ECSHOW`）主链路数据：重点演示账号 `20230010102608` 与 `20230010102605` 已构造差异化学习轨迹，用于脚本 A/B 镜头展示。
- 新增教师班级分析聚合能力：`/api/teacher/classes/[classId]/analytics`，统一输出班级热力图、推荐流程、前后测对比、A/B题单、补强路径和提示词结构-设计效果相关性（当前样本 `r≈0.834`）。
- 新增教师端班级分析页面：`/teacher/classes/[classId]/analytics`，并在班级详情页加入“学情热力图与展示分析”入口。
- 扩展学生个人中心与用户画像接口：`/api/user/profile` 与 `/profile` 新增“课前/课后能力追踪、个性化补强路径、推荐题单、结构分与设计效果分”展示。
- 新增评审聚合入口：`/review/extracurricular-showcase`，可从 `/review` 快速进入并定位脚本关键镜头页面。
- 展示分析入口职责收敛：`/teacher/classes/[classId]/analytics` 班级整体仅保留雷达热力图展示；重点名单、课前/课后追踪、个性化题单与课后补强统一下沉到单次课堂记录页 `/classroom/teacher/[sessionId]/review`。
- 邮轮仿真基础航线改为“先直航后转向”任务：默认航行约 `1800m` 后切换到 `30°` 目标航向。
- 邮轮仿真新增期望航线可视化：绿色虚线为期望航线，紫色实线为实际航迹，便于课堂对比。
- 多表征联动画布增强：支持 `+/-` 缩放与空白区域拖动画布平移，拖拽零极点后自动刷新坐标范围。
- 全部主仿真页面新增统一网格开关：在视角切换按钮组右侧提供“网格开/关”按钮。
- 各仿真网格样式统一（100m 细分 / 500m 主分区），用于相对位置判断与轨迹分析。
- 新增全局深色/浅色主题切换：在根布局注入主题初始化脚本，新增 `ThemeProvider` 与全局悬浮切换按钮，支持记忆用户选择并在全站生效。
- 主题体系升级为 class 模式：Tailwind `darkMode` 切换为 `class`，并补充 `.light` 主题变量；教师与登录布局已适配浅/深色双主题样式。
- 统一主入口视觉样式：主页 `/`、虚拟实验室 `/virtual-lab`、仿真入口 `/simulations`、互动学习 `/interactive-learning`、评审入口 `/review` 与课外展示入口 `/review/extracurricular-showcase` 已移除硬编码深色配色，改为主题语义色与统一卡片/按钮体系。
- 新增全链路主题桥接层（`globals.css`）：对历史页面中高频硬编码深色 token（`bg-slate-*`、`text-white`、`border-white/*`、`from/to-slate-*` 及知识图谱/AI/思政模块常见深色 hex 背景）在浅色模式下做统一映射，实现旧页面无需大改即可随主题切换并保持视觉一致性。
- 学生主工作流页面（`/dashboard`、`/missions`）完成语义化样式改造：统一使用 `surface-page` / `surface-card` / `cta-primary` 等主题组件类，提升跨页面一致性与可维护性。
- 新增主题覆盖回归测试 `scripts/tests/test-theme-coverage.ts`，用于防止主入口页面再次引入固定深色 token 导致切换失效。
- 新增高频链路主题回归测试 `scripts/tests/test-theme-workflow-pages.ts`（`npm run test:theme-workflow`）：覆盖 `profile`、班级详情、课堂复盘、提示词评估、多表征联动页面，强制要求页面具备主题语义基类。
- 主题统一改造扩展到高频业务页面：`/profile`、`/teacher/classes/[classId]`、`/classroom/teacher/[sessionId]/review`、`/evaluation/prompt-assessment`、`/interactive-learning/multi-representation-linkage` 已统一到 `surface-page` / `surface-topbar` / `surface-card` / `surface-card-soft` 语义样式体系。
- Chrome DevTools 实测通过：在学生端与教师端核心链路中验证了深浅主题切换（`body` 与 `surface-card` 计算样式在 dark/light 间正确切换），并确认改造页面无新增控制台报错。
- 修复知识图谱浅色可读性问题：`/knowledge` 的 2D 图谱节点标签由固定白字改为主题感知（浅色深字、深色浅字），并增加反差描边，避免浅色背景下文字不可读。
- 新增知识图谱主题回归测试 `scripts/tests/test-knowledge-graph-theme.ts`（`npm run test:knowledge-theme`），防止 2D 图谱标签颜色回退为固定白字。
- 知识图谱筛选器升级：新增章节（多选下拉）、`category`、`bloom_level`、关键词联合筛选；关系类型计数改为按当前筛选/搜索结果实时统计；默认仅展示“前置关系”。
- 知识图谱章节化展示升级：左侧节点列表改为按章节分组并默认折叠；图谱渲染中注入章节顶层节点并按顺序显示：`基本概念 → 系统模型 → 时域分析 → 根轨迹分析 → 频域分析 → 系统校正 → 离散系统 → 非线性系统 → 状态空间`。
- 知识图谱节点详情增强：点击节点后新增条件展示字段 `examples`、`difficulty`、`importance`、`keywords`、`formulas`；节点信息栏新增章节信息。
- 知识图谱浅色主题细化：关系筛选区与左侧节点标签完成浅色重配色；3D 视图节点标签在浅色模式改为深色文字，提升可读性。
- 精品课程浅色主题增强：在 `globals.css` 的统一桥接层补齐 `text-cyan-*`、`text-sky-*`、`text-emerald-*`、`text-amber-*`、`text-orange-*`、`text-rose-*`、`text-violet-*` 的浅色高对比映射，提升互动课程浅色模式下的文字可读性。
- 新增浅色对比回归测试 `scripts/tests/test-theme-light-contrast.ts`，防止精品课程中常见强调色在浅色主题下再次退回低对比度。
- 数据源补齐：`data/knowledge_graph.json` 全量 612 个节点新增 `chapter_name` 字段，前后端统一按数据文件中的章节名称渲染与排序。
- 新增知识图谱筛选回归测试 `scripts/tests/test-knowledge-graph-filters.ts`（`npm run test:knowledge-filters`），覆盖章节映射、默认前置关系选择与筛选范围内关系计数。
- 新增统一导航组件 `src/components/shared/feature-page-nav.tsx`，并接入知识图谱、虚拟仿真、思政沙盘、AI工坊、评审入口及其下层页面，统一“返回上一级”样式并固定在左上区域。
- 评审入口页简化文案：头部仅保留标题；下方入口卡片移除“来源文件”字段展示。
- 主页入口隐藏“思政沙盘”“AI工坊”：同步移除首页顶栏导航与入口矩阵中的两个入口，并调整入口矩阵说明为“三大核心模块”。
- 账号口令对齐：新增固定账号密码更新脚本 `scripts/db/update-fixed-account-passwords.mjs`，将工号 `201300000012` 密码设置为 `zyw1983@Just`，管理员账号 `admin` 密码设置为 `admin@Just`。
- 用户菜单主题统一：`src/components/shared/user-menu.tsx` 移除硬编码深色样式，改为语义主题样式（支持深/浅色统一）；同时提升下拉与弹窗层级，避免在 dashboard/teacher/admin 顶栏中被遮挡。
- 新增回归脚本：`scripts/tests/test-user-menu-theme.mjs`（菜单主题样式校验）、`scripts/tests/test-account-password-overrides.mjs`（固定账号密码校验），并在 `package.json` 增加 `seed:fixed-passwords`、`test:user-menu-theme`、`test:account-passwords`。
- 新增学期级学生使用数据填充脚本 `scripts/db/seed-semester-usage-for-test-students.mjs`：按 `data/test_students.md` 全量 142 个学生账号重建仿真日志、习题作答与关卡进度数据，满足“仿真每类 10-30 次（可缺席部分类型）、每类仿真时长 60-300 分钟、习题 300-500 次、游戏每关 1-30 次且积分 1000-2000”。
- 新增学期数据校验脚本 `scripts/tests/verify-semester-usage-for-test-students.mjs`（`npm run test:semester-usage`），用于自动核验上述数据区间约束。
- 新增模型渲染策略测试脚本 `scripts/tests/test-model-render-policy.ts`（`npm run test:model-render-policy`），覆盖“管理员开关 + 网络条件降级”的决策逻辑。
- 新增服务器配置指南 `docs/Server_Codex_Nginx_HTTP2_Guide_2026-03-03.md`，用于在 ECS 上由 Codex 执行 Nginx 配置加固（HTTP2/RSC/GLB 传输稳定性）。

## 12. 近期更新（2026-03-12）

- 新增项目内技能 `.codex/skills/homework-problem-authoring/`：支持按 `course-content/authoring/shared/homework-framework.md` 中的题号（如 `T1-1`、`T3-2`）执行“3 个出题智能体 + 裁判 + 3 个作答智能体”的出题闭环，并固化临时文件交接、防作弊文件访问限制、`C/X/D` 三类题一致性判定与二轮复核规则。
- 新增辅助脚本 `.codex/skills/homework-problem-authoring/scripts/extract_homework_question.py`：用于从作业框架中按题号提取最小题目规范，供主代理构造任务包时使用。
- 新增技能回归测试 `scripts/tests/test-homework-problem-authoring-skill.ts` 与脚本测试 `scripts/tests/test_extract_homework_question.py`，用于校验技能文本约束和题号抽取脚本行为。

## 13. 近期更新（2026-03-18）

- 修复 L-sum 课堂会话回归：`/api/session/[sessionId]` 在 Redis 快路径下重新返回 `joinCode/classId/planTitle`，教师端课堂码恢复显示。
- 修复课堂状态同步风暴：稳定化 `useSessionProgressChannel` 与 `useSessionStateChannel` 的返回值，并移除上层会话 hook 对整对象依赖导致的自激 GET/POST 循环。
- 修复 L-sum 学生端“跳到教师当前页”按钮只打点不跳转的问题，补齐实际翻页行为。
- 新增 L-sum 回归脚本 `scripts/tests/test-lsum-session-regression.mjs`，覆盖课堂码返回、会话 hook 稳定化与学生页跳转约束。
- 调整数据治理集成脚本 `scripts/tests/data-governance-integration-test.ts`，将 Redis 就绪和鉴权前置条件纳入验证，避免误报。
- 新增的成长中枢、学习档案、班级分析 V2、学生诊断页面已修复 `useEffect` 依赖告警，`npm run lint` 结果恢复干净。

---

**最后更新日期**：2026-03-18
**版本**：v1.1.1
**状态**：开发完成，可用于教学实践
