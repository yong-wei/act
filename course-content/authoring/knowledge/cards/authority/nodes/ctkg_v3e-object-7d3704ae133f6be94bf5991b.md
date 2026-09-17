---
node_id: ctkg_v3e-object-7d3704ae133f6be94bf5991b
authority_entity_id: "ctkg:v3e-object-7d3704ae133f6be94bf5991b"
name: "脉冲传递函数"
name_en: "Pulse Transfer Function"
category: 概念性
knowledge_type: C
bloom_level: 应用
card_version: 3
content_origin: act-course-enrichment
authority_release_id: ctr:release:control-theory-engineering-v0.48
authority_snapshot_id: snap-7f1549103098d6efcc8a3989a344c047af682df7d8b4bddd7a28101dee04e731
authority_snapshot_hash: 7f1549103098d6efcc8a3989a344c047af682df7d8b4bddd7a28101dee04e731
status: ready
source_docs:
  - course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-77b02746366715660e63ba042b707e85f8b1833426d5941d11ec12d6f6386ff0.json
  - course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-77b02746366715660e63ba042b707e85f8b1833426d5941d11ec12d6f6386ff0.json
  - course-content/authoring/knowledge/cards/nodes/脉冲传递函数_7_0e24c8e5.md
asset_refs: []
---

## 首页

# 脉冲传递函数 | Pulse Transfer Function

**一句话定义**：零初始条件下，线性时不变离散系统输出序列与输入序列的 z 变换之比。

**核心直觉**：它描述采样时刻之间的递推关系，不直接给出两个采样点之间的连续运动。

**关键公式**：
$$
G(z)=\frac{Y(z)}{U(z)}\quad\text{（零初始条件）}.
$$

**学习目标**：从差分方程得到脉冲传递函数，并按单位圆判断离散极点。

---

## 详情

### 完整解释

#### z 变换与一步延迟

采用 $z^{-1}$ 表示一个采样周期的延迟。对零初始状态的差分方程 $y[k+1]=ay[k]+bu[k]$，变换后得到
$$
G(z)=\frac b{z-a}=\frac{bz^{-1}}{1-az^{-1}}.
$$
分子中的一步延迟说明 $u[0]$ 对这一模型的首次输出影响出现在 $y[1]$，不是 $y[0]$。是否有直通项要由实际模型决定。

#### 一阶连续对象的采样模型

对 $\dot y=-y+u$，采样周期 $T_s=0.1$ 秒、零阶保持输入，得到 $a=e^{-0.1}\approx0.904837$、$b=1-a\approx0.095163$。

单位阶跃序列输入下，$y[0]=0$，$y[1]\approx0.095163$，$y[2]\approx0.181269$，且 $y[k]=1-a^k$。采样点终值为 $1$。该结果来自保持区间内的精确积分，不是把连续式中的 $s$ 直接换为 $z$。

#### 稳定区域发生了变化

因果有理离散系统在没有不稳定内部消去的前提下，BIBO 稳定要求传递函数极点严格位于单位圆内。本例极点为 $a\approx0.904837$，满足要求。连续模态 $e^{st}$ 在采样时刻对应 $z=e^{sT_s}$，连续左半平面因此映入单位圆内部。

$z=1$ 处的极点对应离散累积边界，不能按“实部为正”判成连续系统意义下的右半平面不稳定。离散稳定性判断应使用单位圆标准。

#### 开环与闭环仍要区分

在采样时序、反馈符号和模型相容的条件下，离散负反馈也可由信号方程整理为 $\Phi(z)=D(z)G(z)/[1+D(z)G(z)H(z)]$。但连续方框图中的采样器不能随意跨越求和点或非线性环节移动。

#### 自检

1. $G(z)=0.2/(z-0.8)$ 的单位阶跃终值是多少？
2. 若极点是 $1.1$，应如何判断？

**核对要点**：终值为 $G(1)=1$；极点在单位圆外，因果模型的响应会出现增长模态。

### 关联节点

- **图谱关联**：外部输入输出模型、离散状态方程、数字控制器及闭环脉冲传递函数。
- **学习延伸**：零阶保持器确定采样模型，朱利判据直接检查离散特征多项式。
