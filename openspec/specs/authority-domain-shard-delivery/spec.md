# authority-domain-shard-delivery Specification

## Purpose
Deliver the active Authority knowledge workspace through bounded, version-bound domain shards while keeping optional Teaching Projection failures isolated from Engineering exploration.
## Requirements
### Requirement: Authority domain data is delivered in bounded shard classes
The system SHALL expose separate root, domain-default, relation-family, node-neighborhood and node-detail shard classes. Root shards SHALL contain only reviewed navigation domains and summaries; domain-default shards SHALL contain primary domain objects and available published teaching relations; relation-family and neighborhood shards SHALL load only after explicit user intent; detail shards SHALL contain selected-node text and media references.

#### Scenario: Authority workspace opens
- **WHEN** the active Authority root view is requested
- **THEN** the response SHALL contain the reviewed root catalog and bounded summaries only
- **AND** it SHALL NOT fetch, serialize or parse all Authority objects or relations

#### Scenario: User enters a domain
- **WHEN** a user activates a domain root
- **THEN** the client SHALL request the domain-default shard and only the endpoints needed for available published teaching relations
- **AND** no engineering relation family or detail media SHALL load without corresponding intent

#### Scenario: User requests an engineering family
- **WHEN** the user enables one engineering relation family
- **THEN** the client SHALL request only the missing family shard for the active domain
- **AND** it SHALL reuse already loaded canonical objects and relations

### Requirement: Shards use one composite version envelope
Every learner shard MUST bind the active Authority selection and reviewed domain catalog version and MUST bind the exact course active-domain scope plus ACT relation projection ID/hash when teaching data is present. The client MUST reject a shard whose required identities do not match its established root envelope. A teaching-bearing cache entry SHALL be isolated from compatible Engineering-only cache entries so a relation projection change does not force unrelated Engineering data to be discarded.

#### Scenario: Teaching Projection advances independently
- **WHEN** Authority and catalog identities are unchanged but the exact matching ACT relation projection or scope identity changes
- **THEN** teaching-bearing shard cache entries SHALL invalidate and reload under the new composite identity
- **AND** compatible Engineering-only shard cache entries MAY remain valid

#### Scenario: Authority identity changes
- **WHEN** the active Authority selection changes
- **THEN** all root, domain, family, neighborhood and detail shards from the prior Authority SHALL be rejected or invalidated

#### Scenario: Old or mismatched projection is available
- **WHEN** a Teaching Projection does not match the active Authority envelope, course, or active-domain scope hash
- **THEN** the shard SHALL omit all relations from that projection
- **AND** it SHALL not merge, adapt, relabel, or fall back to the mismatched projection

### Requirement: Optional teaching failure does not block engineering shards
The domain shard service SHALL return available Engineering objects and requested Engineering relations when the optional teaching layer is partial, empty, unavailable, or identity-mismatched. A matching teaching-bearing shard SHALL return only admitted published containment, prerequisite, and pedagogical-association edges. Public runtime responses SHALL NOT expose relation candidates, review-pack identity, confidence, reviewer, decisions, pending counts, internal `PARTIAL` governance state, or review actions and SHALL NOT manufacture teaching edges or complete-coverage claims.

#### Scenario: Matching partial projection is active
- **WHEN** a matching formal `PARTIAL` relation projection is selected for the domain
- **THEN** the shard SHALL return only its admitted published containment, prerequisite, and association edges
- **AND** it SHALL expose no internal partial, pending, candidate, review, confidence, or decision metadata

#### Scenario: Domain has no published teaching relation
- **WHEN** Authority and catalog are valid but no exact matching teaching relation projection is available
- **THEN** primary domain objects and requested Engineering families SHALL remain available
- **AND** the response SHALL not fabricate empty-complete coverage, substitute Engineering edges, or expose a runtime audit control

### Requirement: Full graph access is not part of normal user loading
Normal `/knowledge` interaction SHALL NOT request a full Authority graph or global remaining shard. Full graph access MUST remain a separately authorized diagnostics path.

#### Scenario: User enables every visible relation filter
- **WHEN** all relation filters are enabled inside one domain
- **THEN** only that domain's eligible shards SHALL load
- **AND** unrelated domains and global remaining relations SHALL not be materialized

### Requirement: Node-detail shards include governed related content and launch descriptors
An active Authority node-detail shard SHALL project the selected semantic object, published one-hop neighbors, eligible Knowledge Card and infograph references, and role-authorized registered resource bindings in one bounded response. Every optional content block and binding MUST be resolved by stable identity against the shard envelope and MUST NOT be inferred from display text.

#### Scenario: Selected node has registered resources
- **WHEN** a role-authorized selected node has one or more governed course, handout, step, textbook, simulation, Arena, or feature-owned resource bindings
- **THEN** the detail shard SHALL return their human-facing title, typed binding role, resource kind, availability, and source-owned launch descriptor
- **AND** it SHALL not expose an internal filesystem path, registry implementation path, raw canonical ID, or guessed route

#### Scenario: Optional content identity drifts
- **WHEN** a Knowledge Card, infograph, or resource-binding manifest does not match the selected Authority and applicable teaching/resource projection identity
- **THEN** the mismatched optional block SHALL be omitted with a bounded availability state
- **AND** the base semantic detail and valid published relation summaries SHALL remain available

### Requirement: Detail launch descriptors preserve source ownership and authorization
Every returned resource launch descriptor SHALL identify an existing route, registry entry, or feature-owned launcher class without embedding the owned feature's business payload. The server SHALL apply current-role visibility before projection, and the client SHALL pass the descriptor to the existing launcher instead of constructing a target from the Authority node identity.

#### Scenario: Learner launches a mapped resource
- **WHEN** the learner activates a resource action from the active Authority inspector
- **THEN** the target SHALL resolve through the existing source-owned authorization and launch contract
- **AND** the knowledge workspace SHALL retain a return path without absorbing the launched feature's business logic

#### Scenario: Binding exists but role cannot access it
- **WHEN** the selected node has a governed binding outside the current role's visibility or availability
- **THEN** the public detail shard SHALL omit the unsafe descriptor or return a bounded unavailable action permitted for that role
- **AND** it SHALL not disclose the hidden target or policy reason

### Requirement: Detail shards distinguish mathematical content from prose
Trusted Formula expressions and governed knowledge-content math nodes SHALL be projected as explicit mathematical fields suitable for the LaTeX renderer. Ordinary names, explanations, resource titles, and relation sentences MUST remain text fields and MUST NOT be promoted to mathematical content by client-side guessing.

#### Scenario: Formula detail is projected
- **WHEN** the selected object has trusted Formula content
- **THEN** the detail shard SHALL distinguish the reviewed mathematical expression from localized explanatory prose
- **AND** both fields SHALL remain bound to the same selected object and shard envelope

### Requirement: Cross-domain teaching endpoints remain real bounded relations
A published teaching relation whose adjacent endpoint belongs to another selected domain SHALL preserve both real Canonical endpoints and exact relation meaning. The active-domain shard MAY represent the remote endpoint as a bounded boundary-navigation descriptor until explicit traversal, but MUST NOT replace it with a domain catalog root, inferred recommendation, or presentation proxy identity.

#### Scenario: Published relation crosses a domain boundary
- **WHEN** a matching teaching relation connects the active domain to a Canonical Object in another selected domain
- **THEN** the shard SHALL preserve the real remote endpoint identity internally and project a safe human-readable target-domain entrance
- **AND** it SHALL not fetch the target domain's full shard or substitute its circular root navigation entry

#### Scenario: Viewer follows the boundary entrance
- **WHEN** the viewer explicitly follows an authorized cross-domain teaching relation
- **THEN** the client SHALL load the bounded target-domain shard under the same composite envelope and focus the real adjacent object
- **AND** no new relation or target identity SHALL be inferred during navigation

### Requirement: Bounded Authority shards project governed rich text for their surface
Root, domain, search, neighborhood, hover-preview, and node-detail responses SHALL project only the qualified rich-text fields and same-release math presentation data required by that bounded surface. Canvas and search responses SHALL contain bounded title and preview content; full description and learning content SHALL remain detail-only. Clients MUST NOT receive or join the complete release rich-text or math-asset indexes.

#### Scenario: Domain shard contains a formulaized title
- **WHEN** a bounded domain shard includes a node whose selected-locale title contains qualified math spans
- **THEN** the response SHALL include a safe rich-title projection sufficient for canvas, search, and accessibility presentation
- **AND** it SHALL remain bound to the shard envelope without exposing raw release or math-asset identity as user content

#### Scenario: Detail is requested after node selection
- **WHEN** a viewer selects a node with a governed rich description or block mathematics
- **THEN** the detail response SHALL add only that node's qualified full rich content
- **AND** the client SHALL not fetch the complete rich-text index or another Authority envelope

#### Scenario: Optional rich content drifts
- **WHEN** a projected document, math asset, macro profile, or ledger disposition does not match the selected shard envelope
- **THEN** the affected field SHALL fail closed and the target qualification SHALL enforce its disposition gate
- **AND** valid base topology and unrelated qualified content SHALL not be rewritten or merged with another release

### Requirement: Active root and domain shards have complete catalog coverage
The Authority shard set SHALL derive its visible-domain denominator from the exact active reviewed catalog and SHALL seal one valid domain-default shard for every visible root domain. A root entry MUST NOT be published when its default, search, neighborhood, or detail closure is absent or identity-mismatched.

#### Scenario: Fifteen-domain catalog is materialized
- **WHEN** the active catalog contains fifteen visible domains
- **THEN** the candidate shard set SHALL contain fifteen matching default shards and complete follow-on closure
- **AND** every root entry SHALL resolve to one of those exact sealed shards

#### Scenario: One domain default is missing
- **WHEN** any catalog domain lacks a matching default shard
- **THEN** shard-set qualification SHALL fail before publication
- **AND** the product SHALL NOT expose a clickable unavailable or failing root entry

### Requirement: Domain-default shards contain only bounded domain concepts
Each active domain-default response SHALL contain only qualified `DomainConcept` objects within explicit object-count and byte budgets. Formula, KnowledgeStatement, SystemModel, ModelRepresentation and future secondary types MUST be obtained through bounded search or published one-hop responses.

#### Scenario: Dense domain is opened
- **WHEN** a domain contains concepts and hundreds of secondary objects
- **THEN** its default response SHALL materialize only the bounded DomainConcept overview
- **AND** the browser SHALL NOT receive or retain the complete heterogeneous domain

#### Scenario: Secondary object is requested
- **WHEN** a viewer selects a search hit or follows a published concept relation
- **THEN** the server SHALL return a bounded matching neighborhood containing the eligible secondary object
- **AND** no client-side full-domain cache SHALL be required

### Requirement: Formula projections are sealed with bounded shard objects
The shard manifest SHALL bind each materialized Formula presentation to the current formula-render artifact, locale profile and public projection digest. Domain, search and neighborhood responses SHALL include only projections for objects present in that response.

#### Scenario: Formula projection drifts
- **WHEN** a Formula render hash, locale profile or shard object identity differs from the sealed manifest
- **THEN** the response SHALL fail closed before reaching the client
- **AND** it SHALL not load a global formula index or another version to repair the mismatch

### Requirement: Every public shard binds one qualified locale profile
Each localized public shard SHALL carry a locale-profile identity derived from the same immutable qualification package as its Authority and catalog envelope. Objects, relations, boundaries, details, formulas and accessible labels in one response MUST resolve from that single requested locale.

#### Scenario: English neighborhood is returned
- **WHEN** a qualified English neighborhood is requested
- **THEN** every localized record and formula accessibility label SHALL match the English receipt and shard envelope
- **AND** no Chinese, raw or cross-release fallback SHALL enter the response

#### Scenario: Locale profile drifts between responses
- **WHEN** a response's locale-profile identity differs from the active refresh generation
- **THEN** the response SHALL be rejected before client merge
- **AND** the prior complete locale frame SHALL remain authoritative

### Requirement: 分片交付失败向学习者投影可行动原因

Authority 分片交付失败时，API SHALL 在响应中携带稳定的机器可读失败码，客户端 SHALL 据此把失败投影为可行动的用户文案：内容未就绪类失败（指针、分片、激活或消费者收据缺失）说明知识数据尚未发布完成并给出等待或联系教师的指引，暂时故障类失败保留重试引导。投影 MUST NOT 泄露内部路径、存储结构或绝对路径。

#### Scenario: 内容未就绪失败显示发布未完成指引

- **WHEN** 已登录学习者访问知识图谱且服务端返回 `shard-absent` 或 `activation-absent` 类失败
- **THEN** 页面说明知识数据尚未发布完成，并给出等待发布或联系教师的指引
- **AND** 不显示与故障混淆的通用「暂时无法加载」文案

#### Scenario: 失败码不泄露内部细节

- **WHEN** 任意分片失败响应被投影到用户界面
- **THEN** 文案与数据属性不包含服务器内部路径、存储目录或绝对路径

### Requirement: Relation-family shards co-deliver relation endpoints
每一分片交付的关系，其全部端点对象 SHALL 与该关系在同一分片内同交付（bounded closure，对象去重，仅含呈现必需字段）。任何消费层 SHALL NOT 因端点对象缺席而丢弃已交付关系；交付但不达的关系 SHALL 视为分片构建失败并 fail closed。

#### Scenario: Engineering family shard has no dangling edge
- **WHEN** 一个 relation-family 分片交付 N 条工程关系
- **THEN** 这 N 条关系的 2N 个端点 SHALL 全部存在于同一分片或已确立的父级分片（root/domain-default）对象集中
- **AND** 物化 receipt SHALL 记录端点缺席计数为零

#### Scenario: Builder detects an undeliverable endpoint
- **WHEN** 构建期发现某关系的端点对象无法随分片交付（源数据缺席或越界）
- **THEN** 构建 SHALL fail closed 并记录该关系与端点身份
- **AND** SHALL NOT 静默交付悬空边

### Requirement: Shard coverage receipts are computed from the final payload
分片集的覆盖收据（含 `teachingCoverage.relationCount` 及同类计数字段）SHALL 在写盘前从最终序列化 payload 重算，SHALL NOT 从上游覆盖声明（如教材章节 Coverage）或构建期声明值抄录。收据与载荷不一致 SHALL 视为物化失败。

#### Scenario: Receipt matches payload per domain
- **WHEN** 分片集物化完成
- **THEN** 每个域的覆盖收据计数 SHALL 等于该域最终分片 payload 中的实际关系/对象计数
- **AND** 不一致时物化 SHALL fail closed

