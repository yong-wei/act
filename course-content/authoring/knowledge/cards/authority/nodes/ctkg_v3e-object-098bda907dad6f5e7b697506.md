---
node_id: ctkg_v3e-object-098bda907dad6f5e7b697506
authority_entity_id: "ctkg:v3e-object-098bda907dad6f5e7b697506"
name: "极限环"
name_en: "Limit Cycle"
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
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-5780db7443f51d4c6b1ac147419efc2625453896278af1b8aca9054a6ae751f8.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-5780db7443f51d4c6b1ac147419efc2625453896278af1b8aca9054a6ae751f8.json"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-core-28a/previous/ctkg_v3e-object-098bda907dad6f5e7b697506.md"
asset_refs: []
---

## 首页
# 极限环 | Limit Cycle

一句话定义：极限环是自治动力系统相空间中的孤立周期轨道，其附近轨迹可以趋近、远离或呈单侧吸引行为。

- 周期轨道必须具有孤立性，不能仅凭闭合形状判断。
- 极限环与平衡点不同，沿环运动的状态随时间变化。
- 稳定性要检查环附近的扰动，而非只看环上运动。

---
## 详情
### 完整解释

在自治系统中，若一条非平衡轨迹经过有限时间后重复，便形成周期轨道。若其某个邻域内不存在其他周期轨道，该轨道是孤立的，称为极限环。稳定、非稳定和半稳定等分类描述邻近轨迹在横向偏离后如何演化。

线性无阻尼振子可形成连续的一族闭合圆轨道，每个初始能量对应不同圆周。这些圆不是孤立的，因此不能仅因输出呈正弦振荡就把每一条都称为极限环。极限环也不必在一般坐标中呈圆形，圆只是便于解析的例子。

### 教学计算/推理例

考虑无外部输入的平面系统

$$
\dot x=(1-r^2)x-y,\qquad \dot y=x+(1-r^2)y,\qquad r^2=x^2+y^2.
$$

对 $r>0$，由径向和切向分量得到 $\dot r=r(1-r^2)$、$\dot\theta=1$。在 $r=1$ 上径向速度为0，角度以单位速度增加，故圆周是一条周期为 $2\pi$ 的轨道。

当 $0<r<1$ 时，径向速度为正；当 $r>1$ 时，径向速度为负。因此非零初始半径从两侧趋近1，该周期轨道横向吸引。只有 $r=1$ 能在正半径处保持常半径周期运动，其附近没有其他周期圆，满足孤立性。原点 $r=0$ 仍是平衡点，恰好从原点出发不会自动进入环上运动。

例如 $r=0.5$ 时径向速度为0.375，$r=2$ 时为 $-6$。符号说明内侧向外、外侧向内；这些瞬时速度不等于整个接近过程保持恒速，实际速度随半径变化。

### 适用条件与边界

稳定周期运动中的相位可以随初态不同而不同。对极限环谈稳定时，通常关注到轨道的距离，而不是要求所有初态在同一绝对时刻到达同一相位点。不能把沿环运动的相位差误判为径向发散。

相图或数值时间序列可以提供证据，但有限时长的近似周期波形不自动证明孤立周期轨道存在。应结合系统方程、相平面或其他适用方法核验。强迫振荡由外部周期信号维持，与自治系统的自激周期轨道也应区分。

### 常见误区

1. 把所有闭合轨迹、所有正弦输出都称为极限环。
2. 只验证环上径向速度为0，未检查附近轨迹与孤立性。
3. 认为稳定极限环意味着原点等所有初态都必须进入该周期轨道。

### 自检

1. 无阻尼线性振子的连续圆族为何不满足本卡定义？
2. 本例从半径0.5和2出发，半径分别向哪个方向变化？

**核对要点**：圆族不孤立；前者增大、后者减小，非零半径均趋近1，原点则保持平衡。

### 关联节点

- **奇线**（出边，关系：属于）
- **相平面**（出边，关系：组成部分属于）
- **分隔线**（出边，关系：属于）
