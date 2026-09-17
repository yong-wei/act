---
node_id: ctkg_v3e-object-f1df5739a34bf55489aeeeeb
authority_entity_id: "ctkg:v3e-object-f1df5739a34bf55489aeeeeb"
name: "校正装置"
name_en: "Compensation Device"
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
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-1662848c1ed2a7feaa036ea3729f76e5b5d7d303a4f3a39eda7d17cb30422bec.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-1662848c1ed2a7feaa036ea3729f76e5b5d7d303a4f3a39eda7d17cb30422bec.json"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-scale-01h/previous/ctkg_v3e-object-f1df5739a34bf55489aeeeeb.md"
asset_refs: []
---

## 首页

# 校正装置 | Compensation Device

**一句话定义**：校正装置是在控制系统中实现所需动态补偿特性的实际或算法部件。

**核心直觉**：不只调一个增益，还通过积分、超前或其他结构改变系统对信号的处理方式。

**关键公式**：
$$u(t)=e(t)+z(t),\qquad\dot z(t)=e(t).$$

**学习目标**：区分校正结构、传递函数与实际实现，并检查装置加入后的闭环性能和约束。

---

## 详情

### 完整解释

当仅调放大器增益不能满足全部指标时，可以增加具有适当动态特性的校正装置。它可能是模拟网络、数字控制器或其他可调动态环节；选择不仅取决于理想传递函数，也取决于信号性质、实现带宽、噪声、执行器能力、环境和成本。一个公式描述期望行为，并不自动证明硬件或软件实现具有同样的性能。

装置接在前向通道、反馈通道或前馈通道，作用并不相同。应先明确测量误差的定义、符号和插入位置，再建立新的环路与闭环模型。本卡用PI装置说明：比例支路立即响应当前误差，积分支路保存误差历史，二者相加形成控制输入。积分器状态的初值和复位方式也是实现的一部分，不能只记录两个增益。

### 教学计算/推理例

取归一化对象 $P(s)=1/(s+1)$，零初态、单位负反馈、单位阶跃参考。原来只有比例装置 $C=1$ 时，闭环为 $1/(s+2)$，输出终值为0.5，稳态误差为0.5。

加入首页所示PI装置，即 $C(s)=1+1/s$，原状态方程为
$$\dot y=-y+e+z,\qquad\dot z=e,\qquad e=1-y.$$
两状态初值均为零。闭环特征多项式为 $(s+1)^2$，输入输出传递函数约简为 $1/(s+1)$，因此 $y(t)=1-e^{-t}$，误差衰减至零。由状态方程还可核对 $z(t)=1-e^{-t}$、$u=e+z=1$；比例作用逐渐减小，积分作用逐渐补足维持输出所需的控制量。

本例恰好约消一个稳定极点，是准确名义模型下的教学结果。实际参数偏差、延迟或饱和会改变它；尤其不能以约消不稳定极点的办法掩盖内部不稳定。数字实现还须检查采样周期、离散化和控制输出限制，模拟实现也要检查元件与信号范围。

### 常见误区与边界

1. **误区**：装置名称是PI就能保证稳态与动态指标全部满足。**纠正**：参数、对象、结构、初值和执行器条件共同决定结果。
2. **误区**：积分器可以一直积累误差而无需限制。**纠正**：执行器饱和时可能产生积分累积，实际设计需要处理饱和与恢复过程。

### 自检

1. 本例PI装置的积分状态从0变化到多少？控制量终值是多少？
2. 为什么理想连续传递函数不能直接作为数字实现验收结论？

**核对要点**：积分状态趋于1，控制量为1；采样、离散化、延迟和约束都可能改变闭环行为，必须验证实际实现。

### 关联节点

- **串联校正**（后续）：一种具体的装置插入方式，应按前向通道重新建立环路。
- **反馈校正**（后续）：装置作用于反馈通道，不能照搬串联结构的传递函数。
- **数字校正装置**（下位类型）：在采样与数值实现约束下实现校正特性。
