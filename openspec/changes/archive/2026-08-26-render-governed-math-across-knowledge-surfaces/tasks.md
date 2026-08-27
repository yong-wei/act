## 1. 建立真实基线与回归样例

- [x] 1.1 从当前激活的 Authority release 提取包含标题公式、描述公式和独立公式的真实双语样例，并固定 release identity、文件哈希与预期结构。
- [x] 1.2 增加失败回归，证明现有图谱 API 与画布只消费纯文本或旧式 `formula_latex`，不能完整消费当前 rich-text/math sidecar。
- [x] 1.3 生成当前 release 的 rich document、math span、formula fragment、locale 与失败项基线报告；计数由工件计算，不写死在代码中。
- [x] 1.4 建立长标题、缩放 LOD、双语切换、无障碍名称、复制公式和 ActKG 已登记不可用公式的验收夹具，并另取真实知识卡、讲义和教材公式夹具。

## 2. 校验并投影同版数学工件

- [x] 2.1 为 readiness manifest、localized rich-text index、typed math fragment index 与 formula render index 建立运行时类型和边界校验器。
- [x] 2.2 校验 release identity、文件哈希、分母闭合、引用存在性、slot 顺序、locale 对称性与同语言无障碍文本。
- [x] 2.3 拒绝跨 release 引用、重复 identity、缺失 fragment、哈希漂移、未声明 macro profile 与不安全渲染选项。
- [x] 2.4 生成有界的 `GovernedRichTextProjection`，明确区分 `RENDERABLE`、`REGISTERED_UNAVAILABLE` 与未登记缺失。
- [x] 2.5 将有界投影接入根图、领域 shard、搜索、邻域和节点详情所需的服务端响应，不向客户端下发全量 sidecar index，也不把知识卡 Markdown 伪装成该投影。
- [x] 2.6 用真实当前 release 的完整 corpus 验证所有被引用 rich document 与 fragment 均可解析，并保存可复现报告。
- [x] 2.7 仅为明确的 Legacy Formula 字段保留兼容投影，移除激活 Authority 详情对 `formula_latex` mock 的事实依赖。

## 3. 统一严格数学渲染能力

- [x] 3.1 抽取共享 KaTeX 配置，固定严格错误策略、`trust: false`、MathML 输出与资源上限。
- [x] 3.2 建立有版本的 macro profile registry，并只登记当前 Authority 工件实际引用的 profile。
- [x] 3.3 实现按工件顺序渲染 paragraph、text span、inline math span 与 block math 的共享 DOM 组件。
- [x] 3.4 为数学内容提供当前语言的无障碍名称，并避免视觉公式与隐藏文本被屏幕阅读器重复朗读。
- [x] 3.5 实现整段文本复制与单公式 LaTeX 复制，复制内容来自受治理 projection，而非渲染后的 DOM 反解析。
- [x] 3.6 使 Markdown 讲义/卡片链路与显式 `BlockMath` 组件复用同一 KaTeX 安全配置和 macro registry，同时保留各自输入解析方式。
- [x] 3.7 增加危险命令、未知宏、超限输入、原始源码泄漏和 macro 版本漂移的安全回归测试。

## 4. 接入图谱 DOM 界面

- [x] 4.1 将 rich title 与 rich description 接入节点 hover 快速预览、键盘聚焦预览、搜索结果、筛选结果、详情 inspector 和移动端抽屉。
- [x] 4.2 保持公式与普通文本相同的显示、截断、折行、层级和 locale 规则，不额外建立公式专用交互模式。
- [x] 4.3 对单个已登记不可用 span 或 title 使用有界不可用表现；未登记失败必须由资格门禁拦截。
- [x] 4.4 增加快速切换节点、异步响应乱序和中英文切换测试，保证 rich-text identity 不串位。
- [x] 4.5 搜索使用受治理的可检索文本、无障碍文本和符号别名，不索引原始 LaTeX 命令噪声。
- [x] 4.6 验证公式内容不改变现有节点筛选、关系筛选、抽屉返回和焦点恢复行为。

## 5. 在旧版力导向引擎中呈现公式

- [x] 5.1 在共享 Force Graph runtime 中加入来源无关的语义标签层，继续复用现有拓扑、力导向布局、交互和相机状态。
- [x] 5.2 将 2D 节点的语义标签锚定到引擎投影坐标，并沿用普通文本的 LOD、折行、碰撞与显隐规则。
- [x] 5.3 将 3D 节点的语义标签锚定到相机投影坐标，沿用同一内容与无障碍模型，并保持 2D/3D 模式状态隔离。
- [x] 5.4 按不可变 rich-text identity 缓存数学 DOM；动画帧只更新位置和可见性，不重复解析 Markdown 或执行 KaTeX。
- [x] 5.5 保持节点图形、内部资源标识、动态光环、命中区域、边线动画、碰撞半径和相机控制的既有契约。
- [x] 5.6 增加 2D/3D 缩放、拖拽、滚轮、hover、选择、模式切换和高密度图谱的交互及性能回归。

## 6. 覆盖知识卡片与 Legacy 页面

- [x] 6.1 保持知识卡片以 Markdown 为内容格式，并让所有卡片入口统一经过共享数学渲染配置。
- [x] 6.2 用真实卡片夹具验证行内公式、块公式、无障碍名称和 LaTeX 复制；任何失败在修复前阻断正式内容发布，不得登记为 Authority 不可用公式。
- [x] 6.3 用真实讲义和教材公式夹具验证共享宏、安全设置与行内/块级显示均未回归。
- [x] 6.4 仅将 Legacy 中明确声明为公式的字段接入共享渲染器，保留其余旧版交互和布局。
- [x] 6.5 增加负向测试，证明 Legacy 标题与描述不会通过 `$`、`$$` 或其他分隔符猜测公式。
- [x] 6.6 验证本变更不扩展为通用数据库 `STATIC_TEXT` 内容迁移，也不改变讲义和教材的 Markdown 真源。

## 7. 建立失败清单与发布资格门禁

- [x] 7.1 定义只覆盖 ActKG Authority sidecar 的版本化 JSON/JSONL 失败清单 schema，记录 release identity、rich document/field、fragment、surface、原因、证据与处置状态，并拒绝 ACT 自有 Markdown 内容进入该账本。
- [x] 7.2 为目标 Authority release 生成完整 disposition，保证每个应呈现公式均为可渲染或已登记不可用。
- [x] 7.3 由课程所有者在开发过程中审核全部已登记不可用项，并将裁决保存在离线治理工件中。
- [x] 7.4 对缺失 disposition、重复记录、工件漂移、未经审核或未登记失败实行发布失败关闭。
- [x] 7.5 生成不含本机路径、私有载荷、ACT 自有 Markdown 内容和运行时审核信息的上游 ActKG 修复包。
- [x] 7.6 验证失败清单、审核记录和修复包不会进入学生 API、公开静态资源、部署镜像或正式 runtime release。
- [x] 7.7 验证同 schema 新 release 的增量重算：保留仍有效记录、关闭已修复记录、加入新增失败，并拒绝跨 release 沿用错误结论。

## 8. 验收与文档

- [x] 8.1 运行真实当前 Authority release 的完整 sidecar 集成验证，并归档输入 identity、命令与结果摘要。
- [x] 8.2 用浏览器覆盖 2D、3D、hover、搜索、筛选、inspector、知识卡片、明暗主题、移动端与多级缩放。
- [x] 8.3 完成键盘导航、屏幕阅读器名称、焦点恢复和两种复制操作的无障碍验收。
- [x] 8.4 记录动画期间无逐帧 KaTeX 重渲染的性能证据，并对高密度图谱建立回归阈值。
- [x] 8.5 依次通过直接回归、相关单元测试、图谱域集成测试、typecheck、lint、build、最终全量验证和严格 OpenSpec 校验。
- [x] 8.6 更新项目说明、运行与验收命令、Authority 工件接入说明以及提交给 ActKG 的失败修复说明。
- [x] 8.7 由课程所有者完成真实节点与知识内容抽样，确认标题、描述、画布标签、知识卡、讲义和教材中的公式均正确显示，且 ActKG Authority 失败清单闭合。
