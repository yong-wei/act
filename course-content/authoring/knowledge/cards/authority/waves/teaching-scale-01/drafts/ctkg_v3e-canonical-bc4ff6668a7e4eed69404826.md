---
node_id: ctkg_v3e-canonical-bc4ff6668a7e4eed69404826
authority_entity_id: "ctkg:v3e-canonical-bc4ff6668a7e4eed69404826"
name: "稳态误差e_ss"
name_en: "Steady-State Error e_ss"
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
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-e0e42aae8c105748a999d839b32d67ebeb42c88e5e4d2ba918b0f1e71899f5ce.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-e0e42aae8c105748a999d839b32d67ebeb42c88e5e4d2ba918b0f1e71899f5ce.json"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-scale-01/previous/ctkg_v3e-canonical-bc4ff6668a7e4eed69404826.md"
asset_refs: []
---

## 首页

# 稳态误差e_ss | Steady-State Error e_ss

**一句话定义**：响应终值与期望输入终值之间的差，符号取决于误差定义。

**核心直觉**：先固定 e=r−y_m 的方向，再分别报告参考、扰动和测量噪声的残余。

**关键公式**：
$$
e_ss=lim(t→∞)e(t)
$$

**学习目标**：从误差信号而不是只从输出曲线计算长期偏差。

---

## 详情

### 完整解释

本卡的核对顺序是：先固定模型、输入输出与单位，再代入公式计算，最后把结果与图谱中的关联边界对照。这里的数值例服务于该定义；一旦出现不同的反馈符号、工作点、采样方式或额外动态，就应回到适用条件重新建模。

稳态误差是通道量。单位反馈参考误差常写 E=R−Y；非单位反馈时应写 E=R−HY。对象入口扰动、输出扰动和测量噪声会产生不同分子，不能都简称为“输出减目标”。

### 教学计算/推理例

闭环参考传递函数 Φ=5/(s+6) 对单位阶跃终值为 5/6，所以 e_ss=1−5/6=1/6。若扰动改从对象入口加入，应另写扰动通道再取终值。

### 适用条件与边界

要求误差终值存在并说明测量反馈和扰动入口。对不稳定、持续振荡或饱和系统，e_ss 可能不存在或只对某段数据定义。

### 自检

1. Φ=5/(s+6) 的单位阶跃 e_ss 是多少？
2. 测量反馈 H≠1 时还能直接用 1−y_ss 吗？

**核对要点**：为 1/6；不能，误差是 r−Hy，必须先写 H。

### 关联节点

- **稳态**（入边，关系：相关）
- **跟踪误差**（入边，关系：相关）
- **输出误差向量**（入边，关系：相关）
- **稳态响应**（入边，关系：相关）
- **稳态误差 e(∞)**（入边，关系：相关）
