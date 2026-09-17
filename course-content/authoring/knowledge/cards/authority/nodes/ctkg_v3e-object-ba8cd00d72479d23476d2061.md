---
node_id: ctkg_v3e-object-ba8cd00d72479d23476d2061
authority_entity_id: "ctkg:v3e-object-ba8cd00d72479d23476d2061"
name: "奇点"
name_en: "Singular Point in the Phase Plane"
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
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-f08aa327afbd4f162ea1b5877ae4d79f4adc3faa0551ee3dab79a0e8fa0316fb.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-f08aa327afbd4f162ea1b5877ae4d79f4adc3faa0551ee3dab79a0e8fa0316fb.json"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-core-29a/previous/ctkg_v3e-object-ba8cd00d72479d23476d2061.md"
asset_refs: []
---

## 首页
# 奇点 | Singular Point in the Phase Plane

一句话定义：在相平面状态方程中，所有状态导数同时为零的点是平衡点，传统相轨迹斜率分析也称其为奇点。

- 斜率出现 $0/0$ 对应回到原方程检查。
- 分母为零但分子非零只是竖直方向，不是平衡。
- 稳定类型需进一步分析附近向量场。

---
## 详情
### 完整解释

对 $\dot x=v$、$\dot v=f(x,v)$，平衡条件是 $v=0$ 且 $f(x,0)=0$。在这样的点，状态可保持不变，消去时间后的斜率 $dv/dx=f(x,v)/v$ 呈 $0/0$，无法提供普通切线方向。

“奇点”在这里是相平面术语，不表示方程系数必然发散，也不表示系统出现数值错误。应先解原状态导数为零的条件，再判断是稳定焦点、结点、鞍点、中心或其他类型，不能仅凭斜率不定就宣布不稳定。

### 教学计算/推理例

对 $f=-x-v$，平衡条件为 $v=0$、$-x=0$，唯一奇点是 $(0,0)$。点 $(1,0)$ 虽使斜率分母为0，但加速度为 $-1$，状态向下运动，所以不是奇点。点 $(-1,1)$ 则有加速度0但位置导数1，方向水平向右，也不是平衡。

在原点附近，矩阵

$$
A=\begin{pmatrix}0&1\\-1&-1\end{pmatrix}
$$

的特征方程为 $\lambda^2+\lambda+1=0$，根为 $-1/2\pm j\sqrt3/2$，原点是稳定焦点。若方程改为 $\dot v=-x$，同一原点仍是奇点，但特征值变为 $\pm j$，相图是中心和闭合轨道族。奇点位置相同，不意味着类型相同。

对非线性系统，若线性化出现零实部特征值，一阶结果可能不足以确定附近行为，需检查高阶项或使用其他方法。不能把线性中心的结论机械套给所有同样线性化的非线性系统。

### 适用条件与边界

本定义针对完整二维自治状态。若只看高维状态投影，两个可见导数为零不意味着其他状态导数为零；若外部输入随时间变化，瞬间导数为零也不保证一直保持。平衡需与固定输入和完整模型一致。

分区系统中，某个延拓方程的平衡可能不在该分区有效范围内，传统上称虚奇点；它不是整套分段系统在该位置的实际平衡。切换边界还需核验实际采用的方程或解规则。平衡可能不止一个，局部类型也不能自动替代全局稳定判断。

### 常见误区

1. 把整条零速度轴都当作奇点集合。
2. 把加速度为0单独当成平衡条件。
3. 只知道奇点位置就断言其稳定类型。

### 自检

1. 本例 $(1,0)$ 的斜率无有限值，为何不是奇点？
2. 同为原点平衡，阻尼系统与无阻尼系统的类型是否相同？

**核对要点**：它的加速度非零，状态继续变化；阻尼例是稳定焦点，无阻尼例是中心，需由附近动力学判断。

### 关联节点

- **实奇点**（出边，关系：前置于）
- **虚奇点**（出边，关系：前置于）
- **相平面**（出边，关系：组成部分属于）
