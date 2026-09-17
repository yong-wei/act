---
node_id: ctkg_v3e-object-69aaaef625010f7755f253e8
authority_entity_id: "ctkg:v3e-object-69aaaef625010f7755f253e8"
name: "死区"
name_en: "Dead Zone"
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
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-7d25b1c1105a9cc559fcd98d0a50102466f45a31f53a1ed900fb2a54ee0a60c5.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-7d25b1c1105a9cc559fcd98d0a50102466f45a31f53a1ed900fb2a54ee0a60c5.json"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-core-27a/previous/ctkg_v3e-object-69aaaef625010f7755f253e8.md"
asset_refs: []
---

## 首页
# 死区 | Dead Zone

一句话定义：死区是输入位于某一范围内时输出不发生响应、超出该范围后才开始变化的非线性特性。

- 先说明区间宽度及超出区间后的斜率。
- 连续死区模型在阈值处不发生输出跳跃。
- 理想无记忆死区与机械间隙的历史行为不同。

---
## 详情
### 完整解释

设死区半宽为 $d>0$、区外增益为 $k>0$，常见连续对称模型为

$$
y=\begin{cases}k(u+d),&u<-d,\\0,&|u|\le d,\\k(u-d),&u>d.\end{cases}
$$

区间 $[-d,d]$ 的总宽度为 $2d$。区外表达式包含偏移量，是为了与区内零输出连续衔接。若直接写成区外 $ku$，就在阈值处产生跳跃，成为另一种非线性，不能悄悄替换模型。

此理想死区是单值、无记忆的。给定当前输入即可确定输出，不需知道输入从哪个方向到达。某些真实器件还具有迟滞或接触状态，需增加状态模型；不能因为都出现“暂时不响应”，就把死区与间隙视为同一关系。

### 教学计算/推理例

取 $d=0.5$、$k=2$。输入0.4落在死区内，输出为0；输入0.6时，输出为 $2(0.6-0.5)=0.2$；输入1时，输出为1。负向输入 $-0.6$ 对应 $-0.2$。阈值 $\pm0.5$ 处输出为0，与两侧公式一致。

若把死区后的关系误写成 $y=2u$，输入刚超过0.5就会产生接近1的输出，而不是从0连续增加。这会显著改变小输入附近的响应，也是检查模型抄写是否正确的简单反例。

在一个把误差送入此死区元件的反馈结构中，误差0.4可能无法产生该元件的控制输出；但是否因此形成稳态偏差，还需考虑对象平衡条件、其他通道以及控制器状态。不能仅凭局部元件有死区，就给所有闭环系统指定同一个最终误差。

### 适用条件与边界

死区参数与输入单位相关：电压阈值、力矩阈值、误差角度阈值不可直接互换。实际元件可能不对称，上下阈值与区外斜率也可能不同，应根据对象建模。本文采用对称连续模型，只是清晰的教学实例。

死区内部局部斜率为0，外部为 $k$，阈值处存在折点。用单一线性增益描述跨越死区的大幅输入会丢失这些差异。小幅扰动若始终留在区内，没有输出；更大扰动跨过阈值时才可能产生响应，体现了幅值相关性。

### 常见误区

1. 把半宽 $d$ 当成整个区间宽度。
2. 区外忘记减去阈值偏移，误造不连续跳跃。
3. 把死区内部输出0写成保持旧输出，混入迟滞状态。

### 自检

1. 本例死区总宽度是多少，输入0.6的输出是多少？
2. 输入从1回到0.4，理想死区输出是否保留此前的1？

**核对要点**：总宽度1，输出0.2；当前输入在区内，输出回到0，无记忆模型不保留旧值。

### 关联节点

- **死区特性**（无向，关系：相关）
- **间隙特性**（无向，关系：相关）
