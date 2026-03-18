导航统一化修改计划                                                                                                  
                                                                                                                     
 背景                                                                                                                
                                                                                                                     
 统一整个平台的导航交互，解决目前导航混乱的问题。

 需求分析

 第一轮需求

 1. 虚拟仿真、知识图谱、互动学习、评审入口四个页面顶部统一按虚拟仿真样式配置
 2. 右上角添加进入驾驶舱通道
 3. 去除悬浮返回首页按钮
 4. 互动课程页面、跨域探索、各章节互动组件页面采用同样样式（返回入口放左侧）
 5. 跨域探索模块、互动课程、章节列表统一导航样式
 6. 具体互动环节返回应回到章节组件清单

 第二轮需求

 1. 跨域探索三个模块统一顶部导航，修复浅色模式文本看不清问题
 2. 章节互动组件返回应回到章节内组件列表（非互动资源库）
 3. 驾驶舱进入时严格鉴定用户身份（教师只能进课堂管理页面）
 4. 7个仿真页面恢复悬浮导航，按钮文案改为"返回仿真入口"
 5. 控灵入口位置调低（不与深浅切换按钮重叠）

 探索结果汇总

 参考样式：虚拟仿真顶部导航 (SimulationTopBar)

 文件: /src/resources/simulations/components/simulation-ui.tsx
 - 样式：绝对定位 absolute left-4 right-4 top-4 z-30
 - 三栏布局：返回按钮 | 标题区 | 徽章/右侧内容
 - 毛玻璃效果 backdrop-blur-md、圆角 rounded-2xl、阴影
 - 浅色主题 bg-slate-50/90

 7个仿真页面（保持悬浮导航，修改文案）

 文件:
 - /src/app/simulations/destroyer/page.tsx
 - /src/app/simulations/cruise/page.tsx
 - /src/app/simulations/container/page.tsx
 - /src/app/simulations/lng/page.tsx
 - /src/app/simulations/icebreaker/page.tsx
 - /src/app/simulations/drilling/page.tsx
 - /src/app/simulations/dredger/page.tsx

 当前都使用 FeaturePageNav floating，需要修改文案为"返回仿真入口"

 控灵助手位置

 文件: /src/lib/ai-theme-styles.ts
 - 当前：fixed bottom-24 right-6 z-40
 - 需要调低，避免与深浅切换按钮重叠（改为 bottom-16 或 bottom-20）

 需要修改的页面清单

 ┌─────────────┬───────────────────────────────────────────────────────────────┬───────────────┬───────────────┐
 │    页面     │                           文件路径                            │   当前状态    │   修改内容    │
 ├─────────────┼───────────────────────────────────────────────────────────────┼───────────────┼───────────────┤
 │ 知识图谱    │ /src/app/knowledge/page.tsx                                   │ FeaturePageNa │ 统一导航样式  │
 │             │                                                               │ v floating    │ + 驾驶舱入口  │
 ├─────────────┼───────────────────────────────────────────────────────────────┼───────────────┼───────────────┤
 │ 评审入口    │ /src/app/review/page.tsx                                      │ FeaturePageNa │ 统一导航样式  │
 │             │                                                               │ v             │ + 驾驶舱入口  │
 ├─────────────┼───────────────────────────────────────────────────────────────┼───────────────┼───────────────┤
 │ 互动学习入  │ /src/app/interactive-learning/page.tsx                        │ 已有导航      │ 修改为统一样  │
 │ 口          │                                                               │               │ 式            │
 ├─────────────┼───────────────────────────────────────────────────────────────┼───────────────┼───────────────┤
 │ 跨域探索    │ /src/app/interactive-learning/cross-domain-exploration/page.t │ 硬编码深色    │ 统一导航 +    │
 │             │ sx                                                            │               │ 修复浅色模式  │
 ├─────────────┼───────────────────────────────────────────────────────────────┼───────────────┼───────────────┤
 │ 互动课程    │ /src/app/interactive-learning/courses/page.tsx                │ 自定义导航    │ 统一导航样式  │
 │             │                                                               │               │ + 驾驶舱入口  │
 ├─────────────┼───────────────────────────────────────────────────────────────┼───────────────┼───────────────┤
 │ 各章节组件  │ /src/app/interactive-learning/chapter-components/page.tsx     │ 硬编码深色    │ 统一导航 +    │
 │             │                                                               │               │ 修复浅色模式  │
 ├─────────────┼───────────────────────────────────────────────────────────────┼───────────────┼───────────────┤
 │ Lesson-02   │ /src/app/interactive-learning/lesson-02/page.tsx              │ 硬编码深色    │ 统一导航 +    │
 │             │                                                               │               │ 修复浅色模式  │
 └─────────────┴───────────────────────────────────────────────────────────────┴───────────────┴───────────────┘

 跨域探索的三个模块

 根据确认，跨域探索的三个模块包括：
 1. 多表征联动可视化引擎
 2. Control Odyssey
 3. 十滴水益智游戏

 需要确保这些模块页面也有统一的顶部导航。

 驾驶舱身份验证问题

 需要从 session 中正确读取 role 并路由：
 - 教师 → /teacher
 - 学生 → /dashboard

 浅色模式文本问题

 跨域探索、章节组件等页面使用硬编码 bg-slate-950 text-slate-100，需要改为支持主题切换。

 实施方案

 方案选择

 基于探索结果，我有以下两种方案可选：

 方案A：创建统一导航组件（推荐）
 - 创建 /src/components/shared/unified-top-bar.tsx
 - 基于 SimulationTopBar 样式，但支持主题切换
 - 添加 rightSlot 支持驾驶舱入口
 - 所有页面使用此组件

 方案B：修改现有 FeaturePageNav
 - 修改现有组件添加主题支持
 - 但 SimulationTopBar 样式更适合作为参考

 我推荐方案A，因为它：
 1. 保留了 SimulationTopBar 的优秀设计
 2. 添加了主题切换支持
 3. 统一了所有页面的导航体验

 详细任务列表

 任务1：创建统一顶部导航组件

 文件: /src/components/shared/unified-top-bar.tsx
 - 基于 SimulationTopBar 样式
 - 使用 CSS 变量支持主题切换
 - 添加 rightSlot 支持驾驶舱入口
 - 返回按钮支持自定义文案和链接

 任务2：修改7个仿真页面文案

 文件: 7个仿真页面的 page.tsx
 - 保持 FeaturePageNav floating
 - 修改 backLabel 从"返回上一层"为"返回仿真入口"

 任务3：修改控灵助手位置

 文件: /src/lib/ai-theme-styles.ts
 - 修改 getFloatingButtonStyles 中的 bottom-24 为 bottom-16

 任务4：修改知识图谱页面

 文件: /src/app/knowledge/page.tsx
 - 导入新导航组件
 - 替换 FeaturePageNav
 - 添加驾驶舱入口按钮

 任务5：修改评审入口页面

 文件: /src/app/review/page.tsx
 - 导入新导航组件
 - 替换 FeaturePageNav
 - 添加驾驶舱入口按钮

 任务6：修改互动学习入口

 文件: /src/app/interactive-learning/page.tsx
 - 导入新导航组件
 - 替换现有导航
 - 添加驾驶舱入口按钮

 任务7：修改跨域探索页面

 文件: /src/app/interactive-learning/cross-domain-exploration/page.tsx
 - 导入新导航组件
 - 移除硬编码深色背景
 - 使用主题变量
 - 添加驾驶舱入口按钮

 任务8：修改互动课程页面

 文件: /src/app/interactive-learning/courses/page.tsx
 - 导入新导航组件
 - 替换现有导航
 - 添加驾驶舱入口按钮

 任务9：修改各章节互动组件页面

 文件: /src/app/interactive-learning/chapter-components/page.tsx
 - 导入新导航组件
 - 移除硬编码深色背景
 - 使用主题变量
 - 添加驾驶舱入口按钮

 任务10：修改 Lesson-02 页面

 文件: /src/app/interactive-learning/lesson-02/page.tsx
 - 导入新导航组件
 - 移除硬编码深色背景
 - 使用主题变量
 - 添加驾驶舱入口按钮

 任务11：修复驾驶舱入口身份验证

 创建驾驶舱入口组件，确保：
 - 教师点击 → 跳转 /teacher
 - 学生点击 → 跳转 /dashboard
 - 未登录 → 跳转登录页

 验证清单

 - 7个仿真页面悬浮导航文案为"返回仿真入口"
 - 知识图谱页面导航统一且有驾驶舱入口
 - 评审入口页面导航统一且有驾驶舱入口
 - 互动学习入口导航统一且有驾驶舱入口
 - 跨域探索页面导航统一，浅色模式正常
 - 互动课程页面导航统一且有驾驶舱入口
 - 各章节互动组件页面导航统一，浅色模式正常
 - Lesson-02页面导航统一，浅色模式正常
 - 教师从任何页面进入驾驶舱都到 /teacher
 - 学生从任何页面进入驾驶舱都到 /dashboard
 - 控灵助手位置已调低

 关键代码参考

 SimulationTopBar 样式

 'absolute left-4 right-4 top-4 z-30 flex h-12 items-center justify-between rounded-2xl border border-slate-200/90
 bg-slate-50/90 px-3 shadow-xl shadow-slate-950/30 backdrop-blur-md'

 返回按钮样式

 'inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium
 text-slate-900 transition hover:bg-slate-100'

 控灵按钮位置

 'fixed bottom-24 right-6 z-40'  // 改为 bottom-16