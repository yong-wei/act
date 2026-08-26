## Context

ACT 已镜像并选择 `control-theory-engineering-v0.37-r3` 作为当前 Authority presentation bundle。该包在原有纯文本本地化断言旁提供以下并行工件：

- `localized-rich-text-index.jsonl`：按语言保存段落、数学块以及有序 text/math span；
- `typed-math-fragment-index.jsonl`：保存正文局部数学片段、宏配置、无障碍标签与验证状态；
- `formula-render-index.jsonl`：保存独立 Formula 的严格 KaTeX 呈现记录；
- `rich-text-readiness-manifest.json`：绑定分母、内容摘要、双语槽位一致性和数学资产资格。

当前 ACT 运行链路没有消费这些 sidecar。画布、悬浮预览、搜索和描述使用普通字符串；详情数学投影只读取 `teachingFields.formula_latex` 并固定为块公式。真实 Authority 历史载荷曾使用 `original_latex`，而当前 r3 已通过独立 sidecar 解决文本与数学身份问题，因此继续扩展旧字段适配会再次丢失行内位置、语言槽位、宏配置和审计身份。

现有知识卡正文使用 `ReactMarkdown + remark-math + rehype-katex`，显式公式字段使用 `react-katex`。教材和正式讲义也有成熟的 Markdown/KaTeX 链路。图谱应复用同一 KaTeX 能力，但不能把上游 span 拼回 Markdown。

本次变更只生成应用和治理能力。它不修改 ActKG 工件，不切换 Authority、Teaching Projection 或 Runtime Release 选择器，也不新增运行态审核角色。

## Goals / Non-Goals

**Goals:**

- 对当前目标 Authority 的富文本和数学 sidecar 执行同发布、同语言、同哈希的关闭式验证。
- 形成一个同时服务 DOM、2D、3D、搜索、无障碍和复制行为的受治理富文本呈现模型。
- 让图谱节点标题、预览、搜索、详情和知识卡在所有入口正确呈现行内与块级公式。
- 复用并升级共享 KaTeX 配置，使版本化宏、安全设置、HTML+MathML 和复制语义一致。
- 以离线版本化账本管理经审核的 ActKG Authority sidecar 不可用公式；未登记上游失败阻断目标 Authority 的产品资格，ACT 自有 Markdown 公式失败则在修复前阻断相应内容发布。
- 在不改变旧图数据语义的前提下，使 Legacy 显式公式字段遵循相同的安全失败行为。

**Non-Goals:**

- 不修改 ActKG Schema、数学资产、Canonical 对象、工程关系或 ACT Teaching Projection。
- 不扫描普通字符串中的 `$`、`$$`、反斜杠命令、等号或希腊字母来发现数学内容。
- 不把 ActKG 富文本转换为 Markdown，也不把知识卡 Markdown 迁移为 ActKG span。
- 不把长定义或独立公式塞入节点 glyph；只有标题自身的数学片段属于节点标题。
- 不建设新的公式编辑器、数学计算引擎、运行态审核页、多教师角色或在线回写 ActKG 的接口。
- 不在本次变更中迁移通用 DB `STATIC_TEXT` 的手写 Markdown 渲染器。

## Decisions

### 1. 以 r3 sidecar 作为图谱混合文本的唯一结构化数学输入

服务端从目标 Authority envelope 中加载 readiness manifest 和三项索引，重新计算文件摘要、分母摘要、文档内容摘要、数学引用闭合、同语言标签存在性和跨语言 slot parity。一个数学 span 只能引用同一发布中已通过资格的 Formula 或 Typed Math Fragment；未知类型、跨发布引用、重复身份、哈希漂移或不安全资产全部失败关闭。

旧的纯文本 label/description 保留为兼容回退、搜索文本和无 sidecar 客户端输入，但不得被重新解析为 TeX。sidecar 存在且合格时，公式化标题和描述必须优先消费 sidecar。

备选方案：继续把 `formula_latex`/`original_latex` 扩展到更多 DTO。拒绝原因是它只能表达一个块公式，不能表达混合标题、行内位置、双语槽位或 Typed Math Fragment。

### 2. 在服务端解析为有界、无 HTML 的呈现模型

服务端建立判别联合类型 `GovernedRichTextProjection`：

- `available`：包含 locale、内容摘要、段落/数学块以及有序 text/math span；
- `registered-unavailable`：包含受控原因码和当前语言的安全回退；
- `missing`：上游没有为该字段声明富文本，不代表渲染失败。

math span 只向客户端投影呈现所需的可信 LaTeX、display mode、宏配置身份/摘要、当前语言无障碍标签、复制内容摘要和不透明 render key。API 可以保留拓扑所需的不透明关联键，但可见文本、可访问名称、错误和复制结果不得暴露 release/object/math asset 等系统身份。

Root、domain、search、neighborhood 和 detail 继续使用各自的有界分片。画布和搜索只获得标题/短预览所需的富文本；完整描述和知识内容只在节点详情请求后加载。客户端不得下载或解析完整 sidecar 索引。

备选方案：把索引原样发送浏览器并在客户端关联。拒绝原因是它破坏服务端有界加载、扩大系统身份暴露面，并使不同客户端重新实现资格判断。

### 3. 共享一个严格 KaTeX 配置与版本化宏登记表

平台数学核心统一采用受治理配置：严格错误、`trust=false`、禁止任意 HTML/URL 命令、HTML+MathML 输出、明确 display mode、受控最大输入和版本化宏登记。只有 ActKG 资格工件声明且 ACT 已登记支持的宏配置可以进入正式呈现。

DOM 富文本组件、`react-katex` 显式字段以及 Markdown 的 `rehype-katex` 通过同一配置工厂取得宏和安全选项。知识卡、教材和讲义继续由各自 Markdown AST 决定 text/math 边界；共享配置不改变其 authoring 格式。

当上游发布了合法但 ACT 尚不支持的宏配置时，修复共享登记表和相应回归测试；不得在图谱适配器内做字符串替换或私有宏别名。

备选方案：只为图谱增加宏补丁。拒绝原因是相同公式会在卡片、讲义和图谱得到不同结果，并形成第二套兼容真相。

### 4. Force Graph 使用受控 DOM 语义标签层而不新增画布引擎

2D 与 3D 继续由现有 Force Graph 负责拓扑、力布局、相机、命中和节点 glyph。共享运行底座增加 source-neutral 的语义标签层：

- 标签内容由同一 React 富文本/KaTeX 组件呈现；
- 每个可见标签锚定到 Force Graph 投影坐标；动画帧只更新位置和显隐，不重新解析或重新执行 KaTeX；
- 已解析富文本和已生成 KaTeX 标记按 Authority、locale、content hash、macro-profile hash、display mode 和主题缓存；
- 2D/3D 使用相同呈现模型、换行上限和语义名称，维度切换不重新解释内容；
- 标签层不拥有第二套节点、边、选择或布局状态，也不截获普通指针命中。

公式和普通文本共同遵循现有 level-of-detail：远景可以整体隐藏标题，进入可读层级后同时显示完整的有界标题。标题不因含公式获得更早或更晚的显隐阈值。节点 glyph 的受控动态半径仍只服务既有内部标识和命中几何；标题测量用于外部标签布局，不使节点无限增大。

无障碍树为每个可交互节点提供当前语言的等价语义名称；视觉 KaTeX 与可访问数学标签只能朗读一次。画布图像或 DOM 装饰本身不成为第二个可聚焦节点。

备选方案：逐帧在 Canvas/Three 纹理中执行 KaTeX。拒绝原因是热路径成本高、无障碍语义差且需要维护另一套布局。备选的第二套 SVG 图谱也违反已归档 Force Graph 决策。

### 5. DOM 表面统一消费富文本投影，知识卡保持 Markdown

悬浮/键盘预览、搜索结果、筛选结果、桌面 inspector、移动 drawer 和页面内标题使用共享富文本组件。块级数学只出现在允许块布局的内容区；节点标题和紧凑结果只接受上游声明的行内 span，异常 display mode 进入失败账本而不是在客户端改写。

知识卡正文继续使用 Markdown 真源和现有 AST 管线，但所有知识卡入口必须使用共享数学配置、当前语言无障碍语义和有效公式的显式复制操作。图谱详情不得把卡片正文重新序列化为 ActKG 富文本。知识卡、讲义和教材属于 ACT 自有内容；其公式失败必须修复内容或共享兼容能力后才能进入正式发布，不得借用 Authority 不可用公式账本获得豁免。

Legacy 普通名称与描述始终是普通文本。只有现有显式公式字段进入共享数学组件；现有回显原始 TeX 的错误路径改为受控不可用状态。

### 6. 搜索、复制与无障碍各有独立受治理投影

搜索索引使用当前语言 `plain_text_fallback`、数学源文本、数学资产的本地化可访问标签和已批准符号名称；LaTeX 命令本身不作为默认自然语言词。搜索匹配身份不改变图谱对象身份，结果显示仍使用富文本标题。

整段复制使用上游确定性 fallback；单个有效公式的显式复制使用受信、无外围定界符的标准 LaTeX，不复制 KaTeX HTML。失败或不可用公式不提供 LaTeX 复制。

每个 math asset 必须使用当前选择语言的可访问标签。中文界面不能用英文标签填补，英文界面也不能回退中文；缺失标签按不可用公式处置。

### 7. 允许经审核登记的不可用公式，但不允许静默失败

开发命令遍历目标 Authority 在所有已启用语言和产品表面可达的富文本文档。每个 ActKG sidecar 数学片段必须得到下列最终处置之一：

- `RENDERABLE`：引用、宏、安全、KaTeX、无障碍和表面合同全部通过；
- `REGISTERED_UNAVAILABLE`：课程所有者在仓库开发过程中审核，记录 Authority 身份、文档/字段/数学资产身份、内容摘要、失败原因、安全回退、受影响表面和上游修复状态。

未处置、未知失败或账本漂移使目标 Authority 的图谱产品资格失败。已登记不可用片段按局部失败关闭：保留同一文档的普通文本，在原位置显示上游已批准安全回退或统一不可用表达。公式化标题因此失去可理解语义时，整个节点进入既有“名称暂不可用”开发审核路径，正式图谱默认隐藏。

账本和上游修复报告只覆盖 ActKG Authority sidecar，属于仓库开发工件，不进入运行 API、公开静态资源、Runtime Release 或部署包。报告可以保留 ActKG 修复所需的发布内身份和可信数学源，但不得混入 ACT 自有知识卡、讲义或教材内容，也不得包含凭据、签名 URL、个人数据或本机绝对路径。运行服务不提供审核、批准或回写操作。

备选方案：任何公式失败都阻止生产。拒绝原因是用户已选择允许经审核登记的上游缺陷随安全回退进入当前版本。备选的运行时自动豁免也被拒绝，因为它会把遗漏变成不可见债务。

### 8. 验收同时证明真实数据、视觉、语义和热路径

资格和回归验证至少覆盖：

- r3 真实 readiness/index 工件的同发布加载、哈希重算、引用闭合和双语 slot parity；
- 当前真实 Formula/Fragment，而非只使用 `formula_latex` mock；
- 2D、3D、悬浮、键盘预览、搜索、筛选、桌面 inspector、移动 drawer和知识卡入口；
- 行内/块级、长标题换行、深浅主题、缩放显隐、维度切换和模式隔离；
- HTML+MathML、当前语言标签、无重复朗读和显式复制；
- 宏漂移、跨发布引用、危险命令、缺失资产、账本漂移和 Legacy 普通文本误判的负例；
- Force Graph 动画期间位置更新不会重新执行 span 解析或 KaTeX，且有界节点集满足既有交互性能门禁。

## Risks / Trade-offs

- [DOM 标签层可能增加大图重排成本] → 只为当前有界且达到可读 LOD 的节点挂载标签，缓存内容，动画帧仅更新 transform，并以性能回归验证重排和帧稳定性。
- [2D/3D 投影坐标和遮挡行为不同] → 由共享运行底座提供统一锚点合同，分别测试相机移动、缩放、维度切换和焦点代理，不让内容组件读取图布局真相。
- [共享宏升级影响现有 Markdown 内容] → 版本化宏登记、真实知识卡/讲义/教材夹具和跨消费者回归同时通过后才接纳配置。
- [ACT 自有 Markdown 公式没有生产豁免] → 用真实知识卡、讲义和教材夹具在发布前失败关闭；修复内容或共享渲染兼容能力后重新验证，不将其误报为 ActKG 上游缺陷。
- [已登记不可用项可能长期积累] → 每份账本绑定精确 Authority；新版本接入必须重新核对并生成差异报告，已修复项自动失效，新增失败必须再次审核。
- [纯文本 fallback 可能保留历史定界符] → 正常产品优先使用合格 span；失败片段只使用经审核的安全回退或统一不可用表达，不在运行时解析 fallback 定界符。
- [上游合同变化] → 同 Schema/合同内容更新按新哈希重新生成适配和账本；Schema、sidecar 结构或渲染 profile 不兼容时失败关闭并另开适配变更。

## Migration Plan

1. 增加 sidecar schema/loader、真实 r3 回归夹具和目标 Authority 全量资格命令；此阶段不改变 UI。
2. 提取共享 KaTeX 配置、宏登记、富文本 DOM 组件、复制和无障碍投影，并让现有知识卡回归通过。
3. 扩展有界 shard/search/detail DTO，先接通预览、搜索和 inspector，再接通 2D/3D 语义标签层。
4. 生成目标 Authority 的完整数学处置账本和上游修复报告，由课程所有者完成所有 `REGISTERED_UNAVAILABLE` 审核。
5. 在固定提交上运行真实数据集成、2D/3D 浏览器矩阵、无障碍、性能、类型、测试、构建和部署包泄漏门禁。
6. 通过普通应用发布交付渲染能力；Authority、Teaching Projection 和 Runtime Release 选择器保持原身份。

回滚只需要恢复上一应用修订。ActKG 发布包、选择器、Teaching Projection、资源绑定和学习事实均未改变；账本和验证报告保留为审计证据。

## Open Questions

没有未决产品或架构选择。实施时只需从当前 r3 工件记录实际宏配置集合、真实不可用项数量和性能基线，不能把这些执行事实预写为固定常量。
