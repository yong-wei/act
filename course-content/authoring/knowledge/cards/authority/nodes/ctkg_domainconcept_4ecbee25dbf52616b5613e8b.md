---
node_id: ctkg_domainconcept_4ecbee25dbf52616b5613e8b
authority_entity_id: "ctkg:domainconcept:4ecbee25dbf52616b5613e8b"
name: "前馈扰动抑制"
name_en: "Feedforward Disturbance Rejection"
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
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-23ebc546358b2a41f6928065f0cef8067371814b1595f8679c77fb9ffc766958.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-23ebc546358b2a41f6928065f0cef8067371814b1595f8679c77fb9ffc766958.json"
asset_refs: []
---

## 首页

# 前馈扰动抑制 | Feedforward Disturbance Rejection

**一句话定义**：前馈扰动抑制利用可测扰动构造补偿输入，设计系数取决于扰动到输出的实际通道。

输出端扰动与对象输入端扰动需要不同的补偿关系，不能省略注入位置。

---

## 详情

### 完整解释

测得扰动后，可在它的影响完全反映为反馈误差之前加入相应补偿。但这要求知道扰动怎样进入系统、测量量的尺度和时序。一个正确的测量值放在错误的通道模型中，仍会得到错误的补偿系数。

若输出关系为 $y=Pu+G_dd$，控制律为 $u=K(r-y)+F_dd$，则扰动通道为 $(G_d+PF_d)/(1+PK)$。动态精确抵消形式上要求 $F_d=-G_d/P$，但还要检查该比值是否稳定、适当且可实现。只采用其直流值时，通常只针对常值稳态作用。

前馈也不能处理未提供的信息。扰动不可测、存在未建模路径或测量延迟时，应重新评估，不能把补偿器假定为知道真实即时扰动。剩余影响仍可能需要反馈处理。

### 教学计算/推理例

取 $P(s)=2/(s+1)$、$K=1$，扰动直接加在输出端，即 $G_d=1$。选择静态 $F_d=-1/P(0)=-0.5$，得到

$$T_{dy}(s)=\frac{1+PF_d}{1+PK}=\frac{s}{s+3}.$$

零参考、零初态的单位阶跃扰动产生 $y(t)=e^{-3t}$，所以常值影响最终消失，但发生瞬间的输出仍为1。不能把这个静态设计称为完整动态抵消。

若相同符号 $d$改为加在对象输入处，关系变成 $y=P(u+d)$，扰动通道为 $P(1+F_d)/(1+PK)$。理想同位置抵消需要 $F_d=-1$，并非-0.5。这一差异来自注入位置，而不是计算误差。

### 适用条件与边界

输出加性例的动态逆为 $-1/P(s)=-(s+1)/2$，包含理想微分。它不能在没有实现条件时被当作普通有限带宽补偿器。采用静态值避免了这种完整求逆要求，但也只实现所声明的稳态目标。

如果名义对象增益2实际变为3，仍使用输出扰动补偿-0.5时，稳态输出为-0.125，说明可能发生过补偿。模型失配不能因扰动已测得而自动消失，仍应检验补偿的精度与边界。

不同扰动频段也可能产生不同效果。静态设计对低频或常值作用可能有帮助，高频效果则应由精确传递函数检查；不能将一个终值结果推广到全部频率。实际控制量与测量噪声也需要对应分析。

### 常见误区

1. 误区：所有扰动都用负的对象逆直流增益补偿。纠正：必须先确定扰动通道，输入加性例的系数就不同。
2. 误区：常值扰动最终消失意味着起始时刻也被抵消。纠正：本例输出为 $e^{-3t}$，起始仍有明显响应。

### 自检

1. 本例两种扰动位置对应的静态抵消系数各是多少？
2. 为什么动态精确逆还要检查可实现性？

**核对要点**：输出加性常值补偿为-0.5，理想输入同位置抵消为-1。动态比值可能含不稳定或不适当项，不能只靠代数相消就宣布可以实现。

### 关联节点

- **扰动抑制**（无向，关系：相关）
- **系统静态直流增益**（无向，关系：相关）
