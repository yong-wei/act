## Context

`classifyGenericStudyQuestionIntent` 对 `generic-chat` 的最新用户问题做关键词包含匹配，顺序为规范内容 → 公式推导 → 代码调试 → 概念辨析 → 开放讲解，其余全部 `fact-explanation`。现有测试只覆盖带“推导/报错/区别/规范格式/换一种格式”等显式词的问法。仓库内用真实 `buildKonlingTeachingAssistantRuntimeContract` 复现：五类非事实隐式问法全部塌到 `fact-explanation`。#1816 引用的 120 用例实验数字不在仓库内，但分类器残差桶机制与 Issue 因果描述一致。`upgrade-konling-traceable-study-qa`（#991）已引入六类合同并把事实解释设计成默认回退；本变更是后续纠偏，不复用该 change_id。

## Goals / Non-Goals

**Goals**

- 标准问法与隐式问法都分到同一意图。
- `fact-explanation` 只用于定义、含义、是什么类问题。
- 120 个固定用例进入自动测试，并达到 Issue 给出的 F1/召回门禁。
- 不改变 `answerIntent` 字面量集合和调用方形状。

**Non-Goals**

- 不更换回答内容模型或供应商。
- 不实现 #1818 的规范内容 fail-closed 安全门禁。
- 不把分类器改成调用 LLM。

## Decisions

1. **规则分类器，不用模型。** 在现有函数上扩展中文/英文隐式线索，并收紧事实解释的正向规则。残差若仍无法判定，优先落在最接近的学习问答意图，而不是事实解释。
2. **冻结夹具为真源。** `src/lib/konling-study-question-intent-cases.json` 保存 6 类 × 10 题 × 2 问法。测试读取该文件，计算混淆矩阵与宏平均 F1，不在测试里手写另一套题面。
3. **度量在测试进程内计算。** 不引入新的评测服务。门禁：总体宏平均 F1 ≥ 0.80，每类召回 ≥ 0.75，`normative-content` 召回 ≥ 0.90。
4. **合同兼容。** 继续由 `buildKonlingTeachingAssistantRuntimeContract` 输出 `answerIntent` 与 `studyQuestion.intent`；禁止新增并行分类入口。

## Risks / Trade-offs

- [隐式规则过宽误伤事实题] → 事实解释保留“什么是/定义/含义/是什么”等正向规则，并在 120 用例中保留事实类隐式问法。
- [规范内容与合格/必须用语重叠] → 规范规则先于事实规则，并单独提高 `normative-content` 召回门禁。
- [120 原实验题面不在仓库] → 夹具按 Issue 的六类定义重写控制论教学问法，绑定本修订；不伪造 2026-09-01 实验原始文件。

## Migration Plan

1. 写入 120 用例夹具与度量测试（当前隐式非事实题应暴露塌缩）。
2. 调整分类规则直到门禁全绿。
3. 跑聚焦 Konling runtime 测试，确认既有显式问法与 `answerIntent` 调用方不回归。

## Open Questions

None.
