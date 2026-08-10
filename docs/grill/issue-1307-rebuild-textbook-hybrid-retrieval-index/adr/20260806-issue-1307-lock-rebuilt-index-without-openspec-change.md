---
status: accepted
---

# Issue #1307 直接锁定重建索引产物，不引入 OpenSpec 变更

Issue #1307 只修复教材混合检索索引与 Loader Schema、textbooks-v2 的版本漂移。grill 确认不新增 OpenSpec change，保留 `bdc6dd1` 配置锁提交，并在同一 PR 中提交决策文档与实现；`ajv` 环境依赖与 `textbook-v2-input-provenance` 资产缺失作为独立问题记录，不修改 Loader 绕过校验。PR 合并 `integration` 后使用 `Fixes #1307` 自动关闭，资源包进入正式发布由后续 Release 流程负责。

**Consequences**: Issue #1307 的完成边界是 PR 合并；资源可获取性不阻塞本 PR，但需要 Release issue 继续跟踪。
