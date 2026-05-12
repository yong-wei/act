# 课外展示脚本对齐工作交接文档（2026-03-01）

## 1. 当前任务与约束
- 用户目标：基于 `docs/ExtraCurricularScript.md`，结合平台当前实现，完成
  - 脚本所需展示元素的 Gap 分析
  - 平台功能实现计划设计（优先复用既有基础设施）
  - 待用户审核方案通过后再执行改造
- 关键约束：
  - 优先改前端页面满足展示镜头
  - 后端优先扩展已有接口
  - 允许为新数据类型扩表
  - 需要填充 `data/test_students.md` 中全部学生数据
  - 脚本重点演示账号：`20230010102608`、`20230010102605`

## 2. 脚本关键平台镜头清单（P-01 ~ P-13）
来源：`docs/ExtraCurricularScript.md` 附录C。

- P-01~P-04：知识图谱（全局、关系筛选、节点聚焦、跨域映射）
- P-05：学情画像（五维雷达）
- P-06~P-08：自适应推题（推荐逻辑流程 + 学生A/B题单）
- P-09：教师端班级学情热力图
- P-10：BOPPPS Step2 个性化目标
- P-11：能力追踪（课前 vs 课后）
- P-12：课后推荐（个性化补强路径）
- P-13：控制奥德赛（关卡总览/失败后AI建议/积分逻辑）

## 3. 已完成现状勘查结论

### 3.1 已具备（可复用）
- 知识图谱主链路已可用：
  - 页面：`/knowledge`（`src/features/knowledge/knowledge-graph-system.tsx`）
  - 支持关系类型筛选、关系强度阈值、2D/3D、节点详情
  - 数据源支持文件回退（`data/knowledge_graph.json` + `data/relations.jsonl`）
  - 当前节点数实测：`612`
- BOPPPS邮轮课堂已有教师/学生双视图：
  - `src/features/interactive/cruise-classroom/teacher-page.tsx`
  - `src/features/interactive/cruise-classroom/student-page.tsx`
  - 已有“个性化目标、快速前测、课堂洞察”基本链路
  - 会话状态复用 `StudentState`（`/api/session/[sessionId]/state`）
- 控制奥德赛已具备关键能力：
  - 15级关卡：`src/resources/interactive-learning/control-odyssey/level-data.ts`
  - 商店与积分、控制器解锁/升级：`src/app/actions/control-odyssey.ts`
  - 失败后可用积分兑换AI建议（20积分）

### 3.2 部分具备（需扩展）
- 学情/推题能力存在两条线，但尚未统一为“可持久化演示链路”：
  - `assessment/adaptive-practice` 与 `evaluation/prompt-assessment` 页面有较完整演示UI
  - 但核心引擎使用内存态 store（非数据库持久化）
  - 当前无法稳定支撑“指定学生A/B长期可复现展示数据”
- 邮轮课堂教师端已有“能力统计条形图”，但没有“班级热力图网格（雷达小卡片）”
- 学生端总结已有“个人洞察”，但缺少“课前vs课后雷达对比 + 补强路径卡片”专门页面/接口

### 3.3 缺口（主要Gap）
- G1：缺统一“课外展示模式（showcase）”页面与可截图路由
- G2：缺持久化的学情画像快照与推荐结果存储模型（目前多为即时计算/内存）
- G3：缺“班级热力图”与“A/B指定学生对比题单”的稳定数据接口
- G4：缺“能力追踪（pre/post）”与“个性化补强路径”的数据闭环
- G5：测试学生数据基本为空，无法直接支撑脚本镜头

## 4. 数据库现状（已核验）
- `data/test_students.md` 共 31 个账号（含 `demo`）
- 实测：
  - 31/31 均已存在 `User + StudentProfile`（无缺失）
  - 但 31 人几乎全是“空画像”：
    - `classId` 全空（31）
    - `techScore=0`（31）
    - `ethicsScore=100`（31）
    - `controlCredits=0`（30，`demo` 例外）
    - `controlUnlocks`/`controlControllerLevels`/`controlOdysseyProgress` 基本空（30）
- 全库计数（关键）：
  - `abilityAssessments=0`
  - `designSessions=0`
  - `promptAssessments=0`
  - `learningProfiles=0`
  - `learningPaths=0`

## 5. 建议目标拆解（执行前）
- T1：不破坏现有主流程前提下，新增“课外展示专用数据层 + 页面层”
- T2：通过最小扩展实现 P-01~P-13 镜头可稳定截取
- T3：为 31 名测试学生批量填充可展示数据（含班级归属、画像、推题、追踪、补强、奥德赛）
- T4：对重点账号 `20230010102608` 与 `20230010102605` 提供“高对比度演示样本”

## 6. 推荐技术路径（高层）
- 前端：
  - 基于现有页面新增 `showcase` 视图层（不改业务主入口）
  - 优先复用：
    - 知识图谱组件
    - 邮轮课堂教师/学生页面中的已存在卡片/统计组件
    - Adaptive Practice / Prompt Assessment 可视模块
- 后端：
  - 在现有 `api/assessment`、`api/evaluation`、`api/user/profile`、`api/session` 能力上扩展
  - 新增展示聚合接口，减少前端拼装复杂度
- 数据：
  - 新增“展示友好”的结构化表（建议）
    - 学生能力快照（pre/post）
    - 推荐题单快照
    - 补强路径快照
    - 班级热力图聚合缓存（可选）
  - 编写一次性 seed 脚本，填充 31 名测试学生

## 7. 建议的实施顺序（待用户批准后执行）
- S1：先落“数据模型 + seed脚本”
- S2：再补“接口层（查询/聚合）”
- S3：最后改“展示页面（showcase镜头）”
- S4：联调与验收（按 P-01~P-13 checklist）

## 8. 待执行前确认点
- 当前阶段用户要求：先提交整体方案审核，不执行改造。
- 因此下一步输出应为：
  - 逐项 Gap 表（P-01~P-13）
  - 分阶段实现计划
  - 具体改动清单（前端/后端/数据/测试）
  - 风险与回滚方案

## 9. 用户审核结论（已确认）
- 不采用一次性/旁路展示表，改为“直接扩充主表/主链路能力”，确保后续真实学生导入后可直接使用。
- 功能入口要求：
  - 在平台正常业务路径中有合理入口（教师端/学生端对应位置）
  - 在评审入口路由下新增“展示聚合入口”，用于快速审看与截图

## 10. 方案调整要点（基于审核意见）
- 数据模型：优先在现有主业务模型上扩展字段与关联（必要时新增主业务子表），避免临时展示专用结构。
- 接口策略：扩展现有 API 能力为主，新增接口仅用于聚合查询，不做一次性专用接口。
- 前端策略：
  - 正常路径承载真实可用功能
  - 评审入口只做导航聚合与快速跳转，不承载“仅评审可见”的独占逻辑
