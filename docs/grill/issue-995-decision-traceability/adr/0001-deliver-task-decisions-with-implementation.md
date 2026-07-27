---
status: accepted
context: issue-995-decision-traceability
---

# 决策记录与实现作为同一 PR 交付

每项实施任务使用独立的任务决策目录，保存 Grill 决策记录和机器可读任务清单；有 OpenSpec 时在清单中关联 change，无 OpenSpec 时保存 `plan.md`。本地提交校验清单完整性，PR 校验清单对整条变更范围的覆盖，使文档可以分提交形成但必须随同一 PR 交付。相比仅依赖技能约定或按代码路径猜测，这增加了清单维护成本，却保留了可审计的决策依据和明确的任务边界。
