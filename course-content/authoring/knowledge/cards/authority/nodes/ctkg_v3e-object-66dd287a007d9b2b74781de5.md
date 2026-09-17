---
node_id: ctkg_v3e-object-66dd287a007d9b2b74781de5
authority_entity_id: "ctkg:v3e-object-66dd287a007d9b2b74781de5"
name: "采样控制系统"
name_en: "Sampled-Data Control System"
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
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-f2f7527b385cd8622f06981887cdd9c20bd4269cc8ecc2b1ab4a136ba73f91b1.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-f2f7527b385cd8622f06981887cdd9c20bd4269cc8ecc2b1ab4a136ba73f91b1.json"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-professional-01a/previous/ctkg_v3e-object-66dd287a007d9b2b74781de5.md"
asset_refs: []
---

## 首页
# 采样控制系统 | Sampled-Data Control System

一句话定义：采样控制系统通过离散时刻的测量和控制更新调节对象，通常同时包含连续对象、采样环节、离散控制器和保持环节。

- 离散控制信号与连续物理响应并存。
- 采样时刻模型不能自动覆盖全部采样间行为。
- 稳定与性能验证需匹配实际采样、保持和延迟。

---
## 详情
### 完整解释

一个常见闭环中，传感器连续测量物理量，采样器在 $kT_s$ 取得数据，数字控制器根据样值和内部状态计算 $u[k]$，保持器把离散命令转换为区间内作用于连续对象的信号。教材中的脉冲控制表示可用理想冲激列描述离散信息，但实际对象并不会在采样间隔内停止运动。

写模型时需声明测量时刻、计算时序和命令何时生效。若存在一拍计算延迟，当前命令可能依据上一拍信息；这与同拍即时更新不同，不能在稳定分析中忽略。

### 教学计算/推理例

取对象 $\dot x=-x+u$、$y=x$，采样周期0.2 s，命令在每个区间零阶保持。令 $a=e^{-0.2}\approx0.818731$，精确样值方程为 $x[k+1]=ax[k]+(1-a)u[k]$。

设无计算延迟的比例控制 $u[k]=2(r[k]-x[k])$，则

$$
x[k+1]=(3a-2)x[k]+2(1-a)r[k].
$$

闭环样值极点为 $3a-2\approx0.456192$，位于单位圆内。单位常值参考下的平衡满足 $x_*=2(1-a)/(1-3a+2)=2/3$。增益2没有消除稳态误差，与持续比例控制的直流结论相符，但两者瞬态并不完全相同。

本例连续对象稳定、周期固定且采用所列保持与即时反馈，样值递推可用于检查这些条件下的行为。若增加一拍延迟，就需要引入历史状态并重新求特征方程，不能继续引用0.456192这个极点。

### 适用条件与边界

离散样值稳定性不能在任意一般系统中单独保证采样间所有行为都满足要求。应检查连续对象、保持输入和可能隐藏的模态，必要时验证采样间峰值、纹波和约束。本例一阶对象在区间内的响应可由精确连续解恢复，方便交叉核验。

实际控制还可能包含量化、限幅、时钟抖动和通信延迟。把它们省略可以得到教学模型，但需要清楚说明范围；不可将理想无延迟模型结论直接当作实际装置验收结果。

采样控制系统不是“所有信号只存在于离散时刻”的系统。连续物理对象、传感器前端及保持输出都可以在整个时间轴存在，只有某些计算或观测以离散时刻组织。

### 常见误区

1. 把采样间连续对象视为不变化。
2. 有计算延迟却沿用即时反馈递推式。
3. 仅检查样值而忽略任务要求的采样间峰值与执行器约束。

### 自检

1. 本例闭环样值极点约为多少，是否位于单位圆内？
2. 增加一拍计算延迟后，能否直接沿用该极点结论？

**核对要点**：约0.456192，位于单位圆内；不能，延迟改变状态递推和特征方程，应重新计算。

### 关联节点

- **保持器**（入边，关系：组成部分属于）
- **保持器**（出边，关系：包含组件）
- **采样器**（出边，关系：包含组件）
