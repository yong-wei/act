## Why

当前已接入的 `control-theory-engineering-v0.37-r3` 发布包包含完整的本地化富文本、Typed Math Fragment、Formula Render 与 readiness 工件，但 ACT 仍主要把标题和描述压成普通字符串，并只从旧式 `formula_latex` 字段向详情面板投影块公式。结果是画布节点、悬浮预览、搜索结果和部分详情无法消费上游已经审定的行内数学结构，真实发布数据与现有测试夹具也不是同一条公式链路。

图谱不能把结构化数学片段重新拼成 Markdown，也不能另建一套公式引擎。ACT 需要在保持 ActKG 数学身份、双语槽位、宏配置和失败语义的前提下建立适配层，并让图谱、知识卡及既有 Markdown 内容共同使用平台数学呈现能力。

## What Changes

- 接收并关闭式校验当前 Authority 包中的 `localized-rich-text-index.jsonl`、`typed-math-fragment-index.jsonl`、`formula-render-index.jsonl` 与 `rich-text-readiness-manifest.json`，只解析同一不可变发布中的受信引用。
- 建立只读的受治理富文本适配器，将普通文本、行内数学和块级数学投影为一个共享呈现模型；禁止扫描 `$...$`、`$$...$$`、希腊字母或 TeX 命令来猜测公式。
- 升级共享数学呈现能力，使 ActKG 版本化宏配置、严格 KaTeX、安全设置、HTML+MathML、当前语言无障碍标签和显式 LaTeX 复制由图谱、讲义、教材和知识卡共同复用。
- 在新版 2D/3D Force Graph 节点标题、悬浮/键盘预览、搜索与筛选结果、详情抽屉和所有知识卡入口正确呈现公式；公式与相邻文本使用同一缩放、密度、换行和显隐规则。
- 保留知识卡 Markdown 真源及现有 Markdown 数学语法；不把卡片转换为 ActKG 富文本，也不把 ActKG 富文本转换回 Markdown。Legacy 数据模式仅兼容已有显式公式字段。
- 对 ActKG Authority sidecar 中的单个数学片段执行局部失败关闭。经课程所有者在开发过程中审核登记的上游不可用公式可以使用安全回退进入生产；未登记失败阻断应用资格。生成与 Authority 身份绑定的失败清单，供 ActKG 后续版本修正，不增加运行态审核角色或页面。ACT 自有的知识卡、讲义和教材公式不适用该豁免，正式发布前必须修复其内容或共享渲染兼容问题。
- 增加真实 r3 工件集成验证、2D/3D 视觉与交互回归、知识卡回归、无障碍/复制验证以及公式缓存和动画热路径性能门禁。

## Capabilities

### New Capabilities

- `governed-rich-text-math-presentation`: 定义 ActKG 结构化富文本与数学资产的消费、共享数学呈现、无障碍/复制、局部失败关闭及版本化不可用清单。

### Modified Capabilities

- `authority-localized-label-projection`: 公式化标题优先消费受治理富文本记录；普通标签继续作为非数学回退与搜索文本，不再承担运行时 TeX 识别。
- `authority-domain-shard-delivery`: 在保持服务端有界分片的前提下投影画布、搜索、预览和详情所需的受治理富文本与同发布数学资产身份。
- `active-authority-semantic-graph-presentation`: 将公式正确呈现扩展到节点标题、悬浮预览、搜索/筛选、详情和知识卡，并明确统一显隐、失败与无障碍行为。
- `active-authority-legacy-force-runtime`: 使共享 2D/3D Force Graph 消费同一富文本呈现模型、缓存数学绘制结果并维持受控动态节点几何；Legacy 普通文本不得被猜测为公式。
- `resource-node-knowledge-workspace-ui`: 保留知识卡 Markdown 真源，同时让所有卡片入口复用共享数学呈现、宏、无障碍和复制能力。
- `authority-locale-readiness-and-switching`: 将富文本、数学槽位和当前语言无障碍标签纳入同 Authority 的语言资格，禁止跨语言数学标签回退。

## Impact

- 影响 Authority 发布包验证与加载、领域/搜索/详情分片 DTO、服务端投影、Active Authority 客户端适配器和 2D/3D Force Graph 标签绘制。
- 影响共享 KaTeX/Markdown 数学组件、Knowledge Card 呈现、无障碍树、复制交互、缓存键和产品 QA。
- 新增仅用于开发审核的 ActKG Authority 不可用公式账本及上游修复报告；其审核载荷不得进入运行 API、公开资源或部署包。ACT 自有 Markdown 内容失败不写入该账本。
- 不修改 ActKG Schema、Canonical 身份、工程/教学关系、知识卡 Markdown 真源、生产 Authority 选择器或 Runtime Release 选择器，也不实施通用 DB `STATIC_TEXT` Markdown 渲染器迁移。
