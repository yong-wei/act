---
status: accepted
context: portfolio-reflection-provenance
---

# 作品集反思来源由服务端身份派生

当前 Copilot 和作品集页面直接从 URL 读取 `source`、`assignment` 与 `intent`，并在保存后将它们固化为不可修改的草稿 provenance。决定将平台核验 provenance 改为由服务端根据受限来源身份解析，并在创建草稿时再次校验当前学生的访问权。URL 只能携带导航提示或受限身份，不能自行证明来源、任务或意图。如果产品确实允许无平台来源的自由反思，学生填写内容必须以独立字段与明确文案标记为“学生提供”，不得映射为平台核验证据。保留现有 candidate-only 与显式保存边界；本决策只修正 provenance 的信任来源。

