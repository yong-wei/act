---
status: accepted
context: authoritative-knowledge-graph-migration
---

# 分离 ActKG 来源证据对齐与 ACT 教学资源绑定

ActKG 负责 Canonical Object 到 Source Object 和 EvidenceSegment 的权威证据对齐。ACT 负责教材正文、结构单元、检索窗口、CitationTarget、访问权限和渲染，并通过稳定来源身份、片段身份、版本及内容哈希建立可核验 Crosswalk。

ACT 的课堂活动、作业、仿真、讲义等运行资源继续维护带教学角色的 Canonical Object 绑定。教学绑定描述资源承担讲解、练习、评价或引用等用途，不覆盖 ActKG 的来源证据结论，也不把 ACT 运行权限和交互配置移入 ActKG。

这一边界让 RAG 能够沿权威证据定位 ACT 正文，同时保留平台资源运行和教学治理的独立职责。
