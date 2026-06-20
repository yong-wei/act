# 互动课程学生运行态全集审计续篇

日期：2026-06-20
范围：29 个 `/interactive-learning/courses/*/student/demo` 学生运行态页面。
用户状态：`demo` 学生登录态，`sessionId=demo` 演示模式。
截图证据：`screenshots/24-course-student-runtime-demo-all/`。
采集清单：`screenshots/course-student-runtime-demo-all-manifest.json`。

## 1. 覆盖范围

本轮从 29 个课程目录派生学生运行态路径，采集桌面 1440x1000 与移动 390x844 首屏，共 58 张截图。

结果：

- 29 个学生运行态路由全部返回 200。
- 桌面与移动截图均落盘，无缺失。
- 覆盖 `cruise-comfort-boppps`、1-1、1-2、2-1 至 5-6 的全部学生 demo 运行态。

## 2. 用户使用顺序

学生从课程入口进入运行态后，页面应先回答：

1. 当前是演示、自学还是真实课堂状态。
2. 当前在哪个环节、哪一页。
3. 当前页要完成什么学习动作。
4. 如何切换页面、继续提交或返回课程。

当前运行态整体顺序较稳定：顶部有返回、环节选择、页码和翻页按钮；正文先显示 demo 状态，再显示当前页标题、任务说明和内容卡。

## 3. 桌面端观察

证据：

- `screenshots/24-course-student-runtime-demo-all/desktop-interactive-learning-courses-unit-3-3-root-locus-rules-student-demo.png`
- `screenshots/24-course-student-runtime-demo-all/desktop-interactive-learning-courses-unit-5-6-method-comparison-cold-chain-student-demo.png`
- `screenshots/24-course-student-runtime-demo-all/desktop-interactive-learning-courses-cruise-comfort-boppps-student-demo.png`

健康度：良好。

观察：

- 桌面运行态在 29 门课中都能稳定渲染当前环节、当前页和正文内容。
- 顶部环节选择器和页码是清楚的课堂导航锚点。
- 内容卡、提示卡、模块地图和问题卡的视觉语言一致，学生能识别当前页任务。

问题：

- P2：顶部课程标题在长标题课次中仍被截断，学生知道当前页，却不一定能完整确认当前课程名称。
- P2：demo 状态卡占据首屏较大面积；在长期自学场景下，状态提醒应保留但不应压过学习内容。
- P2：右下控灵入口贴近内容区域，部分长页会与正文或底部操作发生视觉竞争。

建议：

- 桌面顶部标题允许 hover/tooltip 或二行展开，避免长课名完全依赖正文推断。
- demo 状态可压缩为一行状态条，或首次出现后折叠。
- 保留全局助手入口，但运行态页面应给正文末尾和底部操作留出固定避让区。

## 4. 移动端观察

证据：

- `screenshots/24-course-student-runtime-demo-all/mobile-interactive-learning-courses-cruise-comfort-boppps-student-demo.png`
- `screenshots/24-course-student-runtime-demo-all/mobile-interactive-learning-courses-unit-5-6-method-comparison-cold-chain-student-demo.png`
- `screenshots/24-course-student-runtime-demo-all/mobile-interactive-learning-courses-unit-4-1-design-task-expression-student-demo.png`

健康度：中等。

观察：

- 移动端顶部返回、环节选择、翻页和页码都可见，比课程入口页更聚焦学习动作。
- 多数课程第一页能在首屏显示当前页标题和任务说明。
- `cruise-comfort-boppps` 的移动运行态首屏较清爽，证明 runtime shell 有能力支持轻量移动学习。

问题：

- P1：底部控灵与工具浮层仍覆盖课程内容下缘，尤其是带图片、漫画或长卡片的页面。
- P1：demo 状态卡在移动端占用首屏高度，常常把真正的学习内容向下推。
- P2：环节选择器较窄，长页面标题只能显示前段，学生需要翻阅正文确认完整页名。
- P2：部分含图片页面在首屏下方被浮层压住，影响学生浏览图像和继续阅读。
- P2：运行日志显示多门含 `cover-comic.png` 的课程触发 Next LCP 提示，above-the-fold 图片需要显式加载策略或首屏资源优化。

建议：

- 移动运行态应将 demo 状态压缩为顶部短状态条，并允许关闭或折叠。
- 图片型页面和长卡片页面应为底部浮层预留 padding，避免图像内容被控灵入口遮挡。
- 环节选择器可拆为“环节 + 当前页”两行，或在选择器打开前展示完整当前页标题。
- 首屏封面图、漫画图应按是否 above-the-fold 设置 eager/loading 优先级，并避免未优化大图成为运行态首屏瓶颈。

## 5. 运行态横向结论

1. 已证明 29 个学生 demo 运行态在学生登录态下均可访问，基础路由健康。
2. 运行态比入口页更聚焦学习动作，顶部翻页和环节选择是有效导航。
3. 移动端主要风险仍是浮层遮挡和 demo 状态占高。
4. 长课程标题和长页标题在桌面与移动端都存在截断，需要统一标题展示策略。
5. 含封面漫画的运行态页面存在 LCP 优化信号，首屏视觉质量需要和加载策略一起治理。
6. 下一步应补教师等待页和教师运行态，验证同一课程矩阵在教师侧是否同样健康。
