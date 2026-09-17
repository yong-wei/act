---
node_id: ctkg_v3e-canonical-4f62334f630ea074128ec396
authority_entity_id: "ctkg:v3e-canonical-4f62334f630ea074128ec396"
name: "单位阶跃函数"
name_en: "Unit-Step Function"
category: 概念性
knowledge_type: C
bloom_level: 应用
card_version: 3
content_origin: act-course-enrichment
authority_release_id: "ctr:release:control-theory-engineering-v0.48"
authority_snapshot_id: "snap-7f1549103098d6efcc8a3989a344c047af682df7d8b4bddd7a28101dee04e731"
authority_snapshot_hash: "7f1549103098d6efcc8a3989a344c047af682df7d8b4bddd7a28101dee04e731"
status: draft
source_docs:
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-c442c60900347aa944be2e2723cd4f1a0d48415342e2595919b9099cc387ff6c.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-c442c60900347aa944be2e2723cd4f1a0d48415342e2595919b9099cc387ff6c.json"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-scale-01/previous/ctkg_v3e-canonical-4f62334f630ea074128ec396.md"
asset_refs: []
---

## 首页

# 单位阶跃函数 | Unit-Step Function

**一句话定义**：在 t=0 由 0 跃变到 1 的标准输入信号。

**核心直觉**：它用一次明确的目标改变测试系统的长期跟踪和瞬态。

**关键公式**：
$$
1(t)=0(t<0), 1(t)=1(t≥0),  L{1(t)}=1/s
$$

**学习目标**：正确区分单位阶跃、带幅值阶跃和冲激，并写清 t=0 的约定。

---

## 详情

### 完整解释

本卡的核对顺序是：先固定模型、输入输出与单位，再代入公式计算，最后把结果与图谱中的关联边界对照。这里的数值例服务于该定义；一旦出现不同的反馈符号、工作点、采样方式或额外动态，就应回到适用条件重新建模。

单位阶跃是输入信号，不是响应指标。幅值为 A 的阶跃为 A1(t)，其拉氏变换为 A/s；阶跃的导数在理想分布意义下是冲激，不能把两者当成同一测试。

### 教学计算/推理例

幅值为 3 的阶跃在 t=0 后为 3，R(s)=3/s。对 G(s)=1/(s+1)，输出 y(t)=3(1−e^(−t))，t=1 s 时约为 1.8964。

### 适用条件与边界

采用理想因果阶跃和零初始条件。实际命令会有斜率限制或采样边沿，需要把输入整形纳入模型。

### 自检

1. 幅值为 2 的阶跃的拉氏变换是什么？
2. 阶跃信号的导数仍是阶跃吗？

**核对要点**：为 2/s；不是，理想导数是冲激信号。

### 关联节点

- **一阶系统的单位阶跃响应**（入边，关系：相关）
- **高阶系统解析阶跃响应**（入边，关系：相关）
- **单位阶跃响应曲线**（入边，关系：相关）
- **典型输入信号**（入边，关系：包含）
- **单位阶跃响应**（入边，关系：由此得到）
