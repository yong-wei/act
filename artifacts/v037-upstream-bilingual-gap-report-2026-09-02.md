# 上游 CTKG v0.37 双语证据修正需求报告

- 日期：2026-09-02
- 来源：ACT 项目 #1741（activate-v037-bilingual-authority-graph）独立资格校验
- 面向：上游控制理论工程图谱（CTKG）发布管线维护者
- 结论：**需要发布修正版本（建议 r5，基于 r4 续修）**。r4 修复方向部分正确但未闭合，且引入新缺陷（明细见下）。

## 0. 基准与统计口径

- ACT 激活身份（exact-version）：
  - release：`ctr:release:control-theory-engineering-v0.37`（release hash `cc73fa150a94fb0a3891c4b5d26eba9ca190f28334782a974333016f734fea39`）
  - snapshot：`snap-e2d8b92f6095a7b79036cc0808952fd42e2077ff3b5cf0a36291fd0bc7f26aae`
  - catalog：`adc-ae08809b60a065baf6586142c2aa6af3dbdaa453c634427b1afc6689a7217a1c`
  - shard set：`ads-294a061649658ea5298f257af4ce248677844348efe89879f253d1ecba3eee6c`
- ACT 呈现分母（资格必须 100% 双语闭合）：
  - 2,849 个可达对象名（name）
  - 2,376 个呈现说明对象（detail 呈现说明者；KnowledgeStatement ← `statement_text`，DomainConcept/SystemModel/Formula ← `meaning`）
  - 7 个类型术语、9 个工程谓词（已闭合，无需处理）
- 统计口径：`localized-content-index.jsonl` 中 `review_status=approved` 且 `value` 非空的行；"双语闭合" = 同一 `target_id` 在 `zh-CN` 与 `en` 均有行。

## 1. 修正版必须闭合的缺陷

### P1-1【阻塞】27 个对象缺双语 name 行（3 组）

**A. 内部记录对象泄漏（2 个）**
`ctc:modeling-423b845366304dc755fefcea`、`ctc:modeling-f6940765c7e8e5b74be204e0`
- zh display_name = "内部记录"、无 description，却进入领域概览/关系族成员，最终到达学习者画布。
- r4 处理：给了 **en-only** 行 "Internal record"——不是学习者名称，方向反了。
- 期望：从领域成员资格中**排除**（推荐，内部对象不应出现在学习者概览），或赋予有意义的双语名称。

**B. Condition 对象（20 个）——zh 行的值本身是英文长句，缺 en 行**
示例：`ctkg:condition:04902ac05e581b306b33def7` zh = "A Lyapunov function V(x) exists for the system (i.e., V(0)=0, V(x)>0 for x≠0, …)"
- r4 处理：补了 **zh-only** 行（20 个全部），en 仍缺。
- 期望：为每个对象补 en 行（值可与现值相同——zh/en 同值即语言中立，符合 ACT 消费契约），或修正语言标注后两侧补齐。

**C. StatementArgument 对象（5 个）——同 B**
示例：`ctkg:statement-argument:1387459aed77efa87ed44279` zh = "The origin is unstable."
- r4 处理：4 个补 zh-only，1 个（`ctkg:condition:7dfbd78dd45a2efbc7a8509f` 所属组）补 en-only。
- 期望：同 B，补齐双语对。

### P1-2【阻塞】26 个对象缺双语说明行（meaning/statement_text 均无）

22 个 DomainConcept（含 2 个 v2r）+ 2 个 Formula：
`ctf:998c24c3f7c3fa9b20bdb39b`、`ctf:c2527f7cc8ef612a6c7f9d8a`（Formula）＋ 24 个 `ctc:modeling-*`（完整清单见附录 A）。
- 这些对象在 ACT detail 分片呈现 zh 说明，但 localized-content 无任何 approved 说明行。
- r4 处理：未动（meaning 总行数变为 2,812/2,812 对称，但这 26 个仍未覆盖）。
- 期望：补双语 `meaning` 行（Formula 若说明即公式语义，可用同值双语）。

### P2【账实不一致】locale-manifest covered_count 与随包索引实数不符（r3、r4 均存在）

| 类别 | manifest 声明（zh=en 同值） | r3 实测 distinct | r4 实测 distinct |
|---|---|---|---|
| node_names | 7,258 | 7,258 / 7,258 | **7,402 / 7,332** |
| node_meanings | 2,551 | 2,764 / 2,599 | 2,812 / 2,812 |
| statement_texts | 3,078 | 3,110 / 3,100 | 3,132 / 3,132 |

- 声明值既不等于 zh 也不等于 en 实数，且两 locale 声明相同，掩盖了不对称。
- r4 的 name 不对称（zh 比 en 多 70）是**新引入**的缺陷。
- 期望：covered_count 按 locale 分别声明 distinct approved targets，并重算 manifest digest。

### P3【一致性】en/zh 行不对称（当前不阻断 ACT 呈现面，但违反双语对称目标）

- r3：`meaning` 165 个目标 zh 有 en 无；`statement_text` 10 个目标 zh 有 en 无。
- r4：`name` 70 个目标 zh 有 en 无（新增）；meaning/statement_text 已对称。
- 枚举脚本见附录 B。

### P4【既有修复项】多 `\tag` 公式（ACT 处置台账 upstream repair = open）

`ctkg:v3e-object-7eff4a56f030e68b38e4fe61`（状态方程，教材式 7.107a/7.107b）：单条公式含两个 `\tag`，KaTeX 严格渲染契约不呈现多个 `\tag`，ACT 已登记 registered-unavailable 并挂上游修复。
- 期望：拆分为两条公式或去除编号标签后随修正版重发；ACT 将解除该不可用处置。

## 2. 不需要上游处理（防止误修）

- **域名英文、方向枚举标签（forward/source_to_target/unordered）、教学谓词（PREREQUISITE）标签**：ACT 呈现层词汇，由 ACT interface catalog 承载，不来自上游。
- **en 别名**：上游 alternative 标签本就只有 zh（465 条）；ACT 侧另有"别名未随 shard 物化"的自有问题，与上游无关。
- **accessibility_label（6 条）**：ACT 呈现面的无障碍名称从 name/公式派生，不依赖该类别；如上游契约承诺全面覆盖则另议，非 ACT 阻塞项。

## 3. 修正版验收口径（ACT 侧复测判据）

在修正 bundle 上，ACT 将重跑 exact-version 覆盖校验，全部满足即视为闭合：
1. 2,849 个可达对象 name 双语闭合（含 P1-1 的 27 个；若内部记录对象被移除，则分母相应缩减）；
2. 2,376 个呈现说明对象 meaning/statement_text 双语闭合（含 P1-2 的 26 个）；
3. locale-manifest covered_count 与索引实数一致（按 locale 分别声明），digest 重算；
4. localized-content 全量 approved 行按 target 语言对称（name/meaning/statement_text）。

达成后 ACT 按 exact-version 契约重新 pin 新 bundle 并走独立 OpenSpec 激活（不跟随 latest）。

## 附录 A：完整 ID 清单

**P1-1 名字缺口（27）**
```
ctc:modeling-423b845366304dc755fefcea      # 内部记录
ctc:modeling-f6940765c7e8e5b74be204e0      # 内部记录
ctkg:condition:04902ac05e581b306b33def7
ctkg:condition:08d808d0120c685c3e234c78
ctkg:condition:2984828967139f058d0d3085
ctkg:condition:35cb5822b388b7520dcebf3d
ctkg:condition:44d67a20d3cdb505de9d455f
ctkg:condition:63aa5b40e84c9083ce5ba6c5
ctkg:condition:768f76ee1044659c0fe0cf68
ctkg:condition:77ad06900b90c5972465c940
ctkg:condition:7dfbd78dd45a2efbc7a8509f    # r4 中为 en-only
ctkg:condition:845f5b7c01cfedb1df594309
ctkg:condition:8a840f5b8479a442afcda4e1
ctkg:condition:93ba25670b4879ee1135ba08
ctkg:condition:9f364a9a01d6135de28f85c7
ctkg:condition:a3b01cc91f8734b457162b63
ctkg:condition:d756e899b07ef0595ce3234f
ctkg:condition:db8729d4616dd5ce22701f6d
ctkg:condition:e8aa7ac75519b61a6ee492d1
ctkg:condition:f7cef26ad9ab73f69dc3a091
ctkg:condition:f98254207e96d02b1faba8d3
ctkg:condition:fb82a334ecd55ffab55b5ade
ctkg:statement-argument:1387459aed77efa87ed44279
ctkg:statement-argument:6adb7453ee0e4d94d9f9edd7
ctkg:statement-argument:6e41ad36a72d8679504ddafa
ctkg:statement-argument:e27311b1bbd5b64b647d7fdc
ctkg:statement-argument:fed220917fe13b8a5f1e457a
```

**P1-2 说明缺口（26）**
```
ctc:modeling-00d2998755974a1329049aac
ctc:modeling-023f560241f0e47081f0f59e
ctc:modeling-0f6572562d2ba1a5b005f2c5
ctc:modeling-16649db0eecaaa63f87f2a4a
ctc:modeling-2088bbde171b2e9ef66070d5
ctc:modeling-227e674315b4da2f1a20ee31
ctc:modeling-2897ba298baf9901ef5633e3
ctc:modeling-290a601cb41e32841fe66084
ctc:modeling-34de45f2470f6c09c7d96698
ctc:modeling-5da44f2fc98d268259459e04
ctc:modeling-6e03c54be64721caf66c75c5
ctc:modeling-736212ccb3694d44a24fa358
ctc:modeling-7734a0845c335f160395bac0
ctc:modeling-8010502b57930c3dcb915af9
ctc:modeling-865eb1c8824e157c2f05a903
ctc:modeling-9121dc2c97afa77f52ce0220
ctc:modeling-930ada7e5567a735a2feadc9
ctc:modeling-9b8a43928af77103270d5f9c
ctc:modeling-a2b2e4c67cee79eef87f3b81
ctc:modeling-bb52102ba5f63982e27e329a
ctc:modeling-cde581a02e8cf843a69b8a69
ctc:modeling-ebf5a771fd114720de11f6e3
ctc:modeling-v2r-5585bf06f0e579bc1c362ac2
ctc:modeling-v2r-8e433b427ffa0e0dc5fd3d64
ctf:998c24c3f7c3fa9b20bdb39b
ctf:c2527f7cc8ef612a6c7f9d8a
```

## 附录 B：对称性缺口枚举脚本（上游自测用）

```python
import json, sys
path = sys.argv[1]  # localized-content-index.jsonl
rows = {}
for line in open(path):
    if not line.strip():
        continue
    r = json.loads(line)
    if r['review_status'] == 'approved' and r['value']:
        rows.setdefault((r['field_path'], r['target_id']), set()).add(r['locale'])
for field in ('name', 'meaning', 'statement_text'):
    zh_only = sorted(t for (f, t), ls in rows.items() if f == field and ls == {'zh-CN'})
    en_only = sorted(t for (f, t), ls in rows.items() if f == field and ls == {'en'})
    print(field, 'zh-only:', len(zh_only), 'en-only:', len(en_only))
    for t in zh_only:
        print(' ', t)
```
