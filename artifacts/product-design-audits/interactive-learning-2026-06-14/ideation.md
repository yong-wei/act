# 互动学习页面族视觉设计概念稿

日期: 2026-06-14  
流程: Product Design `/ideate`  
说明: 当前图像生成工具只能接收文字 prompt，不能把本地截图作为真实附件传入。本轮概念稿基于同目录审计截图、结构指标与源码定位结果生成。

## 生成范围

本轮按页面层级生成三张视觉概念稿:

1. 互动学习地图 / 互动课程目录: `concepts/01-learning-atlas-course-catalog.png`
2. 具体互动课程入口页: `concepts/02-course-entry-shell.png`
3. 互动课程课堂运行态: `concepts/03-lesson-runtime-shell.png`

## 共同设计约束

- 统一平台 AppShell。
- 左侧导航默认收起为 72px 图标栏。
- 多层页面显示顶部面包屑。
- 右下角保留统一控灵助手 dock。
- 不继续扩散 `premium-lesson-*` 局部壳层。
- 宽屏内容使用流体工作区，不再整页固定居中窄容器。
- 深浅主题要能沿同一 token 体系扩展。
- 不使用 emoji，不做营销式 hero，不做卡片套卡片。

## 概念稿 1: 学习地图与课程目录

目标页面:

- `/interactive-learning`
- `/interactive-learning/courses`

视觉重点:

- 用课程路径、模块进度、学习方式和证据状态组织目录。
- 左侧为平台折叠导航，顶部为 `首页 / 互动学习 / 互动课程`。
- 主区使用模块化表格/列表，右侧显示学习状态、证据提交和近期待办。
- 目录页不再是纵向卡片堆叠，而是成熟学习工作台。

## 概念稿 2: 具体课程入口

目标页面:

- `/interactive-learning/courses/unit-1-1-see-the-full-picture`
- 其他所有 `unit-*` 课程入口页。

视觉重点:

- 将教师开课、学生加入、演示浏览和自学资料安排在同一统一课程入口框架内。
- 用课程身份、BOPPPS 结构、单元路径、资源清单和学习准备度替代独立浅蓝课程壳层。
- 右侧是明确的进入方式与资源面板，主区是课程概览和单元学习路径。

## 概念稿 3: 课堂运行态

目标页面:

- `/interactive-learning/courses/*/student/[sessionId]`
- `/interactive-learning/courses/*/teacher/[sessionId]`

视觉重点:

- 投影友好: 当前页标题、BOPPPS 阶段、任务、主图和互动按钮清晰可见。
- 顶部仍保留平台路径，但压缩为课堂可用的步骤栏。
- 主区域优先显示当前互动页的图形/任务，右侧承载知识卡片、提交统计、证据状态和控灵上下文。
- 底部或局部命令条承载上一页/下一页和阶段进度。

状态: 已被后续修订稿覆盖。后续提案和实现不得沿用此处关于右侧承载提交统计、证据状态或控灵上下文的早期描述；学生/访客以 `concepts/revised/03-student-guest-runtime.png` 为准，教师投影以 `concepts/revised/06-teacher-projection-runtime-compact-navigation.png` 为准。

## 后续使用

若进入 OpenSpec 提案，建议将这三张概念稿作为视觉目标引用，但不要把图片细节当作逐像素实现合同。真正的实现合同应转写为:

- 壳层与导航规则
- 页面布局区域
- 组件视觉状态
- 深浅主题 token
- 投影模式验收
- 响应式断点
- 控灵 dock 上下文接入

## 修订稿

用户反馈后，本轮补充六张修订稿，优先作为后续设计真源使用:

1. 课程目录修订: `concepts/revised/01-course-catalog-theory-practice.png`
   - 课堂类型只保留 `理论课` 与 `实践课`。
   - 课堂时长以 runtime 运行时记录为元数据。
   - 控灵助手保持右下统一浮动 dock，不进入右侧栏。

2. 教师创建课堂等待页: `concepts/revised/02-teacher-classroom-qr-waiting.png`
   - 显示课堂二维码、课堂码、加入学生人数统计。
   - 教师点击 `开始上课` 后进入具体课程运行态。

3. 学生/访客运行态: `concepts/revised/03-student-guest-runtime.png`
   - 学生端与访客演示端内容基本一致。
   - 不显示教师端提交概况、证据状态或班级统计。
   - 保留学生/访客当前互动作答区域。

4. 教师投影运行态: `concepts/revised/04-teacher-projection-runtime.png`
   - 课程内容和主要互动题面占据主体。
   - 不显示学生答案提交框。
   - 提交概览、逐步显示、图形互动等控制附着到对应互动模块，而不是集中放在侧边栏。

5. 教师投影运行态二次修订: `concepts/revised/05-teacher-projection-runtime-collapsed-tools.png`
   - 作为教师投影运行态的优先视觉方向，覆盖第 4 张教师投影稿中右侧区域仍显得过重的问题。
   - 授课内容完全占据页面主体，主图、题面和互动模块是首要视觉层级。
   - 右侧工具默认收起为窄图标列，按需展开；不采用旧式常开抽屉或永久右侧面板。
   - 边栏采用响应式设计: 桌面为可展开/收起的工具列，小屏下转为显式触发的底部或浮层命令面。
   - 提交概览、逐步显示、参考答案和图形互动控制继续附着在每个互动模块上，避免把多互动页面的控制集中到全局侧栏。

6. 教师投影运行态三次修订: `concepts/revised/06-teacher-projection-runtime-compact-navigation.png`
   - 作为教师投影运行态的当前优先稿，继承第 5 张的主体内容和右侧工具收起策略。
   - 下方课程内导航缩小为轻量底栏，不侵占主教学画面。
   - 顶部取消 `下一页` 动作，避免和底部导航重复。
   - 底部导航包含上一页、BOPPPS 阶段指示、页码快速跳转下拉菜单、页数状态和下一页。
   - 控灵浮窗使用平台其他页面一致的右下浮动 dock，不并入右侧工具列或课程面板。
