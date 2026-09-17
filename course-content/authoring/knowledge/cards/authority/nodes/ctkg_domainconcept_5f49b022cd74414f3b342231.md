---
node_id: ctkg_domainconcept_5f49b022cd74414f3b342231
authority_entity_id: "ctkg:domainconcept:5f49b022cd74414f3b342231"
name: "一致稳定性"
name_en: "Uniform Stability"
category: 概念性
knowledge_type: C
bloom_level: 应用
card_version: 3
confifteent_origin: act-course-enrichment
authority_release_id: "ctr:release:control-theory-engineering-v0.48"
authority_snapshot_id: "snap-7f1549103098d6efcc8a3989a344c047af682df7d8b4bddd7a28101dee04e731"
authority_snapshot_hash: "7f1549103098d6efcc8a3989a344c047af682df7d8b4bddd7a28101dee04e731"
status: ready
source_docs:
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-42c9024ef5dd7088b2c196a824fe2c6c468df0787fa29604d2c8bdd6d0aa1aa7.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-42c9024ef5dd7088b2c196a824fe2c6c468df0787fa29604d2c8bdd6d0aa1aa7.json"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-professional-05a/previous/ctkg_domainconcept_5f49b022cd74414f3b342231.md"
asset_refs: []
---

## 首页
# 一致稳定性 | Uniform Stability

一句话定义：一致稳定性要求保证轨迹始终接近平衡点所需的初始邻域，可以不依赖初始时刻而统一选择。

- “一致”主要约束初始时刻的依赖。
- 一致稳定不自动保证一致吸引。
- 状态不增长与状态按统一速度衰减是不同性质。

---
## 详情
### 完整解释

考虑定义在 $t\geq0$ 的时变系统 $\dot x=f(t,x)$，并假设 $f(t,0)=0$，解在所讨论范围存在且唯一。一致稳定要求：对任意 $\epsilon>0$，存在与起始时刻 $t_0$ 无关的 $\delta(\epsilon)>0$，使所有 $t_0\geq0$ 及满足 $\lVert x(t_0)\rVert<\delta$ 的初态，都在全部未来时刻满足 $\lVert x(t)\rVert<\epsilon$。

普通稳定性允许delta还依赖起始时刻。一致稳定排除了“越晚启动就必须把初始误差取得越小”这一情况。它仍然只说明轨迹保持接近，而不是说轨迹必须向原点运动，或多久能进入更小邻域。

### 教学计算/推理例

取时变标量系统 $\dot x=-x/(1+t)$，其中 $t\geq0$。从 $t_0$ 出发的解析解为

$$
x(t)=x(t_0)\frac{1+t_0}{1+t},\qquad t\geq t_0.
$$

因为比例位于0与1之间，始终有 $|x(t)|\leq|x(t_0)|$。因此对每个epsilon取delta等于epsilon，就能适用于所有起始时刻，证明原点一致稳定。若选择 $V=x^2/2$，也有 $\dot V=-x^2/(1+t)\leq0$，与范数不增的结论一致。

对每个固定的起始时刻和初值，状态还会趋于零。但若只等待固定时间T，剩余比例为 $(1+t_0)/(1+t_0+T)$，在起始时刻趋于无穷时接近1。比如等待10个时间单位，从0启动的比例为1/11，从1000启动的比例为1001/1011。相同等待时间在很晚启动时几乎没有收敛效果。

所以本例虽一致稳定，且对每个固定起始时刻渐近趋零，却不一致渐近稳定。取同一个正初值a并要求降至a/2，无论提出多大的固定T，都可以选择足够晚的起始时刻，使等待T后仍大于a/2。这就是统一吸引时间不存在的具体原因。

### 适用条件与边界

自治系统的动态不显含绝对时间，轨迹对起始时刻仅作平移，稳定性可以自然用相同初始邻域描述。时变系统则必须保留t与t0的区别，不能只画从0时刻启动的轨迹就声称一致性。

用时变李雅普诺夫函数证明一致稳定时，常要求它具有与时间无关的正定上下界，并且包含时间偏导的沿轨迹导数非正。每个固定时刻函数为正，并不自动给出统一状态距离约束；这些界是否随时间退化，需要明确检查。

一致稳定也是相对于具体平衡点和模型区域的性质。局部结果只覆盖足够小的初态，不应扩展为任意初值有界或任意扰动下稳定。若系统存在输入，需要另外说明输入假设和对应的稳定概念。

### 常见误区

1. 将一致稳定误读成各条轨迹具有相同收敛速度。
2. 只验证从零时刻启动的情况，遗漏全部起始时刻。
3. 看到每条轨迹都趋零就自动认为存在统一吸引时间。

### 自检

1. 本例为什么可取与起始时刻无关的delta？
2. 固定等待时间T能否保证所有起始时刻的状态都减半？

**核对要点**：状态绝对值始终不超过初始值，可取delta等于epsilon；不能，晚启动时比例趋于1。

### 关联节点

- **李雅普诺夫稳定性**（无向，关系：相关）
- **李雅普诺夫意义下的稳定性**（无向，关系：相关）
