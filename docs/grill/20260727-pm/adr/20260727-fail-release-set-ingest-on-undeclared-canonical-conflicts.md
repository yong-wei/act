---
status: accepted
context: authoritative-knowledge-graph-migration
---

# 未声明的规范对象冲突必须阻断 ReleaseSet 导入

同一个候选 ReleaseSet 中，每个 Canonical Object 和权威关系只能具有一个有效语义版本。多个并列 Release 重复携带同一身份时，规范化内容必须一致；对象或关系真实变化必须通过显式修订或 Release 取代关系进入。

如果多个 Release 对同一 Canonical ID 或关系提供不一致内容，却没有声明修订或取代关系，整个候选 ReleaseSet 导入失败，不按发布时间、领域优先级或加载顺序选择结果，也不生成部分合并图谱。

该规则要求 ActKG 发布包显式表达跨域共享和版本演进，但确保 ReleaseSet 合并结果不依赖环境或文件顺序。
