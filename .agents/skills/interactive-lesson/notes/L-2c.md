# L-2c 课程实现笔记

## 课程信息
- 课次：L-2c
- 标题：频域直觉速通——Bode图与相位裕度初识
- 外部文档目录：`/Users/YW/JianguoYun/1教学/教学材料-课程/@自动控制原理/@新体系/notes/lessons/L-2c`
- 当前实现入口：
  - `/interactive-learning/courses/l2c-frequency-bode-fasttrack`
  - `/interactive-learning/courses/l2c-frequency-bode-fasttrack/teacher/[sessionId]`
  - `/interactive-learning/courses/l2c-frequency-bode-fasttrack/student/[sessionId]`

## 当前状态
- 已完成首轮可用实现，运行时资源、首页导学、教师端/学生端课堂页已打通。

## 本次实现内容
- 新增 `src/lib/l2c-course.ts`：
  - 定义 L-2c 路由段、课程标题、17 个步骤配置、媒体映射与学生状态结构
  - 课程步骤统一使用 `step-01` 到 `step-17`，与 runtime sequence 对齐，避免再走 L-2b 的旧编号兼容逻辑
- 新增 L-2c 课程注册与入口：
  - `/interactive-learning/courses/l2c-frequency-bode-fasttrack`
  - `/interactive-learning/courses/l2c-frequency-bode-fasttrack/teacher/[sessionId]`
  - `/interactive-learning/courses/l2c-frequency-bode-fasttrack/student/[sessionId]`
  - 预设课、互动课程目录与课堂码解析已完成注册
- 复用并固化共享 runtime 首页模块：
  - 新增 `src/features/interactive/shared/lesson-entry-runtime-sections.tsx`
  - L-2b 与 L-2c 首页统一使用该组件渲染知识点网络、节点卡片正面、知识卡片预览、讲义入口与 PDF 导出
- 统一 L-2c 与共享知识卡链路的主题语义类：
  - `src/app/globals.css` 新增 `premium-lesson-selectable-card` / `premium-lesson-selectable-card-active`
  - 去除 L-2c 阶段标签、首页卡片预览、步骤知识卡抽屉和 `KnowledgeCard` 中残留的旧式颜色类、固定阴影与局部浅深色分支
  - 共享知识卡按钮、徽标和数学表达区统一改回语义化 token，避免继续在课程模块中散落硬编码样式
- 新增 L-2c 课堂页专属实现：
  - `src/features/interactive/l2c-frequency-bode/entry-page.tsx`
  - `src/features/interactive/l2c-frequency-bode/course-header.tsx`
  - `src/features/interactive/l2c-frequency-bode/step-panels.tsx`
  - `src/features/interactive/l2c-frequency-bode/student-page.tsx`
  - `src/features/interactive/l2c-frequency-bode/teacher-page.tsx`
- 课堂内能力已接入：
  - 教师/学生双端步骤同步
  - 学生端首次对齐、后续不同步提示与手动跳转
  - 页内 AI 助手弹窗（step-07 / step-12）
  - 选择题统计、答案揭示、文本题词云与折叠回复列表
  - 基于 runtime sequence 的步骤知识卡抽屉
- 完善 L-2c authoring -> runtime 导出：
  - `course-content/scripts/export_runtime.py` 现支持复制 raw 目录中的静态媒体资源
  - 修复 `sh-04-phase-margin-vs-overshoot.py` 正确写入 `--output`
  - 将 `sh-00-equalizer-analogy.png` 正确导出到 `course-content/runtime/lessons/legacy/L-2c/media`
  - 补齐 `course-content/authoring/knowledge/cards/lessons/legacy/L-2c/sequence.json`，覆盖全课 17 步的知识卡编排

## 与设计稿差异
- 已消除差异：
- 首页已按统一规范放置教师入口、自由浏览、学生入口，并接入 runtime 知识图谱、卡片预览、讲义入口与 PDF 导出
- 讲义保持 runtime Markdown 原文渲染，LaTeX 与 `/course-runtime/...` 媒体路径可直接消费
- 课堂内知识卡入口已统一放到标题模块右上角，按 runtime sequence 驱动显示
- `interactive-page.md` 中 17 个环节已全部映射到课堂页步骤配置
- 仍存在差异：
- step 内部的“逐条点击揭示”目前主要用结构化内容块呈现，尚未做更细的 reveal 门控动画
- 当前未为 L-2c 单独制作专门工作区；本课按设计实际需要，仅保留讲授、测验、AI 与记录回显，不额外引入仿真操作区
- 有意偏离：
- 仍遵循平台统一规范：学生端首次对齐教师页，之后提供不同步提示和手动跳转，而不是强制自动翻页
- 首页 runtime 模块已共享化，不再为 L-2c 单独复制一份首页知识图/讲义逻辑

## 媒体资源状态
- 已具备：
- `course-content/runtime/lessons/legacy/L-2c/media/sh-00-equalizer-analogy.png`
- `course-content/runtime/lessons/legacy/L-2c/media/h-01-bode-magnitude-regions.svg`
- `course-content/runtime/lessons/legacy/L-2c/media/h-02-phase-margin-diagram.svg`
- `course-content/runtime/lessons/legacy/L-2c/media/h-03-bode-example-annotated.svg`
- `course-content/runtime/lessons/legacy/L-2c/media/sh-04-phase-margin-vs-overshoot.svg`
- `course-content/runtime/lessons/legacy/L-2c/media/sh-05-three-domain-coupling.svg`
- 缺失：
- 无强制缺失；`sh-00` 已按 authoring 原图复制到 runtime
- 占位路径：
- 无；本课统一从 `course-content/runtime` 读取

## 验证记录
- 设计稿核对：
- 已对照 `interactive-page.md`、`boppps.md`、`handout.md` 与 `multimedia.md` 收敛出 17 步课堂配置、6 个媒体资源和 5 张知识卡顺序
- 已识别并修正 authoring sequence 原先只覆盖到 `step-08` 的问题，现已补齐到全课
- 页面验证：
- `bash course-content/scripts/export-runtime.sh L-2c` 可生成 lesson bundle、handout、graph overlay 与全部媒体
- `next build` 已成功编译出：
  - `/interactive-learning/courses/l2c-frequency-bode-fasttrack`
  - `/interactive-learning/courses/l2c-frequency-bode-fasttrack/teacher/[sessionId]`
  - `/interactive-learning/courses/l2c-frequency-bode-fasttrack/student/[sessionId]`
- 浏览器验收：
  - 已实测首页知识图谱、节点卡片 `详情 / 概览` 切换、知识卡片预览与讲义弹窗
  - 已实测学生 demo 页标题右上角“知识卡片”抽屉，当前页面相关知识卡片可正常打开
  - 已实测讲义 `导出 PDF`，服务端成功生成并下载 PDF 文件
  - 已实测深色主题下首页与学生 demo 页结构正常；主题切换后知识卡和讲义入口链路可继续工作
  - 2026-03-14 追加逐页复验：已按 `student/demo?step=step-xx` 逐页检查 17 个步骤标题、媒体与关键控件；step-02 / 05 / 09 / 13 / 14 / 15 的 runtime 媒体链路均可正常加载
  - 2026-03-14 追加双端课堂复验：教师创建新课堂后，学生通过课堂码加入且未提交任何作答时，教师端“当前在线学生”现可正确显示 `1 人`
  - 2026-03-14 追加互动复验：已实测学生端前测提交、教师端选项统计/词云/回复列表、答案揭示同步、页内 AI 助手弹窗与学生端不同步提示/跳转链路
- 测试命令：
- `bash course-content/scripts/export-runtime.sh L-2c`
- `npx --yes tsx scripts/tests/test-l2c-runtime-export.ts`
- `npx --yes tsx scripts/tests/test-l2c-course-registration.ts`
- `npx --yes tsx scripts/tests/test-l2c-entry-runtime-content.ts`
- `npx --yes tsx scripts/tests/test-l2c-step-knowledge-drawer.ts`
- `npx --yes tsx scripts/tests/test-l2c-student-initial-state.ts`
- `npm run lint`
- `npm run test`
- `npm run build`
- 结果：
- 上述命令全部通过；`build` 期间仍会出现仓库既有 API route 的 `Dynamic server usage` 提示，但最终构建成功并退出 0
- 本轮新增 `test-l2c-student-initial-state.ts` 后，已修复 `L2CStudentPage` 首次进课不立即上报空状态、导致教师端在线人数在学生首次提交前显示为 `0 人` 的问题
- 额外观察：
- `next dev` 热更新期间曾出现一次 `/interactive-learning/courses/l2c-frequency-bode-fasttrack/student/[sessionId]` 静态路径加载抖动并短暂导致首页 404；随后重新编译后恢复，当前未稳定复现
- `export-runtime.sh L-2c` 仍有 Matplotlib `U+2212` 字形警告，但不影响 runtime 媒体生成与页面读取

## 下次优化建议
- 为 step-05 / step-09 / step-15 增加更细粒度的“逐次揭示”教师端门控
- 如需更贴合原讲稿，可继续补 step-07 / step-12 的 AI 探索回显结构，使其更接近“三栏对照”视觉
- 进一步清理 L-2c 绘图脚本中的字体告警，减少 Matplotlib 导出时的符号兼容提示
