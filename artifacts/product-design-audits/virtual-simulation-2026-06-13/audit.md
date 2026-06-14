# 虚拟仿真页面 Product Design 审计

日期: 2026-06-13  
目标: 审计虚拟仿真的各级入口与每个虚拟仿真页面，关注平台整体风格、交互逻辑，以及深浅模式下组件协调性。  
工具: Chrome CDP，`http://localhost:3001`，桌面 `1440x1000`，移动代表视口 `390x844`。  
范围: `/simulations`、7 个 `/simulations/*` 仿真页、`/virtual-lab`、`/interactive-learning/control-workbench`。  
设计 handoff: `design-handoff.md`。  

## 步骤与健康度

1. `/simulations` 虚拟仿真实验室入口: 中等风险。视觉较完整，但未纳入统一 AppShell，且与 `/virtual-lab` 的开放状态信息冲突。
2. `/simulations/destroyer`: 中等风险。基础仿真可用，控制面板清晰，但主题混合、局部工具与全局浮层关系不清。
3. `/simulations/lng`: 中等风险。结构与驱逐舰类似，但仍是页面自有壳层，未承接平台导航。
4. `/simulations/container`: 中等风险。控制参数较丰富，但信息密度和控件层级没有统一模板约束。
5. `/simulations/cruise`: 相对较好。已有课程/Arena 上下文提示和局部控制说明，但右侧长控制栏、滚动和主题协调仍需治理。
6. `/simulations/drilling`: 中等风险。DP 定位控制结构清晰，但无文本按钮和符号文本造成可访问性风险。
7. `/simulations/icebreaker`: 中等风险。内部 tab 结构更复杂，说明需要标准化二级局部导航。
8. `/simulations/dredger`: 中等风险。与钻井页高度相似，适合统一为 DP/定位类仿真模板。
9. `/virtual-lab`: 高风险。页面事实过期，宣称只有 1 个可用仿真入口，与 `/simulations` 的 7 个任务链冲突。
10. `/interactive-learning/control-workbench`: 相对较好。已使用 AppShell、平台导航和面包屑，可作为统一壳层参照，但主面板信息密度偏高。
11. 移动端 `/simulations`: 中等风险。内容可访问树完整，但入口页信息密度高，缺少平台移动导航关系。
12. 移动端 `/simulations/destroyer`: 中等风险。主要控制卡可见，但 3D 画布、底部工具、浮动控件和右下角工具按钮存在遮挡竞争。

## 截图证据

辅助总览: `screenshot-contact-sheet.jpg`。

| 编号 | 页面 | 模式 | 文件 |
| --- | --- | --- | --- |
| 01 | `/simulations` | dark | `screenshots/01-simulations-index-dark-1440.png` |
| 02 | `/simulations` | light | `screenshots/02-simulations-index-light-1440.png` |
| 03 | `/simulations/destroyer` | dark | `screenshots/03-destroyer-dark-1440.png` |
| 04 | `/simulations/destroyer` | light | `screenshots/04-destroyer-light-1440.png` |
| 05 | `/simulations/lng` | dark | `screenshots/05-lng-dark-1440.png` |
| 06 | `/simulations/lng` | light | `screenshots/06-lng-light-1440.png` |
| 07 | `/simulations/container` | dark | `screenshots/07-container-dark-1440.png` |
| 08 | `/simulations/container` | light | `screenshots/08-container-light-1440.png` |
| 09 | `/simulations/cruise` | dark | `screenshots/09-cruise-dark-1440.png` |
| 10 | `/simulations/cruise` | light | `screenshots/10-cruise-light-1440.png` |
| 11 | `/simulations/drilling` | dark | `screenshots/11-drilling-dark-1440.png` |
| 12 | `/simulations/drilling` | light | `screenshots/12-drilling-light-1440.png` |
| 13 | `/simulations/icebreaker` | dark | `screenshots/13-icebreaker-dark-1440.png` |
| 14 | `/simulations/icebreaker` | light | `screenshots/14-icebreaker-light-1440.png` |
| 15 | `/simulations/dredger` | dark | `screenshots/15-dredger-dark-1440.png` |
| 16 | `/simulations/dredger` | light | `screenshots/16-dredger-light-1440.png` |
| 17 | `/virtual-lab` | dark | `screenshots/17-virtual-lab-dark-1440.png` |
| 18 | `/virtual-lab` | light | `screenshots/18-virtual-lab-light-1440.png` |
| 19 | `/interactive-learning/control-workbench` | dark | `screenshots/19-control-workbench-dark-1440.png` |
| 20 | `/interactive-learning/control-workbench` | light | `screenshots/20-control-workbench-light-1440.png` |
| 21 | `/simulations` | mobile dark | `screenshots/21-simulations-index-mobile-dark-390.png` |
| 22 | `/simulations/destroyer` | mobile dark | `screenshots/22-destroyer-mobile-dark-390.png` |

## 主要发现

### 高优先级

1. 虚拟仿真入口存在信息架构冲突。`/simulations` 显示 7 个仿真场景和 7 个开放任务链，`/virtual-lab` 同时显示“已上架模型 7、当前开放 1、筹备中 6”。这会让学生和教师无法判断真正的仿真入口和开放状态。
2. `/simulations` 与各仿真详情页没有使用统一 AppShell。用户从 AppShell 内的“虚拟仿真”进入后，会切到一个独立沉浸式体系；返回方式、面包屑、角色状态、主题按钮和导航位置都发生变化。
3. 深浅模式没有形成两套一致模板。多数仿真页在 light 和 dark emulation 下视觉几乎不变，或出现浅色场景背景、浅色外框、深色内嵌控制卡混合的状态。当前更像“固定沉浸式主题”，不是平台级双主题。

### 中优先级

4. 仿真局部工具缺少统一模型。不同页面都出现状态监控、控制与探究、相机按钮、网格按钮、速度控制、返回上一层和控灵浮层，但布局顺序、折叠策略、状态说明和上下文标签并不完全一致。
5. 邮轮页已经出现“局部控制/全局外层控制”的说明，且带有课程模式和证据状态。这是更合理的方向，但还没有推广到其他仿真页。
6. 钻井页与疏浚页结构接近，都属于 DP/定位控制类仿真；继续各自维护会造成重复视觉和交互分歧。
7. 破冰船页有更多内部 tab，说明复杂仿真需要“仿真内部导航”的正式规范，否则多层 tab 与平台导航、面包屑、浮层按钮会竞争。
8. 移动端仿真页把视角按钮缩成“主/俯/战”，可访问描述仍存在，但视觉语义依赖单字，不利于初学者理解。

### 可访问性与运行风险

9. Chrome 报告 `No label associated with a form field (count: 3)`，全局控灵输入或页面表单仍有 label 关联问题。
10. 若干图标按钮在可访问树中没有明确文本，例如部分重置/切换按钮只显示为 `button`。这会影响键盘与读屏用户判断。
11. 邮轮页 Kp/Ki/Kd spinbutton 在可访问树里出现 `valuemin=0`、`valuemax=0`，Ki 还标记为 `invalid=true`，可能是输入语义或属性绑定错误。
12. 控灵浮层在所有入口和仿真页中持续出现。它有助教价值，但在移动端和沉浸仿真页上与底部工具、右下角设置按钮、仿真控制面板争夺空间。
13. 控制台存在 Three.js 弃用警告：`THREE.Clock` 与 `THREE.WebGLShadowMap: PCFSoftShadowMap`。这不是当前视觉阻塞，但属于仿真运行维护风险。

## 正向参照

- `/interactive-learning/control-workbench` 已经具备 AppShell、左侧平台导航、面包屑、角色标签、主题按钮和“独立探索/官方评价”语境说明。虚拟仿真页应该向这套结构靠拢。
- `/simulations/cruise` 已经明确区分仿真局部控制与全局外层控制，并显示课程/Arena 上下文。这类语义应成为仿真详情页的标准合同。
- `/simulations` 的模型卡片视觉素材较完整，适合作为资源浏览入口的内容基础，但需要迁移到统一壳层与统一状态真源。

## 建议的后续变更方向

1. 建立统一的虚拟仿真信息架构：将 `/simulations` 作为唯一仿真目录真源，决定 `/virtual-lab` 是重定向、归档、还是改造为同一 AppShell 下的“模型库”子页。
2. 建立 `SimulationShell` 或等价平台模式：统一 AppShell 接入、面包屑、角色状态、返回策略、局部工具栏、控灵避让和主题 token。
3. 抽象仿真局部控制模板：至少区分航向控制类、DP/定位类、舒适度/频响类、冰区推进类；禁止页面各自定义状态卡和控制卡视觉语法。
4. 明确双主题策略：沉浸式 3D 场景可以保持任务场景色，但外层平台、控制卡、表单、tab、按钮和状态栏必须使用平台 light/dark token。
5. 修复辅助技术语义：补齐 form label、图标按钮 aria-label、spinbutton min/max/invalid 状态，以及移动端短文本按钮的可见说明。
6. 治理全局控灵浮层：在沉浸仿真页定义默认折叠策略、避让规则、移动端入口位置，以及与页面局部 AI 伴学 tab 的关系。

## 证据限制

- 本审计基于当前截图、可访问树、控制台和网络列表，不等同于完整 WCAG 合规审计。
- 未执行完整键盘路径、读屏器朗读、性能 profiling、真实学生/教师账号权限矩阵测试。
- 移动端仅抽样 `/simulations` 与 `/simulations/destroyer`，用于发现明显响应式风险，不代表所有仿真页移动端已完整覆盖。
