## 1. 外壳与治理

- [x] 1.1 `InteractiveLearningShell` 增加 `fillViewport` 透传，并为 PID 仿真器与控制理论地图登记面包屑
- [x] 1.2 两个 `page.tsx` 直接渲染 `InteractiveLearningShell`；控制理论地图的加载占位改用 token
- [x] 1.3 `platform-appshell-contract.ts` 删除两条 `legacy-demo-only` 豁免，并把路由加入 `InteractiveLearningShell.routeFamilies`

## 2. PID 控制仿真器

- [x] 2.1 用 `simulation-panels` 构件与 Slider 重写控制区；用仿真时长替代步长与时间倍率
- [x] 2.2 运行时就绪后自动预览，参数变化防抖刷新；预览不触发回调
- [x] 2.3 展示超调量、稳态误差、终值读数，以及发散判定与纵轴钳制
- [x] 2.4 Recharts 图表使用平台图表 token；运行时失败显示中性提示
- [x] 2.5 仅在传入回调时显示“记录本次结果”，载荷与原运行结果一致

## 3. 控制理论地图

- [x] 3.1 区域色改为平台 token；节点、图例、小地图、侧栏共用
- [x] 3.2 节点、连线、背景、控件与小地图使用 token；非关联连线在聚焦时降低透明度
- [x] 3.3 筛选组至少保留一项；搜索命中计数、无命中提示、回车定位；Esc 关闭侧栏
- [x] 3.4 工具栏、图例、提示改为画布内浮层，适配 `fillViewport`

## 4. 控制工作台

- [x] 4.1 标题行去重，删除与证据状态重复的说明段，改写挑战说明与支持说明
- [x] 4.2 经典预设容器改用 token，并在工作台范围映射精品课主题变量
- [x] 4.3 `describeExperienceLaunch` 与提交状态文案去除内部用语，同步合同测试

## 5. 验证

- [x] 5.1 新增或更新单测：PID 预览与记录语义、发散判定、地图筛选与搜索、外壳覆盖与豁免
- [x] 5.2 typecheck、lint、相关 vitest、build；提交后运行 `npm run test`
- [x] 5.3 浏览器在 1440×900 下按深浅主题验收三个页面，确认控制台无新增错误
- [x] 5.4 更新 `docs/ProjectDescription.md`

## 6. 验收后整改

- [x] 6.1 外壳合同为 `/simulations/fft-ocean-comparison`（视觉验收面）与 `/ilab/deep-sea-control/**`（实验空间嵌入入口）登记治理豁免，恢复全页面覆盖测试
- [x] 6.2 共享 Slider 把 `aria-label` / `aria-labelledby` 移到 `role="slider"` 的手柄
- [x] 6.3 控制理论地图：点击被详情面板遮挡的节点时平移露出，搜索与相关主题定位时居中到面板左侧；地图浮层垫实底色；`\quad` 并列公式分行
- [x] 6.4 单测与浏览器复验
