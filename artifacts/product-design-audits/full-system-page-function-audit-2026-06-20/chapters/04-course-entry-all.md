# 互动课程入口全集审计续篇

日期：2026-06-20
范围：`/interactive-learning/courses/*` 下 29 个课程入口页。
用户状态：`demo` 学生登录态。
截图证据：`screenshots/23-course-entry-all/`。
采集清单：`screenshots/course-entry-all-manifest.json`。

## 1. 覆盖范围

本轮从 `src/app/interactive-learning/courses/*/page.tsx` 真实目录生成 29 个入口路由，采集桌面 1440x1000 与移动 390x844 首屏，共 58 张截图。

结果：

- 29 个入口路由全部返回 200。
- 桌面与移动截图均落盘，无缺失。
- 覆盖 `cruise-comfort-boppps`、1-1、1-2、2-1 至 5-6 的全部课程入口。

## 2. 用户使用顺序

学生从课程目录进入具体课程入口时，页面应先回答四个问题：

1. 这门课解决什么学习目标。
2. 我需要投入多久、包含多少互动内容。
3. 我现在应该以课堂、学生自学还是教师投屏方式进入。
4. 进入前有哪些知识路径、单元路线或 BOPPPS 阶段需要预期。

当前课程入口页大体遵守这个顺序：顶部显示课次与摘要，中部显示预计时长、互动内容、互动模块，下方展开单元路线与 BOPPPS 学习路径。`cruise-comfort-boppps` 还把教师创建课堂、学生课堂码加入、自学浏览分开说明，是全入口族中较清楚的样本。

## 3. 桌面端观察

证据：

- `screenshots/23-course-entry-all/desktop-interactive-learning-courses-cruise-comfort-boppps.png`
- `screenshots/23-course-entry-all/desktop-interactive-learning-courses-unit-2-1-modeling-language.png`
- `screenshots/23-course-entry-all/desktop-interactive-learning-courses-unit-5-4-data-driven-mpc-transition.png`

健康度：良好。

观察：

- 桌面端信息架构稳定：左侧全局导航、顶部面包屑、课程标题、统计卡、单元路线、BOPPPS 阶段形成一致模板。
- 大多数课程标题和摘要能在首屏完整表达主题，学生能判断课程对象与学习范围。
- 统计卡和路径卡使用一致组件，跨课次认知成本低。

问题：

- P2：同一模板在多数课程入口中缺少“下一步主按钮”的第一优先级。用户知道课程结构，但不总是第一眼知道“现在点击哪里开始”。
- P2：桌面右下控灵入口在部分课程入口仍靠近内容卡下缘，虽然遮挡不严重，但会干扰 BOPPPS 列表末端。
- P2：课程摘要和标签质量不均，部分课程偏教学大纲语气，缺少学生视角的任务导向。

建议：

- 每个课程入口首屏应固定一个主行动区：加入课堂、继续学习或自学预览，不要只在路径说明中隐含入口。
- 课程摘要应统一为“对象 + 控制问题 + 本课产出”，减少抽象术语堆叠。
- 桌面控灵入口与长列表底部保持统一 safe area。

## 4. 移动端观察

证据：

- `screenshots/23-course-entry-all/mobile-interactive-learning-courses-unit-2-1-modeling-language.png`
- `screenshots/23-course-entry-all/mobile-interactive-learning-courses-unit-5-4-data-driven-mpc-transition.png`
- `screenshots/23-course-entry-all/mobile-interactive-learning-courses-cruise-comfort-boppps.png`

健康度：中等。

观察：

- 移动端课程主标题、课次编号、摘要和统计卡可读。
- 课程入口模板在 29 个页面间保持一致，没有出现空白页、错误页或登录页误跳转。
- 学生身份、课程总览返回按钮和主题切换入口稳定存在。

问题：

- P1：移动端顶部面包屑和标题栏普遍截断。5-4、2-1 等页面只能看到部分课程标题，用户需要进入正文卡片才能确认完整名称。
- P1：全局导航占据首屏较大高度，课程核心信息下移；在课程入口页这个任务场景中，学生更需要先看到课程目标与开始动作。
- P1：底部控灵和工具浮层覆盖统计卡或后续内容入口，29 个入口页均存在同类风险。
- P2：移动端统计卡纵向排列后，课程路径和 BOPPPS 阶段通常不在首屏内，学生第一眼只能看到“时长/页数/模块数”，还看不到学习路线。

建议：

- 课程入口移动端应默认折叠全局导航，只保留当前课程、返回课程总览和主要开始动作。
- 顶部标题栏应允许两行标题，或在面包屑截断时保留完整当前课次标题。
- 将“进入路径”或“开始/继续”卡前置到统计卡之前，学生先行动，再看完整结构。
- 全局浮层在课程入口页应采用 bottom safe area，或合并为页面内工具按钮。

## 5. 入口族横向结论

1. 已证明 29 个课程入口在学生登录态下均可访问，基础路由健康。
2. 桌面端统一性较好，适合作为后续课程运行态的外层认知入口。
3. 移动端共性问题集中在三处：标题截断、导航占高、浮层遮挡。
4. 入口页已经具备课程结构说明，但“下一步动作”在首屏优先级不够。
5. 后续审计课程学生运行态、教师等待页和教师运行态时，应沿用同一 29 课次矩阵，并把入口页问题作为对照项。
