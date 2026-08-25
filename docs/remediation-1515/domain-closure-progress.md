# Issue #1515 三族关系域闭合进度（任务族 9 执行记录）

最后更新：2026-08-24。本文件记录三族教学关系逐域课程所有者裁决的执行状态，供后续会话续接任务族 10–12。

## 闭合机制

- 裁决流程：成员清单（crosswalk + review packs 导出）→ Codex 教学语义审核（use-codex，gpt-5.6-sol medium，scope `act:issue-1515:review-*`）→ JSONL 逐成员裁决 → `scripts/knowledge-cutover/close-domain.ts` 应用并密封闭合收据。
- 裁决原则（负责人已裁决）：A=教材例题级条目（三族 NO_RELATION）；C-out-of-scope=超纲（三族 NO_RELATION）；C-handout-gap=正当讲义缺口（提议三族关系，含 PARENT/TARGET canonicalId）。
- 分母与证据基线：v0.22 relations scope（`ctr:release:control-theory-engineering-v0.22`），分配哈希 `343025da…`（v0.37 兼容增量后重封）。

## 已闭合域（9 个涵盖域全部完成，2026-08-24）

| 域 | 成员 | 裁决行 | 分类（A / oos / gap） | 发布边 | 收据目录 |
|---|---|---|---|---|---|
| root-locus | 103 | 309 | 早期批次 | 45 | root-locus-closure |
| robustness-sensitivity-analysis | 209 | 627 | 186 / 9 / 14 | 41 | robustness-sensitivity-analysis-closure（d8d9e84b4 重封，修复 `$NEW` 哈希缺陷与 1 处 canonicalId 笔误） |
| stability-analysis | 243 | 729 | 早期批次 | — | stability-analysis-closure |
| nonlinear-system-analysis | 347 | 1041 | 311 / 36 / 0 | — | nonlinear-system-analysis-closure |
| time-domain-analysis | 572 | 1716 | 469 / 48 / 55 | 165 | time-domain-analysis-closure |
| system-modeling | 641 | 1923 | 461 / 163 / 17 | 51 | system-modeling-closure |
| classical-control-design | 744 | 2232 | 733 / 11 / 0 | 0 | classical-control-design-closure |
| frequency-domain-analysis | 952 | 2856 | 896 / 25 / 31 | 93 | frequency-domain-analysis-closure |
| state-space-control-analysis-and-design | 1282 | 3846 | 1078 / 199 / 5 | 13 | state-space-control-analysis-and-design-closure |

所有收据 `closureComplete: true`、`unresolvedAfter: 0`、`dropped: 0`。

## 排除域（6 域，域级排除裁决）

optimal-control（200）、robust-control（702）、lyapunov-stability（141）、discrete-time-control-analysis（619）、discrete-time-control-design（441）、nonlinear-control-design（104）：依负责人 2026-08-23 D1 裁决（`handout-coverage-decision.md`）课程不涵盖，域级排除，不做逐成员三族裁决。

## v0.37 新增成员域归属（176 成员，49811c74a）

- 162 成员归入涵盖域（rsa 50 / ccd 32 / sm 25 / stability 20 / ss 18 / tda 12 / fda 2 / nsa 2 / rl 1）；14 成员归入排除域（discrete-design 9 / robust-control 5）。
- 条目分类：A=140 / C-out-of-scope=14 / C-handout-gap=22。
- 工件：`formal-resource-remediation/v037-new-member-domain-assignment/`（assignments.jsonl + 收据）。已密封的 crosswalk-v037.json 本体未改动；归属结果供下次 scope 重封消费。

## 续接事项（任务族 9 收尾与 10–12）

1. 任务族 9 勾选核验：9.1–9.10 需对照可重开工件逐项取证后勾选（12.4 要求：无证据不得勾选）。
2. 任务族 10：以 9 域闭合收据 + v0.37 分配 + 归属收据为输入，构建 capture-bound Teaching Projection、域分片与消费者投影（现有入口：`scripts/knowledge-cutover/prepare-actkg-cutover-teaching-projection.ts` 系列，需按 spec delta 改造为可重开校验）。
3. 任务族 11：端到端验收命令、负验收、回放与全仓验证。
4. 任务族 12：不可选择交接清单 + 文档 + 归档 + PR。
5. 工作脚本：`/tmp/remediation-run/`（close-domain.ts、domain-cycle.sh 已入 `scripts/knowledge-cutover/`；成员清单/审核 JSONL 仍仅在 /tmp，归档前应按需入库或摘要）。
6. 已知教训：早期脚本以 shell 变量拼接收据字段曾产生字面量 `$NEW` 缺陷（已在 d8d9e84b4 修复）；审核回复承载大体积 JSONL 会被阻塞，必须以文件为交付物。
