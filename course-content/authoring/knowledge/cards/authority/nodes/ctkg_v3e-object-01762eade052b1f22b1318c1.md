---
node_id: ctkg_v3e-object-01762eade052b1f22b1318c1
authority_entity_id: "ctkg:v3e-object-01762eade052b1f22b1318c1"
name: "P控制器"
name_en: "Proportional Controller"
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
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-0a6ea009383eae88b081c0e6422e2dc29dc0b09cce774dc8a69d2482ca83d2e4.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-0a6ea009383eae88b081c0e6422e2dc29dc0b09cce774dc8a69d2482ca83d2e4.json"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-core-19a/previous/ctkg_v3e-object-01762eade052b1f22b1318c1.md"
asset_refs: []
---

## 首页

# P控制器 | Proportional Controller

**一句话定义**：P控制器把当前误差按比例系数转换为控制量，理想形式本身不积累误差历史。

$$u(t)=K_pe(t).$$

增益改变闭环行为，是否满足精度和动态要求必须结合对象判断。

---

## 详情

### 完整解释

比例控制的直观作用是误差越大，控制修正越大。它只依赖当前误差，因此理想控制器没有积分状态或微分滤波状态。实际系统若还有偏置、限幅或其他环节，应分别说明，不能把它们隐含进这个简单公式。

比例系数的单位由控制量与误差单位决定。改变误差的数值单位而不相应调整系数，会改变物理作用。反馈符号也需要明确：同一个正数系数在不同连接符号下，可能形成不同的闭环，而不是仅凭 $K_p>0$就保证负反馈。

比例控制是否留下稳态误差取决于对象及输入类型。对于本卡的无积分一阶对象，有限比例增益产生有限阶跃静差；不能将这个结论推广为所有对象都一定具有相同静差。应从完整闭环和误差关系计算。

### 教学计算/推理例

取 $G(s)=1/(s+1)$，负单位反馈、零偏置、零初态单位阶跃。对象方程为 $\dot y=-y+u$，控制器给出 $u=K_p(1-y)$，所以

$$\dot y+(1+K_p)y=K_p.$$

响应为

$$y(t)=\frac{K_p}{1+K_p}\left(1-e^{-(1+K_p)t}\right).$$

当 $K_p=1$时，终值为0.5、稳态误差0.5、时间常数0.5 s，初始控制量为1。当 $K_p=3$时，相应为0.75、0.25、0.25 s和3。

在这个具体模型中，增大比例增益让时间常数缩短、静差减小，但初始控制量也增大；而且任何有限的正增益都没有把本例阶跃静差精确降为零。不能只报告速度改善而不说明控制作用和剩余误差。

### 适用条件与边界

这里没有积分、时延、额外高阶动态或饱和，因此可以直接得到上述单指数结果。真实对象如果包含这些因素，增加比例增益可能带来振荡、失稳或限幅，不能用这个一阶例推断任意对象的调参方向。

输出终值与控制器增益也不是同一个量。本例 $K_p=3$，稳态输出不是3而是0.75，因为反馈改变了输入输出关系。根轨迹或频域分析中使用的回路增益还可能包含对象与测量通路的系数，应清楚说明各个“增益”所指的对象。

若需要零误差跟踪，应根据对象和任务进一步选择结构，而不是单纯把比例系数无限增大。稳定性、性能与可实现控制输入都应分别验证。P控制简单，但并不免除完整闭环分析。

### 常见误区

1. 误区：比例控制增益就是闭环静态增益。纠正：本例闭环静态增益为 $K_p/(1+K_p)$，并非 $K_p$。
2. 误区：增益增大只带来好处。纠正：即使本例速度和静差改善，初始控制作用仍明显增大；其他对象还可能有稳定性限制。

### 自检

1. 本例 $K_p=3$时，为什么终值为0.75而不是3？
2. 从1增到3后，哪个已计算量体现了控制作用的代价？

**核对要点**：负反馈使闭环增益成为 $3/(1+3)$。初始控制量由1增为3，说明不能只看输出时间常数。

### 关联节点

- **比例控制规律**（出边，关系：包含组件）
- **比例控制规律**（无向，关系：相关）
