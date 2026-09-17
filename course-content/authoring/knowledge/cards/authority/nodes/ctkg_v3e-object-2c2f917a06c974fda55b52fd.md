---
node_id: ctkg_v3e-object-2c2f917a06c974fda55b52fd
authority_entity_id: "ctkg:v3e-object-2c2f917a06c974fda55b52fd"
name: "幅度量化误差"
name_en: "Amplitude Quantization Error"
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
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-f7da9fbbe1f5384c2e1ac03c5e3ff886911dbca8a9b5a6d127741743fd025b69.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-f7da9fbbe1f5384c2e1ac03c5e3ff886911dbca8a9b5a6d127741743fd025b69.json"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-core-28a/previous/ctkg_v3e-object-2c2f917a06c974fda55b52fd.md"
asset_refs: []
---

## 首页
# 幅度量化误差 | Amplitude Quantization Error

一句话定义：幅度量化误差是连续幅值或高精度数值被映射到有限离散等级时，量化结果与原值之间的差。

- 先定义误差符号和量化规则。
- 最近等级舍入的半步长误差界需要无过载条件。
- 采样时间离散与幅值量化是不同操作。

---
## 详情
### 完整解释

设量化器输出为 $Q(x)$，本卡约定误差 $e_q=Q(x)-x$。若另一材料定义为原值减量化值，其符号相反，比较公式时要先统一。对于步长为 $\Delta$ 的均匀最近等级舍入，未触发范围限幅时有 $|e_q|\le\Delta/2$。

这个界来自原值到最近等级的距离，不是所有数字转换方式都具备的通用误差界。截断、非均匀量化、不同端点规则以及过载都会改变具体结论。有限位数同时涉及分辨率和可表示范围，应分别说明，不能只给出“位数越多误差越小”的无条件说法。

### 教学计算/推理例

取 $\Delta=0.25$，输出范围 $[-1,1]$，采用

$$
Q(x)=\operatorname{clip}\left(0.25\left\lfloor\frac{x}{0.25}+0.5\right\rfloor,-1,1\right).
$$

该公式在恰好半格时向正无穷方向选取等级。输入0.4时输出0.5，误差0.1；输入 $-0.4$ 时输出 $-0.5$，误差 $-0.1$。输入0.125恰在0与0.25之间，本例选择0.25，误差0.125，等于半步长界。

输入1.6时先舍入再限幅，最终输出1，误差 $-0.6$，其绝对值超过0.125。这不是半步长推导错误，而是输入超出可表示范围，已经发生过载。工程报告应把正常舍入误差与过载误差分开识别。

若固定输出范围并增加可用等级数，步长通常减小，无过载舍入误差界也随之减小。但若改变位数的同时扩大范围，步长未必减小，仍需按实际等级间隔计算。

### 适用条件与边界

量化误差由输入和规则确定，一般不是天然独立随机噪声。只有在额外的统计近似条件下，才可能使用均匀分布模型并得到方差 $\Delta^2/12$。对缓慢变化、周期或恒定输入，误差可能有相关性或偏置，不能自动套用白噪声假设。

时间采样是在离散时刻取值；幅度量化是把这些值映射到离散等级。即使时间采样无限精确，有限幅度等级仍会产生量化误差；提高采样频率也不会直接改变既定量化器的等级间隔。闭环中的影响还取决于量化位置和系统动态。

### 常见误区

1. 未定义误差方向就比较正负号。
2. 发生过载后仍承诺绝对误差不超过半步长。
3. 将确定性量化误差无条件当作独立均匀白噪声。

### 自检

1. 本例输入0.4与1.6的误差分别是多少？
2. 只提高采样频率，步长0.25是否自动减小？

**核对要点**：分别为0.1和 $-0.6$；不会，时间分辨率与幅度等级间隔需要分别设定。

### 关联节点

- **量化误差**（入边，关系：前置于）
- **量化误差**（出边，关系：属于）
- **模数转换器**（无向，关系：相关）
