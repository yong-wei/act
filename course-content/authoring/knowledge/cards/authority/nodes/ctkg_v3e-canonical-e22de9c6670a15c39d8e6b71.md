---
node_id: ctkg_v3e-canonical-e22de9c6670a15c39d8e6b71
authority_entity_id: "ctkg:v3e-canonical-e22de9c6670a15c39d8e6b71"
name: "误差信号"
name_en: "Error Signal"
category: 概念性
knowledge_type: C
bloom_level: 应用
card_version: 3
content_origin: act-course-enrichment
authority_release_id: "ctr:release:control-theory-engineering-v0.48"
authority_snapshot_id: "snap-7f1549103098d6efcc8a3989a344c047af682df7d8b4bddd7a28101dee04e731"
authority_snapshot_hash: "7f1549103098d6efcc8a3989a344c047af682df7d8b4bddd7a28101dee04e731"
status: ready
source_docs:
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-1a4c760e857a9c87f608fd25c540142b48b7e5cd1c4ddedee1d1feaf41f093cb.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-1a4c760e857a9c87f608fd25c540142b48b7e5cd1c4ddedee1d1feaf41f093cb.json"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-scale-01/previous/ctkg_v3e-canonical-e22de9c6670a15c39d8e6b71.md"
asset_refs: []
---

## 首页

# 误差信号 | Error Signal

**一句话定义**：比较参考输入与反馈测量后得到、驱动控制器的信号。

**核心直觉**：误差是控制器看到的差，不一定等于真实输出偏差。

**关键公式**：
$$
E(s)=R(s)−H(s)Y(s)
$$

**学习目标**：根据求和点和反馈通道写出误差信号，并与稳态误差区分。

---

## 详情

### 完整解释

本卡的核对顺序是：先固定模型、输入输出与单位，再代入公式计算，最后把结果与图谱中的关联边界对照。这里的数值例服务于该定义；一旦出现不同的反馈符号、工作点、采样方式或额外动态，就应回到适用条件重新建模。

误差信号在比较点产生。单位反馈时 e=r−y；若传感器增益或动态为 H，则 e=r−Hy。控制器依据 e 生成动作，所以传感器偏置、噪声和符号错误会直接改变控制行为。

请同时检查结果的正负号、数量级和归一化；若与直觉冲突，应优先回查输入类型、通道位置和初始条件。

复核时还要把公式中的每个量与实际信号一一对应，检查单位是否一致、极限是否存在，并区分“该模型下算得出”与“工程上可以直接采用”。

### 教学计算/推理例

单位阶跃参考稳态为 R=1、Y=0.8。若 H=1，e_ss=0.2；若 H=2，比较点误差为 1−2×0.8=−0.6，虽然真实输出仍为 0.8。

### 适用条件与边界

必须固定反馈方向、测量通道和信号单位。误差信号可以是瞬时量；只有系统收敛时才有稳态误差这个终值。

### 自检

1. H=1 时 e 的表达式是什么？
2. H=2、R=1、Y=0.8 时 e 是多少？

**核对要点**：为 E=R−Y；为 −0.6。

### 关联节点

- **误差信号分析**（出边，关系：相关）
