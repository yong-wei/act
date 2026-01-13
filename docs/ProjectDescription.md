# AI-OBE 船舶智控平台 - 项目说明

## 1. 项目愿景

AI-OBE (Artificial Intelligence - Outcome Based Education) 船舶智控平台是一个结合了**工程教育认证 (OBE)** 理念与**人工智能辅助教学**的综合性教育平台。本项目旨在通过高保真的虚拟仿真、个性化的 AI 学习路径以及伦理意识的培养，解决传统船舶控制工程教育中理论与实践脱节、伦理教育缺失等痛点。

## 2. 项目状态

✅ **开发阶段**：主要功能已完成，系统可用于教学实践
📅 **最后更新**：2026-01-13
🧩 **整改进展**：统一课程框架已确立为 DB BOPPPS 教案 + TeachingResource/registry + 互动埋点主链路（规范见 `docs/Unified_Lesson_Framework.md`），课次整改与预置教案对齐中；统一仿真内核（固定步长时钟 + Tustin 离散化 + 非线性积分器）覆盖 Control Odyssey 与虚拟仿真，Control Odyssey 关卡扩展至 15 关；仿真规范说明见 `docs/Simulation_Guidelines.md`
🧭 **导航更新**：预置教案/教案新建与编辑/教学资源管理页面新增“返回教室工作台”入口（`http://localhost:3001/teacher`）
🧠 **知识点同步**：启动脚本默认执行 `npm run seed:knowledge`，确保预置教案克隆所需 KnowledgeNode 已补齐
📘 **课程更新**：新增 Lesson 13「幅相特性与稳定判据：频域的启示」预置教案、互动学习入口，并完成知识节点绑定
🧾 **教案管理**：我的教案支持三点菜单删除并二次确认
🚀 **部署方式**：本地开发 + Docker 容器化部署

## 3. 核心功能模块

### 3.1 用户认证与管理 ✅
- **NextAuth.js 认证系统**：支持邮箱/用户名登录，JWT 会话管理
- **角色权限管理**：学生、教师、管理员三级权限体系
- **自动档案创建**：新用户自动创建学生档案和解锁第一关
- **账号安全**：个人中心支持修改密码与退出登录
- **演示账号**：
  - 演示教师账号：`test_teacher`，密码：`test@Just`
  - 演示学生账号：`demo`，密码：`demo@Just`

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

### 3.11 伦理案例库 (Ethics) 🚧
- **工程伦理场景**：两难决策模拟
- **案例分析**：海洋环保与开发平衡
- **伦理评估**：量化决策能力
- **状态**：框架已搭建，案例待补充

### 3.12 互动学习 (Interactive Learning) ✅
- **模块入口**：`/interactive-learning`
- **资源来源**：动态加载教学资源库中 `INTERACTIVE_COMP` 单页互动资源
- **资源查看入口**：`/interactive-learning/resources/[id]`
- **定位**：以单页互动资源浏览为主，提供精选课程入口；课程编排与播放入口统一在管理员课堂流程
- **统一框架**：课程播放统一走 `TeachingResource` + `LessonPlan` + `ClassSession` 的 BOPPPS 编排链路
- **新增**：趣味探索分类与十滴水关卡进度/排行榜支持
- **Control Odyssey**：关卡扩展至 15 关与青铜/白银/黄金分级解锁、统一仿真内核（固定步长 + Tustin 离散化 + 非线性积分器）、控制商店积分换购与控制器升级体系、测速反馈/前馈/史密斯预估器复合控制、难度滑块与积分倍率、配置面板分区与控制框图高亮、暗流扰动（含惯性滤波）与通道包络生成、通关结算三指标（超调/稳态/平均相对误差）与分支得分基准、榜单分支标识与指标展示、全息能量壳层飞船外形与动态尾迹、AI 控制建议（20 积分调用，关卡/配置/指标上下文，关卡内最新建议共享与高分配置上下文，建议历史落库）、失败结算详情曲线入口
- **仿真规范**：统一仿真接口与时间步进规范入口 `docs/Simulation_Guidelines.md`
- **Lesson 06 指标裁判席**：基于 BOPPPS 的时域性能指标课程，包含指标速判、裁判手册、裁判席计分器与后测评估，并输出 AI 课堂报告
- **Lesson 07 衰减振荡**：欠阻尼二阶系统互动课程，覆盖标准型、极点关系、阶跃响应与参数挑战，并提供 90 分钟预置教案
- **Lesson 08 稳定性与稳态误差**：基于稳定判据与误差度量的 90 分钟预置教案，涵盖劳斯判据、终值定理与静态误差系数互动环节
- **Lesson 09 校正与时域综合**：基于校正手段与航向系统案例的 90 分钟预置教案，覆盖 PD/输出反馈、前馈/扰动补偿与时域综合验证
- **Lesson 10 根轨迹法**：根轨迹大局与细节修正的 90 分钟预置教案，涵盖模值/相角条件、分离点、渐近线与出射角挑战
- **Lesson 11 参数根轨迹与图形化思考**：以参数根轨迹广义定义为核心，聚焦稳定范围判断、主导极点选择与仿真验证流程
- **Lesson 12 频率特性与伯德图**：频率响应与伯德图的 90 分钟预置教案，覆盖对数频率特性、斜率叠加绘图与读图反推传函
- **Lesson 13 幅相特性与稳定判据**：Nyquist 图与对数稳定判据的 90 分钟预置教案，覆盖幅相特性特征点、幅角原理与判稳场景演练
- **知识卡片嵌入**：所有预置教案在参与式环节补齐知识卡片，并与知识图谱节点绑定，支持课堂内讲授与后续互动巩固

### 3.13 管理员后台 (Admin) ✅
- **全局态势总览**：用户规模、活跃会话、仿真与伦理风险指标统一汇总
- **账号管理**：新建/查看/改密/删除账号，支持角色区分
- **批量导入**：Excel 模板导入学生账号（学号/姓名）
- **权限控制**：仅管理员登录可访问

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
- **登录账号**：`demo` / `demo@example.com`
- **密码**：`123456`

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

---

**最后更新日期**：2025-12-30
**版本**：v1.0.0
**状态**：开发完成，可用于教学实践
