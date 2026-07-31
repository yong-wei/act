## Context

现有教材 RAG 已具备结构化正文、混合召回、重排和引用锚点。Canonical 图谱应增强候选生成，但不能改变正文证据所有权。

## Goals / Non-Goals

**Goals:**

- 将图谱实体对齐和扩展迁移到 Canonical 身份。
- 通过经治理的 ACT EvidenceStructuralUnitCrosswalk 定位 ACT 正文。
- 保持最终引用可读、可跳转、可核验。

**Non-Goals:**

- 不把节点摘要或关系当作直接引用证据。
- 不复制教材全文进图谱 Repository。
- 不在候选阶段替换生产 RAG。

## Decisions

1. 查询先在当前已接受候选 ReleaseSet 和版本匹配的 CourseCoverage 内进行 Canonical 实体对齐，再沿 RAG 显式支持的谓词执行有限关系扩展。
2. 上游 RAG reference 只作为候选 seed；只有经治理的 ACT EvidenceStructuralUnitCrosswalk 才能定位 ACT 结构单元、RetrievalChunk 和 CitationTarget。
3. 词面、向量、重排和证据裁决继续决定最终正文，图谱信号仅影响候选与排序。
4. 最终 citation owner 必须是可访问的教材结构单元或锚点，不能是图谱对象或存根。
5. 影子模式并行记录旧/新候选差异，不向用户混合两套结果。
6. RAG authority selector 在最终统一切换前固定为 Legacy；影子完成度不自动改变生产回答来源。

## Risks / Trade-offs

- [关系扩展降低精度] → 只开放显式支持谓词和有限跳数，并由重排裁决。
- [ACT Crosswalk 缺失或版本漂移] → 对应候选不能晋升最终引用，记录诊断而不把上游 reference 或 Legacy 知识当作替代证据。
- [检索延迟增加] → 缓存实体对齐和 ACT Crosswalk 解析，保持查询预算。

## Migration Plan

先建立影子查询与离线相关性样本，再完成真实教材引用 E2E。最终生产启用由统一切换门禁控制。

## Open Questions

无。
