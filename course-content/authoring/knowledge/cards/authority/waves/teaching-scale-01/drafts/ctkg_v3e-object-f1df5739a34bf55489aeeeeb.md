---
node_id: ctkg_v3e-object-f1df5739a34bf55489aeeeeb
authority_entity_id: "ctkg:v3e-object-f1df5739a34bf55489aeeeeb"
name: "校正装置"
name_en: "Compensating Device"
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
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-1662848c1ed2a7feaa036ea3729f76e5b5d7d303a4f3a39eda7d17cb30422bec.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-1662848c1ed2a7feaa036ea3729f76e5b5d7d303a4f3a39eda7d17cb30422bec.json"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-scale-01/previous/ctkg_v3e-object-f1df5739a34bf55489aeeeeb.md"
asset_refs: []
---

## 首页

# 校正装置 | Compensating Device

**一句话定义**：在增益调整仍不足时加入系统、具有可调参数和特性的实际校正装置。

**核心直觉**：装置是设计策略的物理落点，参数必须对应可实现元件和信号位置。

**关键公式**：
$$
D_c(s)=K_c(1+sT_z)/(1+sT_p)
$$

**学习目标**：从性能缺口选择装置形式，并把理想传递函数与执行器边界一起验证。

---

## 详情

### 完整解释

本卡的核对顺序是：先固定模型、输入输出与单位，再代入公式计算，最后把结果与图谱中的关联边界对照。这里的数值例服务于该定义；一旦出现不同的反馈符号、工作点、采样方式或额外动态，就应回到适用条件重新建模。

校正装置可以是串联网络、反馈网络、数字控制器或其他可调部件。选择它时要考虑信号功率、电路/算法可实现性、环境、抗扰与经济约束；同名的“补偿”是设计行为，而装置是承担该行为的实现。

### 教学计算/推理例

若希望低频增益提高 5 倍、而高频增益约保持 1，可选示例 D_c(s)=5(1+10s)/(1+50s)。D_c(0)=5，高频极限为 5×10/50=1；仍需检查极点、相位和饱和。

### 适用条件与边界

需明确装置插入位置、可调参数范围、噪声和执行器限制。理想连续传递函数不能替代采样实现和硬件/软件验证。

### 自检

1. 示例装置的低频增益是多少？
2. 装置选定后是否只需检查名义阶跃？

**核对要点**：为 5；不够，还要检查完整通道、频域裕度、扰动和实现约束。

### 关联节点

- **反馈校正**（出边，关系：前置于）
- **前馈校正**（出边，关系：前置于）
- **串联校正**（出边，关系：前置于）
- **复合校正**（出边，关系：前置于）
- **PID控制器**（出边，关系：前置于）
