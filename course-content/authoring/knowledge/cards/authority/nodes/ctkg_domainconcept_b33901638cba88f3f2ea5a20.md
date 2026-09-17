---
node_id: ctkg_domainconcept_b33901638cba88f3f2ea5a20
authority_entity_id: "ctkg:domainconcept:b33901638cba88f3f2ea5a20"
name: "离散积分控制"
name_en: "Discrete Integral Control"
category: 概念性
knowledge_type: C
bloom_level: 应用
card_version: 3
consevent_origin: act-course-enrichment
authority_release_id: "ctr:release:control-theory-engineering-v0.48"
authority_snapshot_id: "snap-7f1549103098d6efcc8a3989a344c047af682df7d8b4bddd7a28101dee04e731"
authority_snapshot_hash: "7f1549103098d6efcc8a3989a344c047af682df7d8b4bddd7a28101dee04e731"
status: ready
source_docs:
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-e7daf9525e80129f39f468b58496c84929e9ff244412082e1e8b3fcad094195e.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-e7daf9525e80129f39f468b58496c84929e9ff244412082e1e8b3fcad094195e.json"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-professional-08a/previous/ctkg_domainconcept_b33901638cba88f3f2ea5a20.md"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-professional-08a/supporting-source-inventory.json"
asset_refs: []
---

## 首页
# 离散积分控制 | Discrete Integral Control

一句话定义：离散积分控制按采样周期累积误差，使控制量能够保留过去误差的作用，但必须配合闭环稳定与执行器条件分析。

- 累积更新的索引和初态必须明确。
- 积分增益需要与采样周期配合。
- 执行器限幅不自动停止内部积累。

---
## 详情
### 完整解释

积分作用把持续误差累积成控制贡献。离散实现可以采用前向矩形、后向矩形或梯形等不同积分规则，它们对当前和历史样值的使用不同。本卡采用当前误差更新：$I[k]=I[k-1]+K_iT e[k]$，随后输出u[k]=I[k]。这里T为采样周期，初始内部状态是I[-1]。

如果先输出旧积分状态、再进行更新，则实际输入会延后一拍；这与本卡约定不同。实现和推导应使用同一个时序，不能在差分方程里使用当前误差，却在信号流中输出尚未更新的旧值。

### 教学计算/推理例

设 $K_i=2$、T=0.1，误差序列e[k]从k=0起恒为1，积分初态I[-1]=0。每一步增加量为 $K_iT e[k]=0.2$，所以I[0]=0.2、I[1]=0.4、I[2]=0.6。这只是对给定误差序列的控制器运算核对，不是假设一个具体闭环永远保持该误差。

在零初态下，对差分关系作z变换得到

$$
(1-z^{-1})I(z)=K_iT E(z),\qquad
\frac{I(z)}{E(z)}=\frac{K_iT}{1-z^{-1}}.
$$

这个表达式对应当前误差先更新再输出的后向矩形实现。若采用上一拍误差更新，则传递关系会多一个相应延迟，不能把两种形式只当作符号写法不同。积分器的开环极点为1，持续常误差使内部状态线性增长，与上述序列一致。

### 采样周期与单位

若采样周期减半而Ki保持不变，则每一步的累积增量减半，但同样物理时间内更新次数加倍。在误差恒定且比较相同累计时间的条件下，积分量应保持一致。若忘记乘T，改变采样周期就会改变等效积分强度。

当误差和输出已归一化时，Ki的单位通常包含时间的倒数；若二者量纲不同，还应包含对应的单位比例。不能只复制一个无单位数字而省略采样周期和变量定义，随后期待不同系统有相同积分作用。

### 限幅与积分累积

给前面的控制器加上输出上限0.3，假设内部更新规则仍然不变。前三步内部I仍为0.2、0.4、0.6，实际输出却只能是0.2、0.3、0.3。内部状态与实际执行输入从第二步开始分离，说明输出截幅本身并未阻止内部累积。

持续累积可能在误差改变方向后造成恢复迟缓，这就是讨论抗积分饱和措施时必须关注的状态。具体抗饱和方法需要明确积分状态更新和执行器反馈，不能简单把“输出有限”当作“内部积分已经受控”的证明。

### 适用条件与边界

积分作用能在适当稳定闭环和可达平衡条件下帮助消除某些恒定误差，但并不保证加入积分后任意闭环稳定，也不能克服不可实现的参考或持续饱和。必须把积分器与对象一起建立闭环，再判断极点、约束和终值条件。

非零积分初态代表已有历史贡献，重启或控制模式切换时不能无条件当作零。积分器的初始状态、复位规则和输出时序都会影响实际响应，本卡的简单序列只在明确的零初态与固定更新约定下成立。

### 常见误区

1. 省略采样周期，导致更换更新频率后积分强度变化。
2. 输出限幅后仍假定内部积分状态不会增长。
3. 认为加入积分自动保证稳定且消除一切误差。

### 自检

1. 本例前三次更新后的内部状态是多少？
2. 上限0.3为何不能把第三步内部状态也变成0.3？

**核对要点**：0.2、0.4、0.6；本例只限制实际输出，积分更新方程并没有随限幅改变。

### 关联节点

- **积分控制**（无向，关系：相关）
