---
node_id: ctkg_v3e-object-84d4e25a62819cdb7ccb6caf
authority_entity_id: "ctkg:v3e-object-84d4e25a62819cdb7ccb6caf"
name: "零型系统"
name_en: "Type Zero System"
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
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-5e1791779e25f1d161d8c279d4892a1e0bebad5d17a494c585cace907bcd8985.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-5e1791779e25f1d161d8c279d4892a1e0bebad5d17a494c585cace907bcd8985.json"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-core-23a/previous/ctkg_v3e-object-84d4e25a62819cdb7ccb6caf.md"
asset_refs: []
---

## 首页
# 零型系统 | Type Zero System

一句话定义：零型系统是指定环路传递函数中没有原点极点，即没有积分环节的系统类型。

- “型”描述原点极点数，不是系统总阶数。
- 稳定单位负反馈下，有限位置误差系数通常留下阶跃静差。
- 稳态误差结论必须结合输入类型和闭环稳定性。

---
## 详情
### 完整解释

若环路传递函数写成 $L(s)=K\widetilde L(s)/s^\nu$，其中 $\widetilde L(0)$ 有限且非零，$\nu$ 表示原点极点个数。零型对应 $\nu=0$。这里讨论的是指定反馈环路；一个有多个非零极点的高阶系统也可以是零型，不能把零型叫作零阶。

在无测量误差的单位负反馈中，参考到误差的传递函数为 $S=1/(1+L)$。当闭环及终值条件满足、$K_p=\lim_{s\to0}L(s)$ 有限且 $1+K_p\ne0$ 时，单位阶跃稳态误差为

$$
e_{ss}=\frac1{1+K_p}.
$$

静态位置误差系数 $K_p$ 是环路的低频量，不等同于任何结构中控制器的比例增益。零型只是分类信息，无法单独保证闭环稳定或规定瞬态品质。

### 教学计算/推理例

取 $L=2/(s+1)$。原点极点数为0，故为零型；它仍有一阶动态。单位负反馈的闭环极点为 $-3$，位置误差系数为2，单位阶跃误差为

$$
e(t)=\frac13+\frac23e^{-3t},\qquad e_{ss}=\frac13.
$$

若参考改为单位斜坡 $r(t)=t$，则 $R(s)=1/s^2$，有

$$
E(s)=\frac{s+1}{(s+3)s^2},\qquad
 e(t)=\frac t3+\frac29(1-e^{-3t}).
$$

误差随时间无界增长。这不表示闭环不稳定，而是增长参考的跟踪要求无法由该零型环路满足。此时 $sE(s)$ 在原点仍有极点，不能通过通常的有限终值定理声称有一个有限稳态误差。

### 适用条件与边界

系统类型的稳态误差表通常以线性单位负反馈为背景。非单位传感器需要重新定义真实误差并推导。不可用不稳定或原点零极点相消掩盖内部模态，再仅凭约分后的输入输出形式作稳定性结论。加大增益可以减小本例阶跃误差，却不改变原点极点数，也不能在有限增益下使其斜坡误差有界。

### 常见误区

1. 把零型当成没有动态的静态系统。
2. 不检查闭环稳定性，就直接套用静差系数。
3. 认为一个输入的误差较小，所有输入都会具有相同精度。

### 自检

1. 环路 $2/[(s+1)(s+2)]$ 在没有其他积分环节时属于几型？
2. 将本例正增益2改为更大的有限值，能否改变系统类型？

**核对要点**：仍为零型，尽管它有两个非零极点；有限比例增益改变幅值与闭环极点，但不新增环路原点极点。

### 关联节点

- **二型系统**（无向，关系：相关）
- **位置误差常数 (K_p)**（无向，关系：相关）
