# 课程知识基座治理来源与派生契约

本文是阶段一清单制备系列的可复现来源合同。它只定义未来只读清单 CLI 的输入、规范化、摘要和漂移报告，不声称仓库已经存在该 CLI，也不实现生成器、迁移或运行时代码。ADR 0045 是历史事实边界的优先决策。

## 范围合同

阶段一 readiness 只使用五类权威输入：当前正式课程与已审核范围锚点；当前 authoring 内容、卡片、媒体和资源；当前发布图谱及绑定迁移比对；切换时仍被业务读取或继续执行的课程、资源、进度、笔记和未完成路径引用；经审核的 active legacy knowledge ID 到 canonical ID 映射。

历史 `LearningFact`、事件、诊断、画像、风险、成长、推荐、班级聚合、Arena 记录和已完成路径冻结在原图谱修订。它们不逐行重解释、不重放、不去重、不回填到新图谱。没有可证修订的旧事实通过 `legacy-unversioned` 或 legacy snapshot 兼容解析。本系列不生成、不消费、不验证相关 decoder、lineage、writer 或派生数据目录；独立治理工作即使另行维护这些资料，也不属于本系列工件或输入。

切换后的新事实必须在写入时绑定唯一活动的新图谱修订。验证只覆盖这条 post-cutover 写入边界，不要求全库历史 producer、decoder 或 writer 闭包。

## 决策来源

- `docs/contexts/course-knowledge-base/CONTEXT.md`
- `docs/adr/README.md` 中“课程知识基座治理决策来源”逐项列出的三十一个真实 ADR 文件
- `docs/knowledge-graph-current-state-audit-2026-07-18.md`，仅作版本化现状证据
- `docs/proposals/course-knowledge-base-governance-source-registry.yaml`，机器可读的来源、selector、namespace 和缺失策略真源
- 本文

ADR 来源集合从 README 索引解析真实相对路径，按仓库相对 POSIX 路径的 Unicode 码点字典序排列。每个文件记录规范内容摘要，再以有序 `(path, digest)` typed record 序列计算聚合摘要；不得引用或探测不存在的聚合路径。

## 输入闭包

清单 CLI 必须只从 source registry 的显式 allowlist、glob、排除规则、数据库字段和 schema-aware selector 读取。registry 自身属于治理合同，任何路径、表、字段、JSON selector、namespace 或缺失策略变化都必须改变 `governance_contract_digest`。来源类别说明如下，精确闭包以 registry 为准：

- 正式课程目标与能力目标；course、course module、lesson 及其编排链接。
- `course-content/authoring/` 下的 lesson `manifest.json`、handout、BOPPPS、multimedia 设计稿、interactive page、interactive contract、interactive design acceptance、interactive implementation acceptance、card sequence 与知识卡作者态。
- `course-content/runtime/` 下的 `lesson.json`、学生 handout、BOPPPS 投影、interactive manifest、媒体索引与实际服务文件、知识卡/runtime sequence，以及内容 review result；这些只作为 authoring 投影一致性证据，不作为可编辑真源，也不得与 authoring 合并计数。knowledge authoring、knowledge runtime 与 resource-governance runtime 使用独立 source、namespace、truth role 和计数；runtime 漂移只产生失败证据，不能进入概念候选真相。
- 知识节点、关系、领域标签、资源注册与资源语义投影的版本化现状来源。
- 投影生产入口：`course-content/scripts/review_lesson_content.py` 和 `course-content/scripts/export_runtime.py`；runtime review JSON 仍仅为一致性证据。
- 活跃引用面：切换时仍被业务读取的 `KnowledgeProgress.nodeId`、`LearningNote.nodeId`、课程/资源知识引用，以及 `pathStatus != completed` 且有已声明当前业务 reader 读取或继续执行的 `LearningPath` 当前字段。已完成路径、execution/deviation/intervention 行、历史事件和学习事实只保留原修订解析，不进入迁移清单。
- 切换写入面：新投影导入、活动图谱切换，以及 post-cutover 新事实写入时的唯一活动修订绑定。本系列不建立历史写入口、decoder 或全仓 AST writer 目录。

正式课程范围锚点必须形成独立、可复现的 anchor record，至少包含 `anchor_id`、`anchor_scope`、`anchor_type`、course identity、可空的 module/lesson identity、`source_locator` 与 `text_digest`。course scope 的 module/lesson 为规范 null，module scope 的 lesson 为规范 null；空字符串和伪造层级 ID 无效。`anchor_id` 由这些字段派生；inventory 只库存来源中实际存在的锚点，identity 只引用候选证据，阶段一不得据此批准概念准入。

阶段一不导出、对账、统计或验证历史学习者派生数据，也不维护相应诊断目录。

活跃引用数据库输入必须来自同一不可变导出或同一个 `REPEATABLE READ READ ONLY` 快照，并保留必要的快照证明。该要求不扩展为全历史数据库导出。

## 规范化与去重

- `schema_version`、`algorithm_version` 和 `normalization_profile` 必须显式版本化；算法或模式变化必须改变对应版本。
- 文本先执行 Unicode NFC；身份名称另执行受版本控制的空白折叠和大小写规则，不做未经声明的语义改写。
- 仓库路径转换为根相对 POSIX 路径，拒绝绝对路径、`..`、符号链接逃逸和平台分隔符差异。
- 文本换行规范为 LF，UTF-8 无 BOM；是否保留结尾换行由 schema 明确，摘要前不得依赖宿主平台换行。
- 规范排序按 typed record 的 `(item_kind, identity_namespace, source_id, source_locator)` Unicode 码点顺序；数组只有在 schema 声明为集合时才排序。
- 去重键为 `(item_kind, identity_namespace, source_id)`。允许的 `item_kind × identity_namespace × source_field` 组合由 source registry 封闭定义，未知组合直接失败；不得通过字符串前缀或名称猜测类型。跨 namespace 的同文字符串不得去重、合并或改变 owner。混合学习路径节点若没有显式 discriminator，只能进入 unresolved 记录，不能映射为规范知识节点。关系、卡片和迁移输入均以各自 typed record 纳入。
- 活跃引用 decoder 必须声明版本、selector、namespace 和失败策略，并且只处理符合封闭活动路径谓词的当前字段。历史 decoder 不属于本系列；legacy 兼容只读取原修订或不可变 snapshot，不猜测当前语义。
- 缺失文件编码为确定性 typed record，至少包含规范路径、`state: missing`、reason code 和 expected schema；缺失状态参与摘要并阻断需要该输入的下游就绪。
- course、course module、lesson、lesson item、resource、resource container、registry entry、runtime projection、assessment、activity、citation 和 source 使用互不混合的 identity namespace；同文 ID 不得跨 namespace 合并。

## 摘要分层与漂移

- `governance_contract_digest`：本文、source registry、两阶段系列及其封闭 acceptance-profile 定义、CONTEXT 和 ADR 真实索引集合的规范逐源摘要所形成的聚合摘要。
- `source_snapshot_digest`：本次库存中所有规范化源记录的有序聚合摘要。
- `upstream_manifest_digests`：按 manifest kind 与 ID 结构化列出的直接上游清单摘要，不与 source snapshot 混为一个字段。
- `source_digests`：future-child 记录中的结构化逐源摘要列表，元素包含 source kind、规范路径或数据集身份、schema/version 和 digest。

每次运行必须同时输出逐源摘要、聚合摘要和漂移报告。漂移记录包含 source identity、drift kind、`expected` 与 `observed` 摘要或计数；没有漂移时也输出显式空列表。当前审计快照的数字只可作为带日期、来源和派生口径的 expected evidence，不能成为永久 spec 常量。

## 未来清单 CLI 验收

现有入口：无，需要后续实现新的只读清单 CLI。每个阶段一可执行子变更都必须交付合成 fixture、固定真实仓库快照集成测试、重复运行字节级确定性测试和 no-write 断言；CLI 不得修改 authoring、runtime、数据库、Git 工作树或 GitHub 对象。inventory 只验证阶段一权威输入和活跃引用字段；历史 payload、全 root writer equality 与学习者派生状态不生成、不消费、不验证。
