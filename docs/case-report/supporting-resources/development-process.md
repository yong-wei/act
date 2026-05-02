# 开发流程文档

## 1. 需求分析

开发从课程真实问题出发：学生难以把控制理论公式与工程对象联系起来，教师难以及时获得过程性学情，通用 AI 工具缺少课程上下文。通过生成式 AI 辅助梳理后，系统确定三类用户：学生、教师、管理员；五类核心场景：互动课堂、虚拟仿真、AI 辅导、能力画像、教学管理。

## 2. 总体设计

系统采用单体 Web 应用加数值内核的结构：

- 前端与服务端：Next.js 14、TypeScript。
- 数据层：PostgreSQL、Prisma。
- 仿真内核：Rust/WASM。
- 可视化：Three.js、React Three Fiber、Recharts。
- AI 服务：Vercel AI SDK 接入 SiliconFlow API，默认模型为 deepseek-ai/DeepSeek-V4-Flash。
- 验证工具：Vitest、Playwright、ESLint、Next.js build。

核心数据流为：课堂与仿真事件进入 `/api/interactive/events`，先记录到 InteractionLog，再规范化为 LearningEvent，高价值事件沉淀为 LearningFact，后续生成 StudentCompetencySnapshot 与教师侧班级分析。

## 3. 模块开发步骤

1. 课程运行时：建立 DB BOPPPS 教案、TeachingResource 资源注册、ClassSession 会话同步。
2. 精品互动课：为每个课次准备课程入口、学生页、教师页、步骤级活动、知识卡片和 AI 上下文。
3. 虚拟仿真：将船舶模型实时步进统一迁入 Rust/WASM，前端只保留状态展示和用户交互。
4. AI 助手：编写系统提示词和工具调用，支持读取仿真状态、参数建议、结果分析和建模检查。
5. 数据治理：设计事件协议、学习事实、能力画像和推荐引擎。
6. 教师分析：将学生画像聚合成班级分布、风险提示和个体诊断。
7. 管理后台：提供用户管理、系统使用量统计和数据治理状态查看。

## 4. 可复现流程

若复现本系统的关键思路，可以按以下顺序执行：

1. 明确课程目标和具体工程场景。
2. 将课程活动拆成“前测、讲解、操作、提交、反馈、总结”步骤。
3. 设计统一事件字段：用户、课程、课次、页面、动作、时间、载荷。
4. 建立学习事实表，将题目、仿真、AI 互动、伦理约束等行为映射到能力维度。
5. 接入大模型服务，先限定系统提示词，再开放工具调用。
6. 编写最小仿真模型或调用已有数值内核，确保结果可复现。
7. 用测试和录屏验证课堂流程、AI 反馈、画像生成与教师看板。

## 5. 验证方式

- 代码质量：`npm run lint`。
- 单元测试：`npm run test` 或定向 `npx vitest run <test-file>`。
- 构建验证：`npm run build`。
- 浏览器验证：Playwright 录制课程入口、仿真页和教师/学生课堂流程。
- 数值内核验证：Rust `cargo test` 与 WASM 构建验证。
