# 虚拟仿真全量 Product Design 审计

日期: 2026-06-15
目标: 审计 `/simulations/*` 下 7 个虚拟仿真详情页，重点检查每个仿真的统一壳层、沉浸式场景、深浅模式适配和页面间一致性。
服务: `http://localhost:3001`

## 证据

本次只使用当前审计运行中新采集的截图和指标，不使用旧截图作为判断证据。

- OpenWolf Design QC 目录: `.wolf/designqc-captures/`
- 本轮完整截图目录: `artifacts/product-design-audits/virtual-simulation-2026-06-15-audit/screenshots/`
- 采集指标: `capture-results.json`
- 联系图:
  - `contact-light-desktop.jpg`
  - `contact-dark-desktop.jpg`
  - `contact-light-mobile.jpg`
  - `contact-dark-mobile.jpg`

采集范围:

- `/simulations/destroyer`
- `/simulations/lng`
- `/simulations/container`
- `/simulations/cruise`
- `/simulations/drilling`
- `/simulations/icebreaker`
- `/simulations/dredger`

每个路由均采集 1440x960 桌面、390x844 移动端、light 和 dark 两种主题，共 28 张截图。

## 总体结论

虚拟仿真系列不能仅按“统一壳层已接入”视为产品视觉完成。当前页面已经具备统一 `AppShell`、面包屑、左侧平台导航和基本仿真 shell，但仿真内部仍保留大量资源级旧样式，因此深浅模式和沉浸式一致性没有真正闭合。

最严重的问题是邮轮仿真。它和其他 6 个仿真不在同一页面几何和信息层级中：桌面端主场景不是首屏主体，移动端在仿真前插入额外说明卡，仿真区域内文字与底部控制区出现拥挤和重叠。这个偏差不是简单配色问题，而是 `/simulations/cruise/page.tsx` 走了额外 `workspaceSlots` 路径。

第二个全局问题是双主题未形成真正模板。dark 模式主要改变了平台外壳，3D 场景仍大面积保持浅色天空、浅色海面和浅色网格；多个仿真在深色页面中继续显示白色状态卡、白色控制卡或硬编码 `text-white/text-slate-*`。这导致 dark 模式像“深色平台中嵌入浅色仿真 iframe”，不是统一的深色仿真体验。

第三个全局问题是运行噪声。28 次采集中每个页面都有同一个 page error:

```text
Cannot read properties of null (reading 'classList')
```

每个页面也都有 Three.js deprecation 警告，包括:

```text
THREE.Clock: This module has been deprecated. Please use THREE.Timer instead.
THREE.WebGLShadowMap: PCFSoftShadowMap has been deprecated. Using PCFShadowMap instead.
```

这些不一定直接阻断视觉，但不应出现在最终产品审计基线中。

## 逐页审计

| 步骤 | 路由 | 健康度 | 主要问题 |
| --- | --- | --- | --- |
| 1 | `/simulations/destroyer` | 中等风险 | 外壳统一，但 dark 模式场景仍是浅色海面；左侧状态面板外白内黑，右侧控制卡外白内黑，视觉层级割裂。 |
| 2 | `/simulations/lng` | 中等风险 | 与驱逐舰同类，场景和局部卡片不随主题形成独立模板；移动端像浅色仿真卡嵌入深色页面。 |
| 3 | `/simulations/container` | 中等风险 | 场景主体较完整，但暗色外壳内仍是亮色海面与白色局部面板；暗色主题缺少环境光、海面和仪表配套调整。 |
| 4 | `/simulations/cruise` | 高风险 | 页面几何与其他仿真不同，桌面场景宽度约 984px 而其他为 1320px；主场景被上下说明与证据区打断；移动端仿真前有额外说明卡，仿真内文案与底部工具拥挤。 |
| 5 | `/simulations/drilling` | 中等风险 | 场景表达清楚，但深浅模式仍混合浅色场景、深色外壳和局部白卡；红色作业/风险区域在 light/dark 中视觉权重都偏重。 |
| 6 | `/simulations/icebreaker` | 中等风险 | 船体和场景可读，但 dark 模式仍是浅色雪面/海面；控制面板白底为主，与深色平台壳层不协调。 |
| 7 | `/simulations/dredger` | 中等风险 | 场景在视觉上更接近深色水面，但控制区和状态区仍混用白卡/深卡；主题体系不稳定。 |

## 关键证据

### 邮轮仿真几何偏差

采集指标显示:

- `cruise` 桌面仿真场景尺寸约为 `984x1362`。
- 其他 6 个仿真桌面场景尺寸均约为 `1320x930`。

这与截图一致。邮轮仿真不是同一套首屏沉浸式 shell，它将仿真场景放入更窄、更高的内容列，并在场景前后加入额外信息区。

源码原因:

- `src/app/simulations/cruise/page.tsx` 传入 `contextStrip`、`commandBar`、`supportDrawer`、`evidenceRail`。
- `SimulationShell` 在存在这些 slot 时进入 `workspaceSlots` 渲染路径。
- 其他仿真只传入 `localToolTemplate` 和仿真组件，因此直接使用统一场景框架。

### 双主题没有进入仿真内部

源码证据:

- `src/resources/simulations/components/simulation-ui.tsx` 中 `simulationUi.root` 固定为 `bg-slate-950`。
- `simulationUi.panel` 使用 `simulation-light-panel`，并且大量局部样式固定为 `bg-white`、`bg-slate-100`、`text-slate-900`、`text-white`。
- `cruise-simulation.tsx`、`icebreaker-simulation.tsx`、`container-simulation.tsx` 等仿真内部存在大量硬编码 `bg-white`、`bg-slate-800`、`text-white`、`text-slate-*`。

视觉证据:

- `contact-dark-desktop.jpg` 中 7 个仿真外壳均为深色，但主场景几乎都保持浅色天空与浅色海面。
- `contact-dark-mobile.jpg` 中移动端尤其明显：深色页面中嵌入一张浅色仿真卡。
- 邮轮 dark desktop 中右侧控制面板为浅色卡，左侧状态面板外层浅色、内部深色，下面折叠状态区为深色，三套视觉并存。

### 移动端可读性和空间分配

大部分仿真移动端能显示平台导航和一个可用场景卡，但存在两个问题:

- 场景卡仍然偏浅，与 dark shell 不一致。
- 仿真局部工具和说明条在底部空间有限，邮轮页面已经出现说明文案贴近或压到工具栏的现象。

邮轮移动端尤其不合格:

- 仿真前置说明卡占据首屏空间。
- 主场景没有成为页面第一视觉主体。
- “舒适性状态”“频域与评价”作为下方折叠区出现，内容像占位表单，不像沉浸式仿真的局部工具。

## 可访问性风险

截图只能判断可见风险，不能证明完整可访问性合规。

- 深色主题中浅色场景里的白色标题和浅色云/海面混在一起，存在低对比风险。
- 多个局部面板使用非常小的数值文本和滑块标签，移动端可读性不足。
- 邮轮移动端的底部说明和工具区接近重叠，触控目标与阅读目标互相干扰。
- 左右局部面板、全局控灵 dock、底部工具按钮在小屏中需要进一步键盘焦点和屏幕阅读器顺序测试。

## 建议的整改边界

建议不要把这些问题拆成每个仿真单独修补。更合理的是新增一个后续变更系列，目标是“仿真资源内部视觉模板治理”:

1. 统一仿真内部 token
   - 建立 `SimulationThemeContext` 或等价主题映射。
   - 禁止仿真资源内部直接硬编码 `bg-white`、`bg-slate-*`、`text-white/text-slate-*` 作为长期样式。
   - 为 status dock、control dock、assessment panel、camera toolbar、hint strip、metric tile 提供 light/dark 成套样式。

2. 修复邮轮仿真页面架构
   - 邮轮应回到与其他 6 个仿真一致的 scene-first geometry。
   - Arena/证据/支撑状态不应打断主仿真场景，可进入可收起局部 panel 或外部任务上下文区域。
   - 移动端仿真前不应出现大块说明卡，主场景必须作为首个核心工作区。

3. 建立真实双主题场景策略
   - 不是只改外壳色板，而是为 3D scene 背景、海面、网格、雾效、标签、场景内 HUD 定义 light/dark 两套视觉参数。
   - dark 模式应降低浅天空/浅海面面积，避免高亮场景压过深色仪表壳层。

4. 清理运行噪声
   - 修复 `Cannot read properties of null (reading 'classList')`。
   - 升级或封装 Three.js 已弃用 API: `THREE.Clock`、`PCFSoftShadowMap`。

5. 建立验收矩阵
   - 每个仿真都必须提供 light/dark desktop 和 mobile 截图。
   - 邮轮必须作为高风险代表路线单独验收。
   - 验收不能只检查 `data-*` 标记和 canvas 非空，必须检查主题一致性、scene-first geometry、局部工具不重叠、移动端首屏结构。

## 审计限制

- 本轮没有修改代码。
- 本轮没有进行可交互任务完成测试，只审计初始进入状态、主题状态和首屏/全页截图。
- 本轮未验证 Arena 官方评价入口下的授权状态差异，只验证独立路由初始状态。
- 由于 Browser/Chrome 截图能力在当前会话中不足，本轮完整截图由本地 Playwright 脚本采集；同时按项目要求运行了 `openwolf designqc`，但该命令只采集到 `/simulations` 目录页，未覆盖所有详情页。
