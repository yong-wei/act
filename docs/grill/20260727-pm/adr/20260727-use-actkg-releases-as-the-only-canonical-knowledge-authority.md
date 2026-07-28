---
status: accepted
context: authoritative-knowledge-graph-migration
supersedes_in_part: docs/adr/0038-use-repository-authoring-data-as-the-only-knowledge-source.md
---

# 以 ActKG Release 作为规范知识的唯一可编辑权威

规范知识对象、工程关系、来源证据和治理结论只在独立 ActKG 项目中编辑，并通过不可变 Release 进入 ACT。ACT 对 Release 执行校验、版本固定、导入和消费，但不得直接修改其中的 Canonical ID、类型、标签、工程关系、证据或治理状态；修订必须回到 ActKG 并形成新的正式 Release。

ACT 仓库继续作为课程编排、KAQ、资源知识绑定和暂未由 ActKG 发布的教学 Overlay 的作者真源。这些数据引用固定的 ActKG Canonical ID 和 Release，不复制规范知识内容，也不通过双向同步建立第二个可编辑真源。

该决定以跨项目发布和版本升级流程换取单一权威边界，避免 ACT 导入副本与 ActKG 后续 Release 发生不可判定的语义分叉。
