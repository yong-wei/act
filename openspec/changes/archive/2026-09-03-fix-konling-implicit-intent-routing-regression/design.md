# Design

## 测量口径分层（关键事实）

| 层 | 测量对象 | #1903 实验数字 | 仓库内确定性复核 |
| --- | --- | --- | --- |
| 路由层 | `buildKonlingTeachingAssistantRuntimeContract(...).answerIntent` | — | 冻结 120 例准确率 100%，六类召回 1.00 |
| 生成层 | 模型回答实际结构/行为是否符合意图 | 49.2% 准确率、开放讲解精确率 26.1% | 不在本层复现（外部模型生成） |

两层共用同一冻结题库但口径不同。本 change 交付路由层确定性门禁；生成层指标归 #1900 评测框架（act-dev3 进行中），报告时必须分层，不得混用。

## 分组指标

复用 `src/lib/konling-study-question-intent-cases.json`（120 例，每意图 10 标准 + 10 隐式），按 `phrasing` 字段分组，各自计算准确率、宏平均 F1、逐类召回与混淆矩阵，并按 issue 验收门禁断言：

- 准确率 ≥ 0.80；宏平均 F1 ≥ 0.75；逐类召回 ≥ 0.70；`normative-content` 召回 ≥ 0.90。
- 断言"误判不集中"：任一兜底类别接收的误判数不超过全部误判的一半（当前 0 误判，恒真但保留为防回归断言）。

评测输出同时 `console.info` 两组摘要，供人工与 CI 日志核对。

## 多意图主意图优先级

分类器判定顺序即主意图优先级，稳定且可解释——安全与方法论优先：

```
normative-content（规范/安全）
  > formula-derivation（方法论）
    > code-debugging（故障）
      > concept-comparison（辨析）
        > open-ended-explanation（显式开放特征）
          > fact-explanation（定义/是什么）
            [默认回退] open-ended-explanation
```

优先级与语序无关（子串匹配天然顺序无关）；默认回退为 `open-ended-explanation` 且仅当无任何更强信号命中。

回归用例（内联冻结于测试文件）锁定双向语序的代表性组合：

- 规范+公式推导（两种语序）→ `normative-content`
- 公式推导+代码调试（两种语序）→ `formula-derivation`
- 代码调试+概念辨析（两种语序）→ `code-debugging`
- 概念辨析+开放讲解（两种语序）→ `concept-comparison`
- 定义+开放讲解（两种语序）→ `open-ended-explanation`（显式开放特征先于事实命中）
- 无任何强信号的普通请求 → `open-ended-explanation`（默认回退唯一，不落事实桶）

## 为什么不改生产代码

分类器自 #1816（`96d0cd32e0`）后在冻结集上全绿；#1901 的词表统一只增不减规范触发面（已验证不翻转任何非规范冻结例）。本 change 的风险面是"未来重排/增删关键词静默改变路由"，测试与 spec 锁定即为最小充分修复。若后续生成端实验证实存在冻结集之外的隐式表达缺口，按新样本滚动补例，不在本 change 预先扩张关键词表。
