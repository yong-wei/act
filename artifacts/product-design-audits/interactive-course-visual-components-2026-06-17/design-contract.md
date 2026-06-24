# 互动课程视觉组件 Product Design 合同

日期: 2026-06-17
状态: draft-for-implementation
适用范围: 互动课程 manifest runtime、课程运行态视觉组件、教师投影端、学生端、课程设计与实现验收
设计来源: 当前会话 Creative Production 视觉方向、现有控制工作台实现、互动课程 1-1 至 5-6 runtime 调查

## 1. 合同目标

本合同把互动课程视觉改造从“设计意图”升级为“实现合同”。后续实现不能以功能可运行作为唯一完成标准；如果视觉组件、交互状态、证据记录或复用边界不符合本合同，任务不得判定完成。

核心目标:

- 数值计算与控制分析面板统一复用现有控制工作台能力。
- 不再为互动课程重复实现已有的时域、频域、根轨迹、Nyquist、性能指标、Rust/WASM 分析面板。
- 新增 visual 组件只补齐现有工作台不覆盖的非数值表达: 方框图、信号流图、推导显影、注释媒体、自由视觉舞台、画布内任务锚点、教师诊断覆盖层。
- 所有新增组件必须 manifest-first，可被设计、导出、审计、学生端、教师端共同消费。

## 2. 设计真源与证据

本合同引用下列现有事实:

- 统一控制工作台已有 `/interactive-learning/control-workbench` 系列能力，课程内不得另写同类面板。
- `src/resources/control-system/charts/control-figure-workspace.tsx` 已提供 `ControlFigureWorkspace` 与 `CONTROL_ANALYSIS_PANELS`。
- `src/resources/control-system/charts/control-analysis-panels.tsx` 已提供 `StepResponsePanel`、`TimeDomainPanel`、`MagnitudePanel`、`PhasePanel`、`NyquistPanel`、`RootLocusPanel`、`BodePanel`、`BodeComparisonPanel`、`ControlPerformanceBar`。
- `src/resources/control-system/analysis/use-control-engine.ts` 已提供 Rust/WASM 控制分析 worker、主线程 fallback 和缓存。
- `src/resources/control-system/analysis/types.ts` 已定义控制分析请求和结果，包括时域、频域、Nyquist、根轨迹、可行域、延迟、离散配置、状态空间、参考/扰动输入。
- 当前 manifest runtime 的模板虽然有多个名称，但实际主要为纵向堆叠；本合同要求新增真正的视觉舞台能力。

被否定的方向:

- 只用 Creative Production 文字 tile 生成的占位 mood board 不作为设计真源。
- 任何只显示占位图、装饰图、抽象卡片墙的方向板不作为验收依据。

## 3. 强制复用合同

### 3.1 控制工作台复用

凡课程页面需要下列能力，必须优先复用现有控制工作台或其共享 panel:

- 时域响应曲线。
- Bode 幅频/相频图。
- Nyquist 图。
- 根轨迹图。
- 性能指标条。
- 多图联动控制分析工作台。
- Rust/WASM 驱动的实时分析面板。
- 已存在的 RootLocus 交互手柄、Bode 频率手柄、pan/zoom、fallback 状态。

禁止事项:

- 禁止在 `src/features/interactive/unit-*` 中复制一套同类时域、频域、根轨迹或 Nyquist 私有面板。
- 禁止用 `interactive-figure` 作为万能私有入口绕过共享组件。
- 禁止在课程组件中重新实现 Rust 数值请求、曲线渲染、指标计算或 fallback 逻辑。
- 禁止为了单课视觉效果牺牲控制工作台已有的坐标、图例、指标和可访问性语义。

允许事项:

- 课程可以通过 manifest 配置选择工作台布局、初始参数、可见 panel、教师释放状态和学生提交记录。
- 课程可以增加面板外的教学解释、提示、任务锚点和教师诊断覆盖层。
- 如果现有工作台缺少必要的显示状态，应扩展共享工作台，而不是在课程私有目录补一个相似面板。

### 3.2 新增 capability 命名

现有 `compute.panel` 中的 `capabilityRef` 不应继续全部塞入 `interactive-figure`。新增或整理后的 capability 应至少区分:

- `control-workbench`: 统一控制分析工作台。
- `control-linked-comparison`: 基线/变参数/多方案联动比较。
- `control-root-locus-design-map`: 根轨迹设计域与交互手柄。
- `control-frequency-reading-workbench`: Bode/Nyquist 读图训练。
- `nonlinear-analysis-workbench`: 非线性相平面、描述函数、负倒曲线等已有 5-2 能力的共享化入口。
- `training-workbench`: RL 或训练类面板的共享化入口。

以上 capability 不要求重做数值内核，只要求 manifest 能稳定声明、共享 runtime 能统一分发、教师/学生端能一致记录。

## 4. 新增 Visual 组件合同

### 4.1 `visual.stage`

职责:

- 提供互动课程页面级自由视觉舞台。
- 支持 HTML/SVG/Canvas/Three.js 等不同渲染层在同一响应式画布中编排。
- 支持图形、公式、文本、控件、任务锚点和教师显影层同屏组织。

视觉要求:

- 不是卡片堆叠容器。
- 不使用营销式 hero。
- 不使用装饰性圆球、渐变 blob 或无教学意义插图。
- 舞台必须有稳定宽高、响应式缩放和投影端安全边界。

manifest 契约最小字段:

```yaml
kind: visual.stage
payload:
  stageId: string
  aspectRatio: "16:9" | "4:3" | "fluid"
  layers:
    - id: string
      kind: "diagram" | "formula" | "annotation" | "media" | "activity" | "control"
      region: { x: number, y: number, width: number, height: number }
      zIndex: number
      revealState?: string
```

验收:

- 同一页面不能退化成 `space-y-4` 纵向列表。
- 教师端逐步显示必须作用于舞台层，而不是只显示下一张卡片。
- 移动端必须保持内容可读，不得产生横向溢出。

### 4.2 `visual.block-diagram-builder`

职责:

- 表达自动控制系统方框图、串联、并联、反馈、前馈、扰动注入、测量噪声和执行器限制。
- 支持读图、构图、路径高亮和局部错误诊断。

视觉要求:

- 使用控制工程图形语言: 传函块、求和点、分支点、信号线、箭头、端口、反馈回路。
- 线条和端口必须清晰，不得使用粗糙手绘或静态截图替代。
- 方框图应能以静态展示、教师显影、学生构造三种模式运行。

manifest 契约最小字段:

```yaml
kind: visual.blockDiagram
payload:
  nodes:
    - id: string
      type: "block" | "sum" | "branch" | "input" | "output" | "disturbance" | "sensor"
      labelLatex?: string
      position: { x: number, y: number }
      size?: { width: number, height: number }
  edges:
    - id: string
      from: string
      to: string
      labelLatex?: string
      path?: Array<{ x: number, y: number }>
  interactions:
    mode: "read" | "highlight" | "construct" | "diagnose"
```

证据记录:

- 学生选中的节点和路径。
- 拖放后的节点位置。
- 构造结果与参考结构的匹配差异。
- 教师揭示过的路径或回路。

### 4.3 `visual.signal-flow-graph`

职责:

- 表达信号流图、前向路径、回路、不接触回路、路径增益与 Mason 公式结构。

视觉要求:

- 节点、支路、支路增益、路径编号和回路编号必须可见。
- 支持按教师节奏高亮单条路径、多条回路和不接触回路组合。
- 支持从方框图切换到信号流图的对照状态。

manifest 契约最小字段:

```yaml
kind: visual.signalFlowGraph
payload:
  nodes:
    - id: string
      labelLatex: string
      position: { x: number, y: number }
  branches:
    - id: string
      from: string
      to: string
      gainLatex: string
  pathSets:
    forwardPaths: string[][]
    loops: string[][]
    nonTouchingLoopGroups?: string[][][]
  revealPlan:
    - id: string
      targetIds: string[]
      emphasis: "path" | "loop" | "formula" | "warning"
```

验收:

- 不得用表格列出路径替代图形高亮。
- Mason 公式中的每一项必须能对应到图中路径或回路。

### 4.4 `visual.derivation-stage`

职责:

- 替代当前卡片堆叠式推导。
- 支持像课堂 PPT 或黑板推导一样，在二维舞台任意位置逐步显影。
- 支持公式严格 LaTeX 渲染、公式分块、局部变色、长公式分段显影和跨区域联动高亮。

硬约束:

- 显影顺序不得被限制为从上到下。
- 每个显影单元必须有唯一 id、二维区域、层级、进入方式和教师控制状态。
- 公式必须以 LaTeX 源作为真源，不得把公式作为图片、纯文本或不可解析字符串呈现。
- 长公式必须支持分块渲染，例如左端、等号、右端、条件、结论分别显影。
- 公式块必须支持颜色语义，例如已知量、变换对象、消去项、目标项、风险项、结论项。
- 公式块必须支持局部强调，不得只能整条公式变色。
- 多个公式块可以在任意位置出现并互相引用。
- 教师端必须能按显影步骤释放，学生端必须能记录已浏览到的显影状态。

manifest 契约最小字段:

```yaml
kind: visual.derivationStage
payload:
  stageId: string
  coordinateSystem: "normalized-1000"
  formulas:
    - id: string
      latex: string
      region: { x: number, y: number, width: number, height: number }
      blocks:
        - id: string
          latex: string
          colorRole?: "known" | "transform" | "cancel" | "target" | "risk" | "result"
          revealStepIds: string[]
      renderMode: "block" | "inline" | "aligned" | "split-long"
  textBlocks:
    - id: string
      text: string
      region: { x: number, y: number, width: number, height: number }
  connectors:
    - id: string
      from: string
      to: string
      kind: "arrow" | "brace" | "highlight-line" | "dependency"
      revealStepIds: string[]
  revealSteps:
    - id: string
      label: string
      targetIds: string[]
      order: number
      transition: "instant" | "fade" | "wipe" | "trace"
      teacherControl: "manual" | "auto-after-release"
```

学生端状态:

- 未释放: 显示题面或起始公式，不显示后续推导。
- 已释放: 学生可跟随教师显影或自学模式浏览。
- 已浏览: 记录最高显影步骤。
- 已提交: 记录学生在某个显影阶段提交的判断。

教师端状态:

- 显示当前显影步骤。
- 可前进、后退、跳转到任意显影步骤。
- 可临时高亮任意公式块。
- 可显示或隐藏参考答案。
- 可查看学生停留在第几个显影步骤。

证据记录:

```json
{
  "stageId": "string",
  "maxRevealStepSeen": "string",
  "visitedRevealSteps": ["string"],
  "formulaBlockFocusEvents": [
    { "blockId": "string", "timestamp": 0 }
  ],
  "studentAnswerByRevealStep": {
    "revealStepId": "answer"
  }
}
```

验收:

- 至少有一个测试覆盖非线性显影顺序，例如第 3 步出现在画布左下，第 4 步出现在右上，第 5 步回到中部公式。
- 至少有一个测试覆盖长公式分块逐步显示。
- 至少有一个测试覆盖公式块颜色角色。
- 浏览器验收必须截图教师端任意跳转显影和学生端已释放显影。
- 如果公式没有经 KaTeX/LaTeX 渲染，验收失败。

### 4.5 `visual.annotated-media`

职责:

- 在图片、工程对象图、仿真截图、航迹图或课程示意图上呈现证据热点。
- 支持热点、标注线、局部放大、遮罩、证据标签和图上任务锚点。

manifest 契约最小字段:

```yaml
kind: visual.annotatedMedia
payload:
  media:
    src: string
    alt: string
  annotations:
    - id: string
      region: { x: number, y: number, width: number, height: number }
      label: string
      body?: string
      evidenceRole: "input" | "output" | "structure" | "parameter" | "risk" | "result"
      revealStepIds?: string[]
  interactions:
    selectableAnnotations?: string[]
    requireEvidenceSelection?: boolean
```

验收:

- 图上证据必须可被学生选择并写入提交记录。
- 教师端必须可聚合学生选择最多的热点和遗漏热点。
- 图片标题、标注和说明不得泄露内部文件名、模块名或工程语义。

### 4.6 `visual.embedded-activity`

职责:

- 将互动任务嵌入图形本体，而不是统一放在页面底部任务卡。
- 支持图上选择、图上排序、连线、路径选择、局部判断和证据标注。

要求:

- 与 `activity.panel` 共享提交契约。
- 不复制一套数据治理逻辑。
- 任何画布内作答都必须能生成与普通 activity 相同等级的提交证据。

## 5. 教师诊断合同

新增或改造组件必须提供教师可用的诊断数据，不得只在学生端有视觉效果。

教师端至少支持:

- 每个组件的提交人数、浏览人数和未释放状态。
- 方框图节点/路径选择热力。
- 信号流图路径和回路误判分布。
- 推导显影停留步骤分布。
- 公式块误判或未浏览分布。
- 注释媒体热点选择分布。
- 控制工作台参数探索覆盖和关键判断提交。

教师诊断不得显示学生答案输入框。教师端控制必须附着到模块或舞台，不应作为常开大抽屉遮挡主画面。

## 6. 设计 QA 硬闸门

每个实现变更必须提交:

- 本合同路径。
- 对应视觉稿或方向稿路径。
- 学生端截图。
- 教师端截图。
- 至少一个非默认状态截图，例如未释放、已释放、显影中、答案揭示、提交后。
- manifest 审计结果。
- 单元测试或组件测试结果。

阻塞条件:

- 使用课程私有面板重复实现现有控制工作台能力。
- `interactive-figure` 继续作为无语义万能入口。
- 推导显影退化为纵向卡片列表。
- 公式未以 LaTeX 真源渲染。
- 长公式无法分块显影。
- 公式块无法局部变色。
- 方框图或信号流图只能显示静态图片，不能产生学生证据。
- 注释媒体热点不能被记录。
- 教师端只有提交数量，没有组件级诊断。
- 页面出现内部模块名、文件名、payload key 或工程语义泄露。

## 7. 实现建议顺序

1. 先扩展 manifest taxonomy 和 registry，明确 `visual.*` 与 `control-*` capability，不改课程内容。
2. 把控制工作台已有面板接入共享 `compute.panel` 分发，清理课程私有重复入口。
3. 实现 `visual.stage`，作为后续非堆叠视觉组件底座。
4. 实现 `visual.derivation-stage`，优先满足任意位置显影、LaTeX 分块、局部变色和长公式逐步渲染。
5. 实现 `visual.block-diagram-builder` 和 `visual.signal-flow-graph`。
6. 实现 `visual.annotated-media` 与 `visual.embedded-activity`。
7. 实现 `teacher.compute-diagnostics` 与各 visual 组件的聚合诊断。

## 8. OpenSpec 转换要求

后续 OpenSpec 变更不得写成“丰富视觉效果”。必须写成可验收需求:

- 共享控制工作台复用合同。
- Visual stage 渲染合同。
- Derivation stage 非线性显影合同。
- 方框图与信号流图构造合同。
- 注释媒体证据合同。
- 教师诊断合同。
- 工程语义泄露硬闸门。

每个 spec delta 必须包含 SHALL 场景，并且测试计划必须包含学生端、教师端、浏览器截图和 manifest 审计。
