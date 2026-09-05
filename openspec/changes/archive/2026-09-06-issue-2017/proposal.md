## Why

2026-09-05 三臂公平实验（18 题 × 2 重复）显示完整功能组引用精确率仅 37.6%、答案单元追溯覆盖率仅 52.1%：模型在只分配 `[1]` 的情况下仍生成 `[2]`、`[3]` 等未分配编号，部分必需证据单元没有绑定有效引用。#1951 已能测量，但提示词约束尚未转化为运行时保证。

## What Changes

- 公平实验 runner 在 full-feature 臂写盘前执行引用编号白名单校验（`enforceKonlingCitationNumberWhitelist`）：只保留分配编号；未分配编号删除标记并将对应结论降级为待核验；代码块与技术下标沿用既有豁免判定。
- 按同一 scan 口径计算 evidence-required 单元覆盖缺口，缺口时执行一次有界修复：追加显式证据缺口说明降级为待核验，不伪造引用标记。
- 规范类回答（normative-content）保持 verification-required 语义：缺失引用不构成核验，不把非权威来源升级为已核验。
- 保持 citation identity、displayNumber、targetId 与正文标记一致；审计口径（#1951）不变。

## Capabilities

### Modified Capabilities

- `konling-fair-baseline-replay-evaluation`: full-feature 臂冻结快照写盘前的编号白名单与单元覆盖执行语义。

## Impact

- 新增 `src/lib/konling-fair-experiment/citation-whitelist-enforcement.ts`（确定性、无模型调用）。
- `src/lib/konling-fair-experiment/runner.ts`：写盘前接入两道防线。
- 不修改知识检索排序/召回、盲审或结构评分算法；生产 chat 路径已有 normalizeKonlingCitations（#1949）等价防线，不在本次范围。
