# Issue #1515 图谱（Authority/Knowledge Graph）侧问题清单

状态：2026-08-23 整理，供后续审核与整改。所有条目均来自本次修复执行的已核实观察，未含推测。

## G1 域发布成员身份为无语义占位（阻断级）

- `nonlinear-control-design` 域全部 104 个成员在 v0.22-r5 `review-projection.json` 中为 `M1S <类型> <哈希>` 形态的 display_name，description 全空。
- 影响：该域三族教学关系无法做任何语义裁决（use-codex 审核结论：全部 insufficient-evidence，禁止按对象类型或同域共存虚构关系）。
- 整改方向：在 ActKG 侧为该域补齐真实中文名与描述后重新发布；ACT 侧 scope/crosswalk 随新 release 增量重建。

## G2 multilingual-label-index 与 scope 成员 id 形态不兼容

- label index 2148 行，entity_id 形态为 `ctc:<域前缀>-<hash>`；scope 7300 成员中存在 `ctc:<22hex>`、`ctkg:<kind>:<hash>` 等多种形态。
- 实测：用 label index 直接匹配 scope 成员仅命中 1683（23.1%），且其中与课程侧 canonical 节点名精确匹配仅 33。
- 完整名称真源实际在 v0.22-r5 `review-projection.json`（7300/7300 覆盖）；label index 不是成员名称的完备来源。
- 整改方向：统一 Authority 工件间的实体 id 形态，或在 label index 中补齐全部 scope 成员形态。

## G3 v0.22-r5 composite 组件发布丢失 canonical_nodes

- `components/*.release.json`（ACT 侧与 ActKG 侧同内容）只含 entries/included_entities（tier/reason），不含 canonical_nodes。
- ActKG checkout 中仅 root-locus 域有带 canonical_nodes 的独立域包；其余 16 个域目录只有 projection/rag-crosswalk/release 文件，其中各域 `.projection.json` 合计仅 744 节点（与 DB ActkgProjectionNode 数一致）。
- 整改方向：composite 发布应携带或引用每域节点真源，避免 ACT 侧只能依赖 review-projection 单一文件恢复名称。

## G4 scope 成员 id 形态混用

- scope.json 7300 成员中：`ctc:<22hex>` 5342、`ctkg:condition:<hash>` 1533、`ctkg:<4段>` 372、`ctkg:<5段>` 53。
- 影响：任何按 id 形态假设的映射逻辑都会出错；本次 crosswalk 以 entity_id 全量索引解决，但上游不一致本身应治理。

## G5 课程讲义覆盖与 Authority 成员集不对齐（审核发现）

- lyapunov-stability 域大量成员（李雅普诺夫函数、直接法、矩阵方程、全局稳定性）在现行讲义中无对应正文；讲义仅覆盖局部线性化、平衡点、特征值判据、相平面、吸引域入口。
- use-codex 审核对该域仅承认 11 项有讲义证据的关系；其余成员不能裁决为 NO_RELATION（缺证据 ≠ 无关系）。
- 整改方向：课程所有者决定——补讲义内容后重新审核，或维持这些成员 unresolved（阻断三族闭合直到裁决完成）。

## G6 课程侧 canonical 节点覆盖极小

- `canonical-nodes.json` 仅 220 个课程侧节点；与 7300 Authority 成员的精确名称匹配仅 71（tier-A）。
- 影响：多数关系的证据锚点只能落在讲义段落（src: 路径#标题），无法落到课程侧 Canonical 身份；正式决策应用需要证据注册表覆盖这些引用。

## G7 DB 投影节点名称为 slug 且覆盖不全

- `ActkgProjectionNode` 表 744 行，semanticName 为 slug（如 `modeling_v2r_recovered_<hash>`），无中文显示名。
- 不构成阻断（名称真源已改用 review-projection），但作为运行态查询面不完整。

## 已核实非问题（避免重复排查）

- v0.22-r5 `review-projection.json` 是完备名称源（7300/7300，含中文描述）。
- root-locus 域包（ActKG 独立目录）质量完好：103 节点均有中文标签与描述，与 scope 成员 id 完全一致。

## 概念覆盖缺口与修复跟踪（负责人裁决 2026-08-25 决策 3a 建档）

口径：卡片键名（838 唯一）对 crosswalk-v037 概念名形态节点（label ≤30 字）的精确匹配。基线建档 2026-08-25。

### G8 概念仅存在于 D1 排除域（38 键，已确认/无需修复）

s平面到z平面的映射、z变换、保持器、加权序列、单位斜坡响应、差分方程、拉普拉斯变换、数字控制器 等 38 键（34 概念名）只命中排除域（离散控制/最优控制/李雅普诺夫）同名节点。按 D1 域级排除不入投影绑定；若后续图谱版本为这些概念建涵盖域节点，重新精确匹配即可恢复。状态：**确认接受（2026-08-25）**。

### G9 概念名差异/图谱无对应节点（595 键，开放缺口）

示例：ANFIS、A_D转换器、Bode图（图谱名"对数频率特性曲线"）、I型系统（图谱可能名"系统型别"）、MATLAB 控制系统工具箱、IMC/SIMC 整定、LQ/LQG 最优控制（超纲族）。三类成因：①同义异名（Bode图↔对数频率特性曲线）——可用同义词表修复；②图谱无此概念（ANFIS、MATLAB 工具类）——需图谱版本演进；③超纲派生（LQ/LQG）——维持排除。状态：**开放，后续语义批次处理**。

### 已核实事实（避免重复排查）

- crosswalk-v037.json 的 176 个 v0.37 新成员 domain 字段停留在 `unassigned-pending-domain-review`（归属结果只更新了 scope 与 assignments.jsonl）。域真源以 scope.json preferredDomainId 为准；crosswalk 旧密封件不改，各绑定/索引构建一律用 scope 域。
- 图谱已切换到 presentation 层 `v0.37-r3`（2026-08-25，见 `formal-resource-remediation/v037r3-switch-summary.json`）：canonical 图字节与 v0.37 完全一致（releaseHash `cc73fa15…`、sourceDatasetHash `2f7f8245…`、schema sha 均不变），7476 成员零增删，冻结链（allocation/scope/crosswalk/闭合/投影/信封/交接）零重封。r3 交付为 presentation 侧：公式渲染索引 +607 条、双语内容 +1275 条与 905 条 statement 修订、5 个新增富文本/公式 sidecar。**G8/G9 基于成员集判定，在 r3 下维持原结论不变。**

### 修复跟踪

| 日期 | 项 | 动作 | 状态 |
|---|---|---|---|
| 2026-08-25 | 卡片映射构建缺陷 | 原映射表仅 31 概念（51 键/434 原子）；查证发现 crosswalk 精确匹配可命中 205 键——属映射构建不足而非概念缺失。生成 `resource-layer/text/card-name-index.json`（涵盖域优先，域真源取 scope）替换旧 map，卡片原子级绑定 434→1383 | **已修复** |
| 2026-08-25 | 习题"闭环特征方程"类误过滤 | 7 条映射指向排除域同名节点；state-space 域存在精确同名节点，改指涵盖域节点（决策 4-A） | **修复中** |
| 2026-08-25 | 图谱 presentation 层切换 v0.37 → v0.37-r3 | 检出 r3 bundle（source-r4 @ 3e98864）至 `releases/control-theory-engineering-v0.37-r3/`；canonical 字节逐 sha 核验不变，冻结链零重封；公式 sidecar +607 条、双语 +1275 条/905 条修订落位 | **已修复** |
| — | G9 同义异名 595 键 | 待后续语义批次建同义词表（r3 canonical 不变，缺口维持） | 开放 |
