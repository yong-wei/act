# L-2b 课程实现笔记

## 课程信息
- 课次：L-2b
- 标题：根轨迹直觉速通——极点迁移的几何感知
- 外部文档目录：`/Users/YW/JianguoYun/1教学/教学材料-课程/@自动控制原理/@新体系/notes/lessons/L-2b`
- 当前实现入口：
  - `/interactive-learning/courses/l2b-root-locus-fasttrack`
  - `/interactive-learning/courses/l2b-root-locus-fasttrack/teacher/[sessionId]`
  - `/interactive-learning/courses/l2b-root-locus-fasttrack/student/[sessionId]`

## 当前状态
- 已完成首轮可用实现，并完成一轮设计稿闭环核对与补差。

## 本次实现内容
- 建立 L-2b 课程注册骨架：
  - 新增 `src/lib/l2b-course.ts`
  - 新增 L-2b 课程入口、teacher/student 路由与 `src/features/interactive/l2b-root-locus/*`
  - 注册到 `learning-catalog`、`preset-lessons` 与 `classroom-session-route`
- 建立运行时媒体链路：
  - 5 个 `course-content/authoring/lessons/legacy/L-2b/media/raw/*.py` 支持 `--output`
  - 新增 `scripts/figures/generate_l2b_runtime_media.py`
  - 生成 `course-content/runtime/lessons/legacy/L-2b/media/*.svg`
  - 新增 `/course-runtime/[...assetPath]` 路由读取 runtime 媒体
- 落地双端同步课堂：
  - 教师端复用会话轮询、状态汇总、结束课堂回跳与 `teacher:course-sync` 广播
  - 学生端复用首次对齐、不同步提示与手动跳转、`student:l2b:state` 持久化
- 按设计补齐关键交互差异：
  - step-06 改为反馈框图认知卡，不再错误显示为根轨迹通用工作区
  - step-07 增加广播/自主语义、K=1/2/5 关键数据表与真实根轨迹 + 时域响应小图
  - step-10 增加轨迹选点信息卡
  - step-14 增加 45° 射线几何定位区与 `K = 0.5 / 1 / 2` 记录表
  - step-15 增加提示词复制、打开 AI 助手入口与前序结果回显挂点
  - step-17 增加“回到课前的三个目标”回看区和 step-13/14/15 学习链路回顾

## 与设计稿差异
- 已消除差异：
  - 运行时媒体从 `public/` 占位改为 `course-content/runtime` 实际直出，并由 `/course-runtime` 路由读取
  - step-06 已改为反馈框图认知卡，符合设计稿“开环旋钮 vs 闭环结果”意图
  - step-10/14 已补选点信息卡、45° 射线定位与记录链路
  - step-15 已补 AI 提示词复制、打开入口与三栏对比结构
  - step-17 已补目标回看与总结收束区
- 仍存在差异：
  - step-15 在“直接带 query 跳到 demo 单步页面”的验证方式下，不会带入前序步骤记录，因此三栏对比会显示“将在此对照”；按真实课堂流或 demo 内顺序操作可保留记录
  - step-06 学生端目前采用“结构图 + 认知卡”实现，没有做逐点击高亮的 SVG toast 交互
  - 教师端按设计稿应逐步解锁部分反思题/总结条目，目前仍以完整展示为主，尚未做更细粒度门控
- 有意偏离：
  - 按技能规范，学生端保留“不同步提示 + 手动跳转”，未采用设计稿中“学生自动跟随当前步骤”的表述
  - 部分媒体位以平台现有浅色精品课样式落地，优先保证移动端节奏、双端同步与结构化数据驱动，而不是逐像素复刻设计稿排版

## 媒体资源状态
- 已具备：
  - `course-content/runtime/lessons/legacy/L-2b/media/sh-01-pole-migration-locus.svg`
  - `course-content/runtime/lessons/legacy/L-2b/media/sh-02-root-locus-performance-zones.svg`
  - `course-content/runtime/lessons/legacy/L-2b/media/sh-03-root-locus-optimal-damping.svg`
  - `course-content/runtime/lessons/legacy/L-2b/media/h-04-example1-root-locus.svg`
  - `course-content/runtime/lessons/legacy/L-2b/media/h-05-example2-root-locus-crossing.svg`
- 缺失：
  - 无必须补齐的外部静态图片；知识地图与反馈框图由前端直接绘制
- 占位路径：
  - 无；本课按用户要求统一走 `course-content/runtime`

## 验证记录
- 设计稿核对：
  - 已按 `interactive-page.md` 对 step-06/07/10/14/15/17 做“设计稿 vs 实现稿”闭环复核，并补齐高价值差异
- 页面验证：
  - 新起 `next dev --port 3003` 后，L-2b 学生 demo 页逐步验证 step `open-close-loop`、`pole-drag-demo`、`design-map`、`verify-and-ray`、`ai-compare`、`summary`
  - 验证 `/course-runtime/lessons/legacy/L-2b/media/sh-01-pole-migration-locus.svg` 可直接返回 200 和 SVG 内容
- 测试命令：
  - `node --experimental-strip-types scripts/tests/test-l2b-course-registration.ts`
  - `node --experimental-strip-types scripts/tests/test-l2b-runtime-media.ts`
  - `node --experimental-strip-types scripts/tests/test-l2b-mobile-sync.ts`
  - `node --experimental-strip-types scripts/tests/test-l2b-runtime-route.ts`
  - `node --experimental-strip-types scripts/tests/test-l2b-workspace-features.ts`
  - `npm run lint`
  - `npm run test`
  - `npm run build`
- 结果：
  - 上述命令全部通过；`build` 期间出现若干既有 API route 的 `Dynamic server usage` 提示，但最终构建成功并退出 0

## 下次优化建议
- 为 step-06 增加逐点击高亮与 toast 弹层，进一步贴近设计稿
- 为教师端补齐 step-15 反思问题逐条解锁、step-17 总结逐条揭示的细粒度门控
- 如果后续需要更强的设计贴合度，可继续细化知识地图为真正的节点状态图，而不是文本型精品课卡片
## 2026-03-12 二次修正
- 修正 step-06 反馈框图布局：底部 `[H(s)] 反馈传感器` 与反馈回路线重新对齐，不再出现错位。
- 为 5 个 L-2b 绘图脚本新增系统中文字体配置模块 `matplotlib_font.py`，统一使用系统 CJK 字体并继续以 SVG 轮廓方式导出。
- 清理系统字体缺失字符：将 `✓` 与 `₁/₂` 替换为兼容文本，避免重新生成时出现缺字警告。
- 重新生成 `course-content/runtime/lessons/legacy/L-2b/media/*.svg` 并完成浏览器抽查。

## 2026-03-12 交互原则补齐
- 按最新技能原则补齐教师端互动汇总：
  - 选择题统一显示选项统计
  - 有标准答案的题目支持教师端“显示答案/隐藏答案”，学生端同步看到正确答案
  - 文本题统一生成轻量词云，并在下方提供默认折叠、按提交时间排序的学生回复列表
- step-15 AI 助手从跳转独立 `/ai` 页面改为课程页内对话框弹出，避免再依赖旧助手页。
- step-07 教师端“学生自主模式”切换补上状态反馈，并通过持续同步 `teacher:course-sync` 让学生端在放权后真正解除只读拖动。
- step-14 45° 射线改为只受显式开关控制，移除步骤级强制常显逻辑。
- 教师端“当前在线学生”改为默认折叠，仅显示人数摘要，展开后再看名单。

## 2026-03-12 本轮验证与部署
- 新增并通过：
  - `npx --yes tsx scripts/tests/test-interactive-lesson-skill.ts`
  - `npx --yes tsx scripts/tests/test-l2b-interaction-principles.ts`
  - `npx --yes tsx scripts/tests/test-l2b-mobile-sync.ts`
  - `npx --yes tsx scripts/tests/test-l2b-workspace-features.ts`
- 仓库级验证：
  - `npm run lint`
  - `npm run test`
  - `npm run build`
- 部署：
  - 执行 `bash scripts/remote-deploy.sh --skip-build`
  - 部署脚本最终因应用启动初期的瞬时 Prisma `P1001` 日志误判失败退出，但容器随后已正常就绪
  - 实际验收已通过：
    - `https://act.adapt-learn.online/` 返回 200
    - `https://act.adapt-learn.online/interactive-learning/courses/l2b-root-locus-fasttrack` 返回 200
    - `https://act.adapt-learn.online/course-runtime/lessons/legacy/L-2b/media/sh-01-pole-migration-locus.svg` 返回 200

## 2026-03-13 runtime 知识管线试点
- 本轮目标不是直接重写精品课页面，而是先验证 `authoring -> runtime -> 接口读取` 这条底座链路，选取 L-2b 作为试点课次。
- 已新增 `course-content/scripts/export-runtime.sh` + `course-content/scripts/export_runtime.py`：
  - 全局导出 `course-content/runtime/knowledge/graph/nodes.json`
  - 全局导出 `course-content/runtime/knowledge/graph/relations.jsonl`
  - 复制 `authoring/knowledge/cards/nodes/*.md` 到 `course-content/runtime/knowledge/cards/nodes/`
  - 复制 `content/concepts/*.mdx` 到 `course-content/runtime/knowledge/cards/concepts/` 作为兼容层
  - 为 L-2b 导出 `course-content/runtime/lessons/legacy/L-2b/lesson.json`
  - 为 L-2b 导出 `course-content/runtime/lessons/legacy/L-2b/graph-overlay.json`
  - 为 L-2b 导出 `course-content/runtime/lessons/legacy/L-2b/L-2b-handout.md`，并把讲义中的相对媒体路径改写为 `/course-runtime/lessons/legacy/L-2b/media/*`
- 接口层已完成第一轮适配：
  - `src/lib/knowledge-graph-source.ts` 改为优先读取 `course-content/runtime/knowledge/graph/*`，不再读取根目录 `data/knowledge_graph.json`
  - `src/app/api/content/mdx/route.ts` 改为支持 `content/` 与 `course-content/runtime/` 下的 `.md/.mdx`
  - 知识卡片组件改为同时支持 `content/concepts/*` 与 `course-content/runtime/knowledge/cards/*`
- 试点结论：
  - “首页全局知识图谱”与“课次局部知识结构”可以通过“全局 runtime knowledge + lesson graph overlay”两层结构同时满足
  - 新课次应继续以 `authoring/lessons/<lesson>/manifest.json` + `authoring/knowledge/cards/lessons/<lesson>/sequence.json` 为唯一编排输入
  - 讲义若要进入课程首页，运行态应保留 Markdown 原文，但在导出阶段完成媒体 URL 改写
- 本轮验证通过：
  - `bash course-content/scripts/export-runtime.sh L-2b`
  - `npx --yes tsx scripts/tests/test-runtime-knowledge-export.ts`
  - `npx --yes tsx scripts/tests/test-runtime-knowledge-source.ts`
  - `node --experimental-strip-types scripts/tests/test-l2b-runtime-media.ts`
  - `node --experimental-strip-types scripts/tests/test-l2b-runtime-route.ts`
  - `npm run lint`
- 仍待后续固化进技能的点：
  - export-runtime 对 `--all` 的多课次验收还未做完整回归
  - `content/concepts` 与全局节点 ID 的自动绑定规则尚未统一，只先做了兼容复制，不应在技能里过度承诺“自动语义映射”
  - L-2a / L-2b 课程页主体仍是手写配置，尚未整体切到 runtime 读取；本轮仅验证了底座与 L-2b 资源链路

## 2026-03-13 L-2b 首页 runtime 接入试点
- 本轮把 runtime 资源正式接到 L-2b 课程首页，而不是只停留在导出链路验证。
- 已新增 `src/lib/course-runtime.ts`：
  - 统一读取 `course-content/runtime/lessons/legacy/L-2b/lesson.json`
  - 统一读取 `course-content/runtime/lessons/legacy/L-2b/graph-overlay.json`
  - 统一读取 `course-content/runtime/lessons/legacy/L-2b/L-2b-handout.md`
  - 从节点卡片 Markdown 中抽取“首页”段落，作为首页点击节点后的卡片正面
- 已新增 `src/features/interactive/l2b-root-locus/entry-runtime-sections.tsx`：
  - 首页显示本课知识点网络
  - 点击节点后显示卡片正面内容
  - 通过统一知识卡框架提供 `详情 / 概览` 切换
  - 按 runtime sequence 顺序给出知识卡片预览
  - 提供讲义入口，并通过 `MdxSlide` 直接渲染 runtime handout
- 已修改 `src/app/interactive-learning/courses/l2b-root-locus-fasttrack/page.tsx` 与 `src/features/interactive/l2b-root-locus/entry-page.tsx`：
  - 课程首页入口页现在显式接收 runtime lesson bundle
  - 首页文案已明确课程包含知识点网络、知识卡片预览与讲义入口
- 本轮同时补齐 concepts 兼容映射规则：
  - `course-content/runtime/knowledge/cards/concepts/*` 已按标题匹配全局知识节点
  - 匹配成功后改为使用 `node_id` 形式命名，后续可直接按节点 ID 映射
- 待继续观察的点：
  - 首页知识图当前采用轻量 SVG 布局，满足 runtime 接线与内容展示，但还不是完整图库级可视分析器
  - 讲义预览摘要目前使用文本抽取策略，后续可按体验再微调摘要算法

## 2026-03-13 L-2b 首页与知识卡规则二次收口
- 根据最新验收意见，首页已调整为：
  - 教师入口、自由浏览、学生入口放到页面最上方
  - runtime 导学区下沉为第二层内容
  - 讲义入口移动到知识卡片预览下方
- 本课知识点网络已增加箭头关系表达：
  - 连线统一带箭头
  - 当前选中节点相邻关系显示“前置 / 后置”标签
  - 网络说明文案固定为“点击任意节点查看卡片正面内容，再用“详情”展开完整知识卡。”
- 讲义入口已改为智能体生成的简短摘要，不再直接截取原文首段。
- 讲义入口区和讲义详情区均已补 `导出 PDF` 按钮：
  - 当前采用浏览器打印导出链路
  - 会把已渲染讲义内容带入打印窗口，供用户保存为 PDF
- 知识卡片已开始按 runtime 编排插入互动页面：
  - 新增基于 runtime group 的步骤知识卡抽屉
  - 学生页与教师页都会根据当前 step 决定是否显示入口
  - 无知识卡的步骤不渲染抽屉
  - 由于 L-2b runtime 仍保留旧 `step-01...step-17` 占位编号，当前通过“顺序映射到真实 step id”适配；后续更推荐直接在 runtime 中使用真实互动步骤 ID
- 深浅色模式适配：
  - 首页 runtime 模块与讲义弹窗已改为使用主题语义色与 `dark:` 适配
  - `KnowledgeCard` 组件已补基础主题切换，不再强制固定深色卡面

## 2026-03-13 知识卡统一框架继续收口
- 知识卡片渲染机制已从“首页单独正面渲染 + 抽屉单独详情渲染”收敛为统一组件：
  - 对 `course-content/runtime/knowledge/cards/nodes/*.md` 统一解析 `## 首页` 与 `## 详情`
  - 仅展示 `## 首页` 内容作为正面
  - 不再显示 `## 首页` 前的 frontmatter/basic info
  - 通过卡片内 `详情 / 概览` 按钮切换内容视图，卡片标题保持不变
  - 内容区域支持滚动
- 首页选中节点卡片与步骤知识卡抽屉现在都复用同一张 `KnowledgeCard` 组件。
- 步骤知识卡入口已进一步收敛：
  - 不再在正文中单独占一块说明区
  - 统一挂到页面顶部标题模块右上角
  - 按钮文案统一为“知识卡片”
  - 抽屉标题统一为“页面知识卡片”
  - 抽屉说明统一为“当前页面相关的知识卡片”
- 进一步细化统一渲染约束：
  - 卡片内部的视图状态不再拼接到标题文本中
  - 首页提示文案与卡片按钮都统一使用 `详情 / 概览`
  - 步骤页入口由 kicker 行移到标题区右上角，更贴合“页面标题模块右上角”的规范
- 知识图谱箭头终点已从节点中心改为节点边缘，避免箭头头部被圆点遮挡。

## 2026-03-13 深浅主题框架收口
- 本轮把 L-2b 首页、学生页、教师页、步骤面板与工作区剩余的硬编码颜色继续收口到统一主题语义类：
  - 不再在课程模块里新增 `dark:`、十六进制色或 `bg-white / text-slate-* / border-cyan-*` 这类旧色阶类
  - 首页入口页也切入精品课主题壳层，改为与课程内页共用一套深浅主题变量
  - 首页 runtime 模块、步骤页面板、工作区提示卡、教师端汇总都改走统一 tone/panel/action 语义类
- 生产态浏览器抽查：
  - 深色模式下，首页与 `student/demo?step=verify-and-ray` 已无“深底深字”或突兀浅色块
  - 浅色模式下，页面仍保持高对比与轻量浅色填充，不受本轮收口影响
- 新增回归约束：
  - `scripts/tests/test-l2b-theme-no-hardcoded-styles.ts`
  - 该测试用于防止后续在 L-2b 继续回退到散写颜色的实现方式
