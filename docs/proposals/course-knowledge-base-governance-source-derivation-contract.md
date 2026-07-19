# 课程知识基座治理来源与派生契约

本文是阶段一清单制备系列的可复现来源合同。它只定义未来只读清单 CLI 的输入、规范化、摘要和漂移报告，不声称仓库已经存在该 CLI，也不实现生成器、迁移或运行时代码。

## 决策来源

- `docs/contexts/course-knowledge-base/CONTEXT.md`
- `docs/adr/README.md` 中“课程知识基座治理决策来源”逐项列出的三十个真实 ADR 文件
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
- 历史引用面：`KnowledgeProgress.nodeId`、`LearningNote.nodeId`；`LearningPath.nodeIds/currentNodeId/entryNodeId/pathPayload/terminalValidation/lastExecutionMetadata`；`LearningPathExecution.nodeId` 及其证据 JSON；路径偏离与干预引用；`LessonItem.knowledgeNodeId`；`LearningFact.contextJson` 根级及 `evidenceGovernance` 下 registry 列出的知识、图、资源和工件版本引用；以及可重放的 `InteractionLog.eventData`、`LearningEventBatch.events` 与学习者派生数据集。`versionRefs` 属于工件版本 namespace，只有明确声明的知识修订字段才能进入知识修订 namespace。事件重放必须先完成引用迁移或明确退役，不能从旧事件重新引入旧知识 ID。
- 消费与写入入口：runtime loader、资源绑定 API、SAR binding review、数据库直写 API、feature persistence、worker、migration、repair/seed/sync 脚本。清单 CLI 必须在 `src`、`scripts` 和声明的 course-content 生产入口内以 AST 追踪 Prisma delegate alias、事务 delegate、嵌套 relation mutation 和生产者调用链，发现 `KnowledgeNode`、`KnowledgeLink`、`LessonItem.knowledgeNodeId`、`TeachingResource.knowledgeNodes`、`LearningPath`、`LearningPathExecution` 和 `LearningFact` 写入，并与 registry 双向对账；阶段二的每个入口都必须得到 `retire`、`authoring_workflow` 或 `projection_only` 处置。

正式课程范围锚点必须形成独立、可复现的 anchor record，至少包含 `anchor_id`、`anchor_scope`、`anchor_type`、course identity、可空的 module/lesson identity、`source_locator` 与 `text_digest`。course scope 的 module/lesson 为规范 null，module scope 的 lesson 为规范 null；空字符串和伪造层级 ID 无效。`anchor_id` 由这些字段派生；inventory 只库存来源中实际存在的锚点，identity 只引用候选证据，阶段一不得据此批准概念准入。

学习者数据只形成数据集级记录：来源类型、schema/version、记录数和去标识化聚合处置统计。仓库摘要只覆盖 schema、计数和这些聚合统计，不得对 `userId`、原始答案、事件载荷、风险描述、画像正文或任何原始行内容计算并提交可关联摘要。去标识化聚合的最小群体规模为 5；低于阈值的单元只输出 `suppressed`，稀有类别必须合并或抑制，且不得发布可组合出低基数单元的交叉维度统计。行级摘要、迁移键和迁移结果只保留在受控数据库侧审计。测试 fixture 必须完全合成并覆盖 1–4 人小样本。
画像、诊断、风险、成长、推荐和班级聚合的切换对账必须在数据库侧形成 `preserved/recomputed/expired/resolved/unresolved/blocked` 处置，并验证七维画像、最新有效快照唯一性、来源 lineage、拆分证据不复制、退役引用清零、推荐失效处理和班级聚合同版本输入。`GrowthRecord.sourceInputDigest` 等行级输入指纹仅可用于数据库侧审计，不能成为仓库 version field、摘要或低基数分组。

所有数据库来源必须来自同一不可变导出，或同一个 `REPEATABLE READ READ ONLY` 快照。事务模式记录实际隔离级别、事务开始时间、导出快照 token 与共享导入次数；导出模式记录不可变对象 ID、生成时间与整体摘要。`snapshot_id` 必须从所选证明材料派生，不能由调用方任意指定；相同标签但不同事务或导出对象必须失败。库存同时记录 `captured_at` 和各数据集 watermark。

## 规范化与去重

- `schema_version`、`algorithm_version` 和 `normalization_profile` 必须显式版本化；算法或模式变化必须改变对应版本。
- 文本先执行 Unicode NFC；身份名称另执行受版本控制的空白折叠和大小写规则，不做未经声明的语义改写。
- 仓库路径转换为根相对 POSIX 路径，拒绝绝对路径、`..`、符号链接逃逸和平台分隔符差异。
- 文本换行规范为 LF，UTF-8 无 BOM；是否保留结尾换行由 schema 明确，摘要前不得依赖宿主平台换行。
- 规范排序按 typed record 的 `(item_kind, identity_namespace, source_id, source_locator)` Unicode 码点顺序；数组只有在 schema 声明为集合时才排序。
- 去重键为 `(item_kind, identity_namespace, source_id)`。允许的 `item_kind × identity_namespace × source_field` 组合由 source registry 封闭定义，未知组合直接失败；不得通过字符串前缀或名称猜测类型。跨 namespace 的同文字符串不得去重、合并或改变 owner。混合学习路径节点若没有显式 discriminator，只能进入 unresolved 记录，不能映射为规范知识节点。关系、卡片和迁移输入均以各自 typed record 纳入。
- 所有历史 JSON decoder 必须在 registry 中声明版本、机器可读 selector、namespace、父子 join、discriminator、schema source、摘要规则和失败策略；未知版本、未知 ID-bearing 字段或无法判定 namespace 的值进入 unresolved 并阻断就绪。
- 缺失文件编码为确定性 typed record，至少包含规范路径、`state: missing`、reason code 和 expected schema；缺失状态参与摘要并阻断需要该输入的下游就绪。
- course、course module、lesson、lesson item、resource、resource container、registry entry、runtime projection、assessment、activity、citation 和 source 使用互不混合的 identity namespace；同文 ID 不得跨 namespace 合并。

## 摘要分层与漂移

- `governance_contract_digest`：本文、source registry、两阶段系列及其封闭 acceptance-profile 定义、CONTEXT 和 ADR 真实索引集合的规范逐源摘要所形成的聚合摘要。
- `source_snapshot_digest`：本次库存中所有规范化源记录的有序聚合摘要。
- `upstream_manifest_digests`：按 manifest kind 与 ID 结构化列出的直接上游清单摘要，不与 source snapshot 混为一个字段。
- `source_digests`：future-child 记录中的结构化逐源摘要列表，元素包含 source kind、规范路径或数据集身份、schema/version 和 digest。

每次运行必须同时输出逐源摘要、聚合摘要和漂移报告。漂移记录包含 source identity、drift kind、`expected` 与 `observed` 摘要或计数；没有漂移时也输出显式空列表。当前审计快照的数字只可作为带日期、来源和派生口径的 expected evidence，不能成为永久 spec 常量。

## 未来清单 CLI 验收

现有入口：无，需要后续实现新的只读清单 CLI。每个阶段一可执行子变更都必须交付完全合成且与历史结构等价的 fixture、固定真实仓库快照集成测试、重复运行字节级确定性测试和 no-write 断言；CLI 不得修改 authoring、runtime、数据库、Git 工作树或 GitHub 对象。inventory 还必须以 Prisma DMMF 验证 registry 表/字段，以全仓 AST mutation/producer 扫描验证 direct-writer 集合。真实历史 payload 只在受控数据库快照内验证 decoder；仓库只保存 shape/schema digest、计数和经小样本抑制的结果，不保存原值、行摘要或可逆标识。失败输出只包含 shape/version/error code 与抑制计数；未知 JSON payload/discriminator 必须失败。
