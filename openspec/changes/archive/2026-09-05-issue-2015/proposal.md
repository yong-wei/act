## Why

#1948 修复了当时的明确样本，但 2026-09-05 分层题库实验（`KONLING_FAIR_EXPERIMENT_BANK_V2`，18 题 × 2 重复）在 integration 上仍测得三类残余误判：完整功能组总体意图一致率 30/36（83.3%），代码调试 4/6（66.7%）、规范内容 2/6（33.3%），其余四类 100%。探针复现（同一比例）：三个回落均为开放讲解兜底——`normative-lab-safety`（实验安全规范无信号命中）、`normative-standards-currency`（GB/T 标准编号只在风险门禁正则、不在主分类器，来源词缺「教材」）、`code-hidden-defect-units`（含代码围栏与「找出隐蔽缺陷并修复」，但现象词表无标定/偏差类、解决词表无「缺陷」）。误判会选错章节合同、引用要求与规范性安全门禁。

## What Changes

- 规范类复合信号扩展：实验安全规范（`安全规范`/`安全规程`）进入规范查询标记；`教材` 进入权威来源词（与报告/论文/大纲同类）；主分类器规范分支与 #1901 风险门禁共享同一标准编号正则（`GB/T` 等），规范时效类输入不再回落兜底。
- 代码调试复合信号扩展：新增「代码围栏（```）× 排障动作或缺陷词」组合——代码片段存在且要求定位/修复/找缺陷时判代码调试，不吞并纯概念问题。
- 审计开放讲解兜底：新增信号全部置于兜底之前，兜底语义保持「无任何专业信号时默认开放讲解」不变。
- 将 18 道 V2 分层题纳入表驱动回归，按意图与难度报告混淆矩阵，断言总体一致率与各类命中率门槛。

## Capabilities

### Modified Capabilities

- `konling-study-question-intent-classification`: 组合措辞信号的意图路由扩展（实验安全规范、标准编号、教材来源、代码围栏×缺陷），并把 18 道 V2 分层题纳入表驱动混淆矩阵回归。

## Impact

- `src/lib/konling-agent-runtime.ts`：`KONLING_NORMATIVE_QUERY_MARKERS`（+安全规范/安全规程）、`KONLING_NORMATIVE_SOURCE_TERMS`（+教材）、normative 分支共享 `NORMATIVE_STANDARD_ID` 标准编号判定、code-debugging 分支新增代码围栏×（排障动作∨缺陷）组合。
- 新增 `src/lib/__tests__/konling-study-question-intent-v2-tiered-2015.test.ts`：18 题表驱动混淆矩阵与门槛断言。
- 不改变既有冻结用例（#1816/#1903/#1948 回归必须原样通过），不硬编码题面全文。
- 不改变章节合同结构、fail-closed 门禁语义与既有通过样本；#1901 平价不变量保持（主分类器与风险探测器共享词表与正则）。
