## Context

`/knowledge` 已能从 committed `engineering-graph` READY/use-combination selector 读取当前 Engineering Authority，并与历史 Legacy、管理员 candidate 诊断保持独立。当前 active renderer 没有使用图画布：它把对象循环为卡片网格，再把关系循环为卡片列表；页首和详情还直接显示 release、snapshot、activation、对象 ID、相邻对象 ID、来源定位和未映射枚举。

仓库已经具有成熟的 2D/3D force graph、布局、相机、标签、选择、焦点恢复和窄屏 inspector 基础设施，但完整 `KnowledgeGraphSystem` 同时拥有 Legacy progressive API、课程根节点、资源面板和教学关系语义。当前 Authority 必须复用图形基础能力而不能复用 Legacy 数据加载或语义投影。领域语言与决策见 `docs/grill/20260812-am/CONTEXT.md` 及其 ADR。

## Goals / Non-Goals

**Goals:**

- 让当前 Authority 以真实对象节点和真实工程关系边形成可理解、可探索的画布。
- 在大规模数据下通过确定性入口、搜索、筛选和一跳渐进展开保持可读性，并保证所有可展示对象可抵达。
- 为对象类型、谓词和方向提供稳定中文显示合同，不修改上游权威语义。
- 从当前 Authority 的所有产品界面文字和辅助技术名称中移除系统身份与原始枚举。
- 保持 active、Legacy 和 candidate 三条 API/renderer 路径独立，并保留 existing selector fail-closed 语义。

**Non-Goals:**

- 不修改、补充或重新审核 Authority 对象、关系、方向、证据和治理结论。
- 不把工程关系推断为包含、先修等尚未发布的教学关系。
- 不修改 candidate 诊断、Legacy Archive、学习路径、资源绑定、KAQ、数据库 schema 或生产 selector。
- 不取消浏览器建立拓扑和请求节点详情所需的内部关联键；本变更约束它们的展示，不把它们声明为秘密凭据。
- 不要求首屏同时绘制全部对象和关系。

## Decisions

### 以独立 Authority 视图模型驱动共享图形基础能力

新增纯客户端、浏览器安全的 Authority presentation adapter，把 `ActiveCanvasNode` 与 `ActiveCanvasRelation` 转换为图形节点、边和详情显示模型。该适配器只能依赖 active browser contract、受控显示词表和纯布局/呈现 helper；不得导入 Legacy API、progressive cache、server resolver、filesystem 或 Node built-ins。

画布复用现有 force graph、相机、标签、焦点和响应式 inspector 基础能力。若现有 renderer 只能经 `KnowledgeGraphSystem` 使用，则提取最小的 source-neutral canvas contract，而不是让 active renderer 进入 Legacy 数据加载路径。这样保留已经验证的交互质量，同时维持 active/Legacy renderer 隔离。

不选择在现有卡片之间绘线，因为卡片尺寸与大规模 force layout 不相容；也不直接渲染完整 `KnowledgeGraphSystem`，因为它会带入课程根节点、Legacy progressive fetch 和教学关系表达。

### 画布只物化当前可理解的 Authority 子图

active API 仍返回完整、身份校验通过的对象和关系集合。客户端先建立只读邻接索引，再根据当前视口物化一个有界子图：

- 初始入口从具有真实关系的连通分量中确定性选择关系丰富的权威对象及其直接邻域；选择规则只决定导航入口，不成为权威排名或新关系。
- 搜索或类型筛选可以定位任一具有可读名称的对象，包括暂无关系的孤立对象。
- 选择节点后以其真实一跳关系替换或扩展当前子图；继续选择邻居可逐步探索。
- 物化边必须同时满足真实关系存在、两个端点当前可见和显示词表可安全解释；不得生成虚拟权威节点、聚合事实边、相似度边或随机抽样边。

孤立对象显示为“暂无已发布关系”，而不是通过名称相似或布局距离补线。视图范围、搜索结果和过滤条件属于局部呈现状态，不写回 selector 或学习状态。

### 节点和边使用受控语义显示词表

已知 canonical type 映射到中文名称、形状、颜色与图标；节点本体只显示语义名称和紧凑类型信号。已知 predicate 映射到中文关系词、方向、箭头和线型，但 `predicate`、`direction`、`sourceId`、`targetId` 仍按原值参与拓扑和一致性校验。

适配器不得使用 `rawValue ?? fallback`。合法的新类型、谓词或方向尚无适配时，界面使用统一的“类型暂不可解释”“关系暂不可解释”受控状态，记录非公开诊断计数，并阻止原始值进入 DOM 文本。该状态不推断含义，也不改变 Authority 数据。

### 产品内容与内部关联身份分离

以下值可以存在于 fetch payload、内存索引、React key、请求路径和非文本测试挂钩中，但不得进入 visible text、accessible name/description、tooltip、复制内容、错误回退或产品日志：对象/关系 ID、Release/ReleaseSet、hash、Snapshot、Activation、Projection、原始枚举、内部 source locator 和实现状态。

当前 Authority 页首只显示“当前权威图谱”、对象/关系覆盖数量和面向人的范围说明。学生、教师和管理员遵守同一隐藏边界；教师或管理员可见的治理信息必须先映射为中文业务状态。原始身份诊断继续由独立受控诊断界面承担，不能借角色判断重新进入 active 产品视图。

测试标记应优先使用稳定语义状态；确需关联选中对象时可保存 opaque key，但自动化必须另外断言该值不进入文本或辅助技术树。

### 详情面板使用安全展示投影

选中节点后打开详情面板，显示名称、中文类型、说明、公式或可读教学内容、一跳关系摘要和用户可读来源。关系摘要使用邻居显示名称，不使用 neighbor ID；来源由服务端或受控字典投影为书名/章节等可读引用，只有内部定位符时显示“来源定位暂不可用”。

详情面板沿用现有移动端焦点进入、Escape/关闭和焦点返回合同。卡片或分组面板只用于详情阅读，不作为画布节点或全量关系列表。

### Accepted decision — commercial UI evidence truth

Commercial UI capture and governance are part of this change's product contract. API and provenance checks continue to validate the active identity boundary, but active API evidence stores only identity-match booleans and field counts; release, snapshot, hash, activation and projection values are never persisted in capture output. The active visual gate requires a real SVG canvas with non-empty semantic nodes, real edges, resolvable edge endpoints and visible edge geometry. It also requires one captured semantic-node detail/adjacency interaction with safe focus return.

Student, teacher and administrator active views receive the same forbidden-surface scan over text, accessible names/descriptions, titles/tooltips and copy entry points. The scan uses the current active API response's internal token set plus a fixed category vocabulary, while recording counts and pass/fail status only. Interaction evidence records three independent focus checkpoints: the semantic node before click, the detail panel after open, and the original semantic node or semantic canvas after close/Escape. `active-authority-presentation.ts`, the capture script and the governance gate are all revision-bound source inputs, so evidence from an earlier revision is invalid after any of these files changes. Tasks 4.2 and 4.3 remain open until these gates pass on a clean committed revision with real credentials.

### Accepted decision — SafeApiEvidenceV1 as the sole API evidence write boundary

The capture retains real Knowledge API requests and responses only in process memory. Every API evidence value written to browser evidence MUST be produced by one strict allowlist projector as `safe-api-evidence/v1`; the projector constructs the object explicitly and never copies request, response, URL, path, query, route parameter, header, cookie, source locator, raw enum, API identity, node/relation count or object fingerprint. Its exact shape is `schemaVersion`, fixed `roleClass`, a sequence of fixed `endpointClass` (`active-canvas`, `active-node`, `legacy`, `candidate`) with `status` and `requestCount`, and five boolean checks: active canvas identity, active node identity, provenance identity, role-request isolation and forbidden-data absence. Unknown Knowledge API endpoints fail closed. Before serialization the projector scans string leaves and UTF-8 JSON bytes for dynamic tokens and URI-encoded/decoded variants, and rejects unknown fields and path-like forms.

The governance gate independently parses this exact schema, rejects extra fields and duplicate endpoint classes, and validates active isolation from endpoint classes, status and request counts in addition to the booleans. Legacy and candidate evidence remain fixed endpoint classifications and retain their existing product-state markers without persisting raw API payloads. This decision supersedes any path- or enum-shaped API evidence; tasks 4.2 and 4.3 remain unchecked until the strict projector and gate pass on a clean committed revision with real credentials.

### Accepted decision — endpoint-specific active source identity

Active API capture uses an explicit source identity policy per endpoint. The canvas requires all five source identity fields (`authorityState`, `releaseSetId`, `releaseId`, `projectionDigest` and `sourceDatasetHash`); node detail requires the first four and may omit the contract's optional `sourceDatasetHash`. When node detail includes that field, it must be `null` or a lowercase 64-character SHA-256 and it remains in the existing in-memory sensitive-value scan; no raw source value is written to SafeApiEvidenceV1. Missing or malformed required fields, or any authority consumer, release, activation or projection mismatch, fails closed. SafeApiEvidenceV1's public shape is unchanged.

### Accepted decision — legacy selected-node API normalization

Real legacy selected-node capture issues `GET /api/knowledge/nodes/:id` in addition to the legacy graph request. The probe accepts only that exact single-segment GET route, canonicalizes it only in capture memory and aggregates it into the existing `legacy` endpoint class and request count. The raw or decoded ID, URL, query and response body remain outside all persisted evidence and error output. Missing identifiers, additional path segments, non-GET methods and every other Knowledge API route continue to fail closed. This preserves the V1 evidence format and active Authority isolation while allowing the existing legacy matrix to be captured truthfully.

### Accepted decision — shared sensitive-value matching and observed node proof

The artifact serializer and active product surface scanner MUST use one deterministic `SensitiveValueMatcher`. It expands each in-memory sensitive value to the raw, URI-encoded and once-decoded equivalent variants, then scans both final JSON bytes/string leaves and DOM text, ARIA names/descriptions, titles, tooltips and copy payloads. The matcher returns only counts/booleans; no matched value or error may be persisted.

`safe-api-evidence/v1` requires both `activeNodeRequestObserved` and `activeNodeIdentityVerified`. The only valid states are false/false (no active-node request), true/false (a request was observed but its status, endpoint/selected-node match or provenance failed), and true/true (a 200 active-node response matched the requested node and provenance). False/true is invalid, as are missing or optional fields. Authenticated role detail evidence and the desktop-dark detail state require true/true with an active-node sequence entry at status 200 and positive request count. Responsive states without detail interaction explicitly record false/false and cannot inherit verification from another state. All capture failures remain fail-closed; tasks 4.2 and 4.3 remain unchecked.

### Accepted decision — deterministic four-row Authority layout

The desktop and tablet Authority canvas keeps its fixed `960 × 520` coordinate space. For each visible scope of up to 24 nodes, the layout derives a stable column count from both the near-square arrangement and a four-row ceiling: `min(6, max(ceil(sqrt(n)), ceil(n / 4)))`. Five- and six-column scopes use compact horizontal spacing; the resulting node bounds remain inside the canvas at the default zoom and pan. The compact mobile canvas remains a separate two-column, six-node presentation.

Capture validates the real SVG rectangle and requires every rendered node and relation geometry to be contained within it for desktop, tablet and mobile states. Search materialization, one-hop expansion, return-to-overview and view reset must preserve the same deterministic containment invariant. This is a presentation-only correction: it does not change Authority topology, create edges, hide expected scope members or alter API/selector behavior.

## Risks / Trade-offs

- [共享 renderer 隐含 Legacy 假设] → 只复用 source-neutral 图形 contract；通过静态边界测试禁止 active importer 进入 Legacy request/cache/system facade。
- [4,891 个对象使布局、DOM 标签或 GPU 负载失控] → 只物化有界可见子图，邻接索引留在内存；用真实数据浏览器性能证据验证初始加载、选择与展开。
- [渐进呈现被误认为数据不完整] → 显示当前可见范围与总覆盖数量，提供搜索、类型筛选、返回总览和清空探索路径。
- [未知类型或谓词被静默丢失] → 显示有界的“暂不可解释”状态与非公开诊断计数，不暴露 raw value，也不伪造中文含义。
- [字符串隐藏测试只覆盖视觉文本] → 同时审计 DOM text、ARIA、tooltip、copy payload、错误回退和三角色浏览器证据。
- [新 UI 破坏已验收的 active/Legacy/candidate 隔离] → 保留现有 workspace mode owner，并加入网络请求与选择状态回归测试。

## Migration Plan

1. 先建立 presentation adapter、受控词表和字符串隐藏的单元/结构测试。
2. 在不改变 active API selection 的前提下接入 source-neutral 画布、搜索/筛选和一跳展开。
3. 将详情面板切换为安全展示投影，删除页首、节点、关系与来源中的内部字符串回退。
4. 运行相关单元、类型、lint、商业 UI 治理和真实 Authority 浏览器验收；在最终干净 revision 上重新捕获三角色、响应式与视觉证据。
5. 发布使用普通 cutover-aware application refresh；本变更不执行或修改图谱 selector transaction。若新 UI 验收失败，应用版本可回退，Authority selector 和数据保持不变。

## Open Questions

无。节点—关系表达、渐进探索、全角色系统身份隐藏及不补造关系的边界已经由用户确认，剩余实现选择可由上述合同确定。
