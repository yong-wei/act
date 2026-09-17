---
node_id: ctkg_m3-v2m_source-object_986a0736dc2b06ddf1e785c9
authority_entity_id: "ctkg:m3-v2m:source-object:986a0736dc2b06ddf1e785c9"
name: "鲁棒设计方法"
name_en: "Robust Design Method"
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
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-39c997def67cfbb15dfb3aa394c66b6a127a9a52c3e5b99d5f49f2de6694c446.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-39c997def67cfbb15dfb3aa394c66b6a127a9a52c3e5b99d5f49f2de6694c446.json"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-professional-12a/supporting-source-inventory.json"
asset_refs: []
---

## 首页
# 鲁棒设计方法 | Robust Design Method

一句话定义：鲁棒设计方法把全族性能要求和实现约束同时转化为控制器条件，并判断是否存在可行设计。

- 先定义不确定集合、指标和控制器范围。
- 性能与执行器约束可能互相冲突。
- 某个控制器族不可行不等于所有结构都不可行。

---
## 详情
### 完整解释

鲁棒设计不只是选一个看起来稳妥的名义参数，而是围绕规定的不确定集合检查所有允许对象。设计步骤需要包含模型范围、性能指标、控制结构、可行性和最终回代验证。若条件之间互相矛盾，应明确指出，不能只展示某一个成功工况。

本卡采用可解析的一阶对象和正比例控制器族，说明如何把要求写成增益不等式。这是一个受限定的设计例子，不把所得增益阈值推广到所有高阶、时变或非线性对象。

### 教学计算/推理例

对象为 $\dot x=-ax+ku$、y=x，a、k为独立未知固定常数，范围分别为[0.8,1.2]和[0.5,1.5]。采用单位负反馈 $u=K(r-y)$，K为待选正数。任务是零初态单位阶跃跟踪，要求全族稳定、稳态误差不超过1/4，同时遵守给定输入上限。

闭环极点为-(a+Kk)，对所有正K都稳定。稳态误差为 $a/(a+Kk)$，最坏点为a=1.2、k=0.5。精度要求化成

$$
\frac{a}{a+Kk}\leq\frac14
\quad\Longleftrightarrow\quad K\geq\frac{3a}{k},
$$

所以要覆盖全族，必须取K至少为7.2。这是由参数边界与单调性得到的严格要求，不是按几个试验点估计的经验增益。

对给定正参数，阶跃输出为 $y(t)=Kk(1-e^{-(a+Kk)t})/(a+Kk)$。输入u=K(1-y)从初值K单调下降到正的稳态值，因此全过程输入峰值就是K。若输入上限为6，则要求K≤6，与K≥7.2冲突，这个比例控制器族不可行。

### 一个可行选择

若允许输入上限为8，则可选K=7.5。最大稳态误差为 $1.2/(1.2+7.5\times0.5)=8/33$，约0.24242，满足不超过1/4的要求；峰值输入7.5也不超过8。最小衰减率为0.8+7.5×0.5=4.55，所以全族闭环稳定。

这个结论把稳定、精度和输入峰值逐项验证。不能只说K在某个范围内就结束，也不能只把稳态控制量与上限比较而遗漏起始峰值。对于非单调或高阶响应，输入峰值未必在初始时刻，需要重新分析。

### 不可行时怎样解释

输入上限6时，本例只证明正比例控制器族不能同时满足所列要求，并没有排除其他控制结构、参考整形或更改指标的可能。是否采用其他方案，应根据原任务和代价重新设计，而不是把一个受限搜索结果说成所有控制问题都无解。

同样，直接将K=7.5控制器输出截在6以内，会改变实际闭环，不能继续使用无饱和阶跃公式宣称全部指标已满足。限幅应进入模型和验证，而不只是最后的输出格式处理。

### 适用条件与边界

这里的不确定集合只包含固定的一阶增益和极点变化，不含额外延迟、未建模动态或噪声限制。较大K可能在这些额外因素存在时产生不同代价或风险，应先扩展模型范围再判断。

本例采用解析单调性得到全族保证。更复杂设计可能需要频域权重、结构化不确定性或优化工具，但无论方法如何，最终仍需回答同样的问题：覆盖哪些对象、满足哪些指标、控制输入能否实现。

### 常见误区

1. 为满足精度任意增大K，却忽略输入上限。
2. 只核验稳态输入，不检查整个响应的输入峰值。
3. 一个控制器族不可行，就宣称所有控制结构都不可行。

### 自检

1. 本例输入上限6为什么与精度要求冲突？
2. 输入上限8时，K=7.5分别满足哪些条件？

**核对要点**：精度要求K至少7.2，而峰值约束要求K至多6；K=7.5满足全族稳定、最大稳态误差8/33和峰值输入不超过8。

### 关联节点

- **鲁棒性**（无向，关系：相关）
- **内模设计**（无向，关系：相关）
