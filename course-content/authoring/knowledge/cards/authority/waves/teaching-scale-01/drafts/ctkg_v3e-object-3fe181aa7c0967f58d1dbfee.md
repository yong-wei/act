---
node_id: ctkg_v3e-object-3fe181aa7c0967f58d1dbfee
authority_entity_id: "ctkg:v3e-object-3fe181aa7c0967f58d1dbfee"
name: "比例控制规律"
name_en: "Proportional Control Law"
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
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-1ea4f1d17c82bfe86cd4c827494196b6b786081fb6b0a15e1ed001ba5dee696d.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-1ea4f1d17c82bfe86cd4c827494196b6b786081fb6b0a15e1ed001ba5dee696d.json"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-scale-01/previous/ctkg_v3e-object-3fe181aa7c0967f58d1dbfee.md"
asset_refs: []
---

## 首页

# 比例控制规律 | Proportional Control Law

**一句话定义**：控制器输出与误差成比例的 P 控制规律。

**核心直觉**：P 环节立即按当前误差放大，改变幅值而不增加动态相位。

**关键公式**：
$$
u(t)=K_p e(t),  G_c(s)=K_p
$$

**学习目标**：计算给定误差下的控制量，并说明比例增益不能单独消除静差。

---

## 详情

### 完整解释

本卡的核对顺序是：先固定模型、输入输出与单位，再代入公式计算，最后把结果与图谱中的关联边界对照。这里的数值例服务于该定义；一旦出现不同的反馈符号、工作点、采样方式或额外动态，就应回到适用条件重新建模。

比例控制器没有积分记忆，误差一出现就产生与之成比例的动作。提高 K_p 可能加快响应和减小静差，但也可能降低相位裕度、放大噪声或造成饱和；它不自动增加系统型别。

请同时检查结果的正负号、数量级和归一化；若与直觉冲突，应优先回查输入类型、通道位置和初始条件。

### 教学计算/推理例

取 K_p=3、误差 e=0.2，控制量 u=0.6。若误差保持为 0.1，控制量仍为 0.3，说明无积分记忆时常值误差可能持续存在。

### 适用条件与边界

假设误差和控制量在同一线性单位、执行器未饱和且 P 控制器无额外滤波。离散采样或限幅会改变实际输出。

### 自检

1. K_p=5、e=−0.2 时 u 是多少？
2. 单纯把 K_p 增大是否保证稳态误差为零？

**核对要点**：为 −1；不保证，稳态误差还取决于对象和环路型别。

### 关联节点

- **P控制器**（入边，关系：包含）
- **P控制器**（入边，关系：相关）
- **比例系数**（出边，关系：包含）
