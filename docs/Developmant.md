AI-OBE 船舶智控平台开发计划书 (Technical Spec)

0. 技术栈与全局规范 (Global Context)

Framework: Next.js 14 (App Router)

Language: TypeScript

Styling: Tailwind CSS + Radix UI / Shadcn UI (Default: Dark Mode)

State Management: Zustand (用于仿真器状态), React Context (用于全局偏好)

AI SDK: Vercel AI SDK (React) + OpenAI/Azure (LLM Provider)

Database: PostgreSQL (Supabase/Neon) + Prisma ORM

Auth: Clerk

Visualization: Recharts (统计图表), Three.js/R3F (3D 船舶态势 - 可选), Canvas API (2D 轨迹)

阶段一：数据底座与基础设施 (Infrastructure & Data Layer)

模块 1.1：数据库架构设计 (Schema Design)

开发需求：
使用 Prisma 定义数据模型，需涵盖用户档案、仿真记录、任务进度及伦理日志。

核心模型定义 (Schema Requirements)：

UserProfile: 扩展 Clerk 的用户表，存储 studentId, classId, tech_score (技术分), ethics_score (伦理分)。

Mission (关卡): 包含 id, title, difficulty, unlock_criteria (解锁所需分数), sea_state_config (海况配置 JSON)。

UserProgress: 关联 User 和 Mission，记录 status (LOCKED/UNLOCKED/COMPLETED), best_score。

SimulationLog: 记录单次仿真的完整数据。

Fields: input_params (PID参数/K/T值 JSON), metrics (ACTE, 能量消耗, 舵机磨损), trajectory_data (压缩后的时序数据), is_ethical_violation (Boolean)。

EthicalLog: 专门记录违规行为。

Fields: violation_type (e.g., "OVERSPEED", "UNSTABLE"), ai_critique (AI给出的批评), student_justification (学生整改理由)。

验收标准 (Acceptance Criteria)：

[ ] Prisma schema 文件编译通过，成功 push 到数据库。

[ ] 能够通过 Server Action 创建一条包含 JSON 数据的仿真记录。

[ ] 能够关联查询某位学生的所有伦理违规记录。

模块 1.2：身份验证与状态同步 (Auth & Sync)

开发需求：
集成 Clerk，并利用 Webhook 机制在用户注册时同步创建 UserProfile。

验收标准：

[ ] 用户通过 Clerk 登录后，系统能自动读取或初始化 Postgres 中的用户档案。

[ ] 路由中间件 (Middleware) 正确拦截未登录访问  /simulation 路径。

阶段二：仿真引擎与 AI Agent 核心 (Core Simulation & Agent)

模块 2.1：仿真引擎重构与 Hook 化 (Simulation Engine)

开发需求：
将现有的 Nomoto 模型和物理计算逻辑封装为可复用的 React Hook useShipSimulation。

功能逻辑：

Input: 接收 Kp, Ki, Kd, TargetHeading, SeaState 作为参数。

Loop: 使用 requestAnimationFrame 运行物理步进 (Step)。

Monitor: 在每一步计算中，实时检查以下指标：

max_rudder_rate (舵角速度)

energy_consumption (能耗积分)

cross_track_error (航迹误差)

Output: 返回实时状态对象和控制函数 start(), pause(), reset()。

验收标准：

[ ] 仿真循环在后台标签页不卡顿（考虑 Web Worker 优化）。

[ ] 提供 onStep 回调，用于前端图表实时更新。

[ ] 提供 onComplete 回调，自动触发数据上传 Server Action。

模块 2.2：AI Copilot (虚拟总工) 集成 (AI Agent)

开发需求：
基于 Vercel AI SDK (useChat, useAssistant) 开发具备 Function Calling 能力的 AI 助手。

Prompt System:
设定 System Prompt 为：“你是由中船重工指派的虚拟总工程师。你拥有查看仿真器状态和修改参数的权限。你需要根据 CCS 规范审核学生的设计。”

Tool/Function Definitions (工具定义):

get_simulation_status: 获取当前仿真器的 K, T, 海况, 误差值。

set_simulation_params: 允许 AI 直接修改 PID 参数或环境参数（需前端确认）。

analyze_result: 接收仿真结果 JSON，结合知识库进行点评。

验收标准：

[ ] 聊天窗口能流畅对话。

[ ] 当用户输入“把海况设为5级”，AI 能自动调用 set_simulation_params，且仿真器参数实际发生变化。

[ ] AI 能读取到当前的仿真结果并给出具体的数值分析（如：“你的超调量为 25%，超过了标准”）。

阶段三：教学逻辑与伦理熔断 (Pedagogy & Ethics)

模块 3.1：伦理熔断触发器 (Ethical Kill-switch)

开发需求：
在 useShipSimulation 中植入“中间件”逻辑，用于强制中断仿真。

逻辑流程：

定义阈值常量：MAX_RUDDER_RATE = 5.0 deg/s, MAX_ROLL_ANGLE = 15 deg。

在物理步进中判断：如果当前值 > 阈值，立即调用 pause()。

触发全局状态 setIsEthicalViolation(true)。

UI 层面弹出全屏红色模态框 (Dialog)，内容包含：

违规类型（如：舵机过载）。

AI 自动生成的风险后果描述（如：可能导致液压系统爆裂）。

强制输入框：“请输入整改方案”。

验收标准：

[ ] 当仿真数据触碰红线时，画面立即停止并变红。

[ ] 学生不提交整改方案无法关闭弹窗。

[ ] 违规事件成功写入数据库 EthicalLog 表。

模块 3.2：逆向反推沙箱 (Reverse Design Sandbox)

开发需求：
开发一个新的视图模式，从“设置参数”转变为“设定目标”。

UI/交互设计：

目标绘制器: 在 Canvas 绘图区，允许用户拖拽生成一个“绿色包络线通道” (Target Envelope)。

AI 辅助寻优: 增加“AI 推荐参数”按钮。点击后，触发 Server Action，在后端运行多次快速仿真（Monte Carlo），寻找能落入绿色通道的参数范围。

参数回填: 将 AI 推荐的参数范围回填到输入框，供学生微调。

验收标准：

[ ] 用户能在图表上直观看到期望的“目标带”。

[ ] “AI 推荐”功能能在 3秒内返回一组可行参数（建议使用简单算法估算，非大模型生成，减少延迟）。

阶段四：数据可视化与任务中台 (Dashboard & Visualization)

模块 4.1：学生能力画像 (Student Dashboard)

开发需求：
在学生个人中心使用 Recharts 绘制动态雷达图。

数据源：

技术维: 基于 UserProgress 中各关卡的最高分加权计算。

伦理维: 基于 EthicalLog 的记录数量反向计算（违规越少分越高）。

验收标准：

[ ] 雷达图包含至少5个维度：稳态精度、动态响应、鲁棒性、安全性、能耗控制。

[ ] 数据需从后端实时拉取，而非硬编码。

模块 4.2：任务链解锁系统 (Mission Chain)

开发需求：
实现基于分数的关卡解锁逻辑。

逻辑流程：

用户进入“任务大厅”页面，获取所有 Mission 列表。

前端根据 UserProgress 判断每个 Card 的状态 (Lock/Unlock)。

Server Action completeMission(score): 当仿真结束且分数 > 60 时，查找下一关 ID，并在 DB 中将其状态置为 UNLOCKED。

验收标准：

[ ] 未解锁关卡呈灰色且不可点击。

[ ] 完成关卡后，无需刷新页面，下一关自动高亮解锁（使用 React Server Components + Revalidate）。