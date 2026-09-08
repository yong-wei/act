# 图谱与路径整改证据

日期：2026-09-08。分支：`codex/graph-path-redesign`。代码基线：`f455748e1d763bea110add70f64fe9d1a506d6f8`。

## 已确认显示根因

- 旧 `graph/viewport-fit.ts` 在桌面固定预留 512px 左侧安全区。活动图谱没有该面板，导致根领域和普通领域右偏、裁切。root packing 本身已中心化。
- 旧 3D 自定义标签将 `{ state: 'missing' }` 的 richTitle 当作有效内容，进入返回 null 的 `GovernedRichText`，普通名称 fallback 没有执行。浏览器 17 个标签有正常位置与字号，但文字为空。
- 旧 3D 连线每次投影刷新为每条边采样 24 段并生成 SVG polyline；活动渲染层将改用底层 Canvas/WebGL 连线。
- 根领域的高光气泡和较小描边文字降低了名称可读性。

## 整改前的本机运行数据

通过 `readAgreedLiveCourseProjection`、`loadStagedTeachingProjection` 和 `resolveActiveEngineeringGraphAuthority` 读取并验证。

Authority 与 Teaching Projection 均绑定 `snap-b7c6992d75e8d62585f4fffe7d50752f0a4142ffb559c2c8da02195005776373`。工程侧 7,472 个对象、3,126 条关系，其中 79 条 `prerequisite`。教学侧 162 个 core nodes、139 条 ACT_TEACHING/RECOMMENDED 关系，无 REQUIRED 边；独立 prerequisite store 的候选数为 0。

共有 3,335 个 canonical 对象拥有资源绑定。79 条工程先修中，69 条有绑定前驱、62 条有绑定后继、57 条两端均有绑定。可用于真实排序回归的一条关系为 `ctkg:m4-u2u5:prerequisite:0125a1674561b7f2d140ff0a`，方向为 `ctkg:v3e-canonical-772065f42947b660c72584f3` → `ctkg:v3e-canonical-4ce9b77cff23117a65f42588`。

| 资源类型 | 总数 | 有知识绑定 | 已解析路由 | 查看器内容可用 | 未解析内容或路由 |
| --- | ---: | ---: | ---: | ---: | ---: |
| 音频 | 28 | 28 | 28 | 0 | 0 |
| 知识卡 | 971 | 423 | 0 | 874 | 97 |
| 习题 | 45 | 45 | 45 | 0 | 0 |
| 讲义 | 31 | 31 | 31 | 0 | 0 |
| 信息图 | 1396 | 289 | 0 | 1396 | 0 |
| 课程 | 32 | 31 | 32 | 0 | 0 |
| 仿真 | 97 | 80 | 96 | 0 | 1 |
| 课程步骤 | 487 | 473 | 487 | 0 | 0 |
| 教材章 | 4 | 4 | 0 | 0 | 4 |
| 教材节 | 913 | 913 | 909 | 0 | 4 |
| 教材 | 3 | 3 | 0 | 0 | 3 |
| 视频 | 31 | 31 | 31 | 0 | 0 |

合计 4,038 项资源、2,351 项有绑定，21,471 条绑定。未绑定的 1,687 项均为 OPTIONAL 且明确标记 `UNBOUND/EXPLICIT_NONE`，不得当作漏绑定自动补齐。路由解析成功仅说明地址映射成立，不等同于浏览器内容验收。

本轮 agreed live projection 为 `proj-e24d5f8886be49b1b100e154b9b5f199c121b2cecd03c81d5a9215b319ca40e8`。源路径没有本机绝对路径；838 张知识卡带 `content:<sha256>`，133 张没有 sourcePath；全部 1,396 张信息图使用已发布信息图读取合同。没有内容哈希的资源引用必须结合版本/当前身份验证，不能在投影变化后静默读取新版内容。

四个没有路由的 `cts.section-*` 是旧教材 crosswalk 的 `REFERENCE_ONLY` 条目，缺页码/真实 reader unit 映射；不能从标识猜测教材页。没有路由的仿真是 `act:simulation:control-workbench-free`。教材与章节应具备目录/参考入口，同时保持与可执行教材节的语义区别。

知识卡继续定位后的结论：971 张卡片源文件都存在，content hash 无不匹配；10 张 BOUND 卡片为 `draft-blocked`，应保持不可学习。其余 87 张不可读属于读取格式缺陷：`parseLearnerVisibleCardFields` 强制要求 `### 完整解释`，但如 `Bode图_1_1.md`、`IMC_SIMC与模型匹配整定_4_42013.md` 等合法卡片直接在 `## 详情` 下有正文。另一个可达缺陷是 `KnowledgeCard` 将含 Markdown 的 metadata.content 标记为 isMdxFormat 后跳过唯一正文分支，且没有替代渲染分支。`cleanLearningText` 的全局 `[*_#>|]` 删除还会破坏 LaTeX 下标和绝对值符号。修复应保留 draft/source-hash/内部标识边界，并让两种卡片格式和安全 Markdown/math 正常展示。

## 学习路径断点

生产链路为 `resolveAdaptivePathGenerationRegistry` → `planLearningPath` → `assembleAdaptiveLearningPathPlan` → PlanNode → 路径中心 destination contract。

基线只有四个候选源，未读取完整教学绑定。资源本地 `planningMetadata.prerequisites` 已用于递归前置展开与排序，但工程层 79 条先后修没有进入这一生产链路。独立 `planActPrerequisitePath` 的测试不能证明生产入口生效。

同一知识点的多个资源是替代/补充候选，不能互相挂为全部必须完成的前置资源。明确的工程先后修与教学编排推荐应保留不同来源及强度。

## 相关 Issue

- 初始调查快照：#2046 `path-planning-consumes-teaching-projection`，当时 act-dev2 正在实施。调查快照 HEAD `ab7ac917f5` 为未验证 WIP，11 文件、710 行新增；后续 dirty mapper、destination contract 与测试持续变化。不得修改其工作树或将该快照视为已完成。
- 初始调查快照：#2059 `consume-engineering-prerequisite-order`，当时 ready、尚无实施提交。两项后续合并结果见文末。
- #2058/#2044/#2055/#2047 已合入本分支基线。

## 环境与验证基线

主工作树安装的 Next.js 为 16.2.11，锁文件为 16.3.4；已运行 `rtk npm ci`、`rtk npx prisma generate` 同步。独立开发服务为 `http://localhost:3002`，使用受管本地学生测试账号；其他 3000/3001 服务属于其他项目/工作树。

`rtk npm run typecheck` 的 TypeScript 编译未报告错误，worker graph passed，web graph 报告既存 `production-to-documentation` / `web-includes-documentation`，涉及 3-6/4-1/4-3 作者态 JSON 和 learning-goal-assessment-coverage-matrix，不能称为完整门禁通过。

`rtk openspec validate redesign-graph-path-experience --type change --strict` 通过。图谱浏览器基线位于 `.tmp/graph-path-redesign/`；认证状态文件独立保存且不作为证据提交。

## 上游实施结果整合

调查期间 #2046 与 #2059 已关闭，提交 `d281a2eb9a`、`232c0223e8` 已整合到本分支。保留发布工件、历史归档、runtime 来源身份合并、exercise 与媒体目的地兼容修复；统一发布索引继续承担生成和修订路径的资源装配。旧全局 canonical bridge 改为显式纯查询，连续请求的目标覆盖由生产索引回归验证。直接工程顺序与已采用教学先修分别保留出处，当前资源路径不叠加两套相同顺序。
