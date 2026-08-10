# 权威 DomainConcept 信息图全量制作计划

**目标**：为全部 1,236 个语义节点（DomainConcept）生成 Grok 信息图并登记、审核、导出。  
**更新**：2026-08-05

## 1. 现状基线

| 项 | 数量 | 说明 |
|----|-----:|------|
| DomainConcept 总数 | 1236 | v0.12 authority |
| 文本卡 | 1236 | 已完成（C 为 draft-blocked） |
| 信息图 prepared | 1236 | source.json + prompt.md 已齐 |
| 信息图 accepted | 86 | 主要是 Batch A 中文优质节点 |
| **待生图** | **1150** | A 37 + B 829 + C 284 |

## 2. 存储契约（不变）

```text
作者态：
course-content/authoring/knowledge/infographs/authority/nodes/<safe_id>/
  source.json  prompt.md  generation.json  review.json  infograph.png

运行态（仅 accepted）：
course-content/runtime/knowledge/infographs/authority/nodes/<safe_id>.png
course-content/runtime/knowledge/infographs/authority/manifest.json
```

## 3. 批次策略

| 波次 | 范围 | 规模 | 优先级 | 审核强度 |
|------|------|-----:|--------|----------|
| **W0** | Batch A 剩余 | 37 | P0 | 全量轻审（标题+定义对齐） |
| **W1–W17** | Batch B | 829，每波 ~50 | P1 | 每波抽 5 张视觉审 |
| **W18–W23** | Batch C | 284，每波 ~50 | P2 | 每波抽 3 张；极简定义可接受 |

### 单节点流水线（一张一张）

1. **Prepare**（已完成）：`source.json` + `prompt.md`  
2. **Generate**：主线程 `image_gen`，prompt 来自定义 + 短标签 + archetype（fail-closed）  
3. **Register**：`register_authority_infograph.py --safe-id … --image … --accept`  
4. **Review**：  
   - 自动：文件存在、generation.provider=grok、非空 PNG  
   - 人工/视觉抽检：中文标签可读、无元数据泄漏、无胡编公式  
5. **Export**：每波结束跑 `export_authority_cards_and_infographs.py`  
6. **Status**：`status_report.py` 更新 `status.json` / `PROGRESS.md`

### 并行分工

| 角色 | 能力 | 职责 |
|------|------|------|
| **主线程（Grok）** | `image_gen` | 唯一生图入口；每波并行 5 张 |
| **子代理 A** | 只读+写脚本/登记 | 构建波次队列、登记、export、status |
| **子代理 B** | 只读+视觉读图 | 抽检 review.json / 读图挑拒收 |
| **子代理 C** | 只读 | 进度汇总、坏盘点、断点清单 |

> 约束：子代理**不能**调用 `image_gen`；生图必须主线程完成。

## 4. 内容与审核门禁

**Fail-closed**

- 定义/标签仅来自 authority description + 邻接  
- 禁止发明工程数值、稳定性结论、额外公式  

**Accept 条件**

- 主标题与节点概念一致  
- 中文短标签为主（英文源节点允许中英对照）  
- 无 prompt 元数据、无水印、非纯文字便签风  
- `generation.json.provider = grok-image_gen`  

**Reject → 重试**

- 中文严重乱码、公式明显错误、张冠李戴  
- 最多重试 2 次；仍失败记 `review.status=rejected` + reason  

## 5. 波次队列文件

```text
course-content/authoring/knowledge/cards/authority/waves/
  wave-W0-A-rest.json
  wave-W1-B-000.json
  …
  wave-status.json          # 全局进度
```

每波 JSON：

```json
{
  "wave_id": "W0",
  "batch": "A",
  "items": [{"safe_id":"…","name":"…","definition":"…","status":"pending|generated|registered|accepted|rejected"}],
  "generated_at": "…"
}
```

## 6. 验收

- [ ] `accepted + rejected + prepared_remaining = 1236`（身份守恒）  
- [ ] runtime manifest.count == accepted  
- [ ] 旧 `infographs/lessons` 与旧 `cards/nodes` 无删改  
- [ ] `PROGRESS.md` 最终报告：完成数 / 拒收 Top 原因  

## 7. 执行顺序（本会话起）

```text
W0  清完 A 剩余 37
 → W1… 每波 5–10 张并行 image_gen + 登记 + 抽检
 → 每 50 张 export + status  checkpoint
 → C 最后
 → 终态报告
```

**断点续跑**：任意时刻以 `status_report.py` 为准，跳过已有 `infograph.png` + `accepted`。
