---
node_id: ctkg_v3e-object-1ee77aa2b862870735a63c50
authority_entity_id: "ctkg:v3e-object-1ee77aa2b862870735a63c50"
name: "相平面图"
name_en: "Phase Portrait"
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
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-43ce9dc4bdc5c7090e91277bfe8e74e816ef3d00ad5174e4b45ca2bf3cd53e47.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-43ce9dc4bdc5c7090e91277bfe8e74e816ef3d00ad5174e4b45ca2bf3cd53e47.json"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-core-29a/previous/ctkg_v3e-object-1ee77aa2b862870735a63c50.md"
asset_refs: []
---

## 首页
# 相平面图 | Phase Portrait

一句话定义：相平面图由不同初始条件下的一簇相轨迹及运动方向组成，用于观察二维系统的状态演化。

- 图上一个点表示状态，而不是一个时间。
- 一条轨迹对应一个初态，图像整体反映多种初态行为。
- 箭头、平衡点和适用区域是解读的重要信息。

---
## 详情
### 完整解释

对二阶自治系统，可取状态 $x$ 与 $v=\dot x$，写成 $\dot x=v$、$\dot v=f(x,v)$。以 $x$ 为横轴、$v$ 为纵轴，不同初态产生不同相轨迹。这些轨迹与向量场方向共同构成相平面图。

相平面图不直接以时间作横轴；一条曲线的形状也不单独告诉我们沿途速度。若需要某时刻的位置、到达时间或峰值间隔，应结合参数化解或时间积分。箭头可由 $(\dot x,\dot v)$ 决定，不能仅凭曲线斜率猜测前进方向。

### 教学计算/推理例

考虑 $\dot x=v$、$\dot v=-x-v$。唯一平衡点为原点，特征值为 $-1/2\pm j\sqrt3/2$，因此非零轨迹螺旋趋向原点。初态 $(1,0)$ 的向量为 $(0,-1)$，轨迹先向下运动。

令 $\beta=\sqrt3/2$，该初态的解析解为

$$
x(t)=e^{-t/2}\left(\cos\beta t+\frac1{\sqrt3}\sin\beta t\right),\qquad
v(t)=-\frac2{\sqrt3}e^{-t/2}\sin\beta t.
$$

在 $t=1$ 时，状态约为 $(0.65970,-0.53351)$。这个点的横坐标是位移状态0.65970，而不是时间1；时间只用于确定曲线上的点。

用 $V=(x^2+v^2)/2$，有 $\dot V=-v^2\le0$，与幅度逐步缩小的相图一致。若去掉阻尼，变成 $\dot v=-x$，则 $x^2+v^2$ 守恒，相图成为一族闭合圆。连续圆族不孤立，不应把每个圆称为极限环。

### 适用条件与边界

上述坐标可完整描述二阶自治状态。对更高维系统，二维投影可能让不同完整状态落在同一点，投影曲线甚至交叉；不能据此套用完整二维自治相图的全部结论。外部时变输入也可能使相同 $(x,v)$ 在不同时刻具有不同向量。

对满足局部唯一性条件的自治系统，普通轨迹不能在同一状态点以不同方向相交，因为那会违反解的唯一性。非光滑切换系统则需明确边界规则和解的含义，不能无条件搬用光滑系统结论。数值绘图还应保留箭头、初态与尺度，避免凭屏幕形状误读动力学。

### 常见误区

1. 把相图横轴当成时间轴，用曲线左右位置判断先后时刻。
2. 没有箭头就认定轨迹向平衡点运动。
3. 将高维投影中的交叉当作完整状态轨迹违反唯一性。

### 自检

1. 本例初态 $(1,0)$ 的轨迹最初向哪个方向？
2. 无阻尼圆族与稳定极限环的关键区别是什么？

**核对要点**：向下，因为 $\dot x=0,\dot v=-1$；圆族不孤立，稳定极限环是孤立周期轨道且有相应邻域行为。

### 关联节点

- **相轨迹**（出边，关系：包含组件）
- **相轨迹**（入边，关系：组成部分属于）
- **分隔线**（出边，关系：包含组件）
