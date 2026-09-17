---
node_id: ctkg_v3e-object-83b0bd3fc503270cb174a500
authority_entity_id: "ctkg:v3e-object-83b0bd3fc503270cb174a500"
name: "超前补偿"
name_en: "Lead Compensation"
category: 概念性
knowledge_type: C
bloom_level: 应用
lesson_units:
  - "4-3"
card_version: 3
content_origin: act-course-enrichment
authority_release_id: ctr:release:control-theory-engineering-v0.48
authority_snapshot_id: snap-7f1549103098d6efcc8a3989a344c047af682df7d8b4bddd7a28101dee04e731
authority_snapshot_hash: 7f1549103098d6efcc8a3989a344c047af682df7d8b4bddd7a28101dee04e731
status: ready
source_docs:
  - course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-316bd9d168856d7820e4b17c52c2c3438db927185e66d6afa21aea6dab88a73d.json
  - course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-316bd9d168856d7820e4b17c52c2c3438db927185e66d6afa21aea6dab88a73d.json
  - git:f655dee490f714247dea867602a4d42bf699f2fd:course-content/authoring/knowledge/cards/nodes/超前补偿_4_3d4fc55d.md
  - course-content/authoring/lessons/4-3/design/4-3-handout.md
asset_refs: []
---

## 首页

# 超前补偿 | Lead Compensation

**一句话定义**：利用零点比极点更靠近原点的网络，在一定频段提供正相位的校正方法。

**核心直觉**：在需要的频段补相位，同时承认幅值改变会移动工作点。

**关键公式**：
$$
C(s)=K\frac{Ts+1}{\alpha Ts+1},\qquad T>0,\quad 0<\alpha<1
$$

**学习目标**：计算超前网络的零极点和最大相位，并理解校正后的复核步骤。

---

## 详情

### 完整解释

#### 网络为什么产生超前

零点为 $-1/T$，极点为 $-1/(\alpha T)$。由于 $\alpha<1$，极点比零点更靠左。网络的相位为
$$
\varphi(\omega)=\arctan(\omega T)-\arctan(\alpha\omega T),
$$
在正频率区间为正。低频增益为 $K$，高频增益趋于 $K/\alpha$，所以补相位还伴随高频幅值相对上升。

#### 参数计算例

以下仅设计一个教学用网络，尚未指定对象，不能宣称闭环指标已经达标。取 $K=1$、$T=1$ 秒、$\alpha=0.25$：零点为 $-1$，极点为 $-4$。

图谱中的公式给出
$$
\sin\varphi_{\max}=\frac{1-\alpha}{1+\alpha},\qquad
\omega_m=\frac1{T\sqrt\alpha}.
$$
于是 $\varphi_{\max}\approx36.87^\circ$，$\omega_m=2$ rad/s。在该频率处幅值为 $1/\sqrt\alpha=2$，约 $6.02$ dB。高频极限增益为 $4$，约 $12.04$ dB。

#### 放入反馈环路后的判断顺序

1. 先画或计算未校正环路，明确所需精度、截止频率与相角裕度。
2. 选择超前网络，使相位提升集中在目标频段附近。
3. 用 $L_{new}=CL_{old}$ 重新求所有相关交越频率和裕度。
4. 验算闭环响应、稳态误差、噪声及控制量，必要时迭代。

图谱同时关联根轨迹设计、频域设计及寄生因式。这提醒我们：同一个零极点网络在不同视图中仍是同一个系统；未建模的高频动态可能限制可用的相位与带宽收益。

#### 与其他方法比较

PI 通过积分改变低频结构；超前网络本身没有原点极点，一般不改变型别。超前也不等同于理想微分：它具有有限高频增益，但仍可能加重高频噪声影响。

#### 自检

1. 将例子中的 $T$ 加倍，最大相位是否改变？峰值频率怎样变化？
2. 网络提供 $36.87^\circ$ 最大相位，闭环相角裕度就必然增加这个数吗？

**核对要点**：最大相位不变，峰值频率减半；不一定，必须在新的环路交越处求裕度。

### 关联节点

- **图谱公式**：超前网络形式、相位表达式、最大相位与最大相位频率。
- **图谱关联**：数字超前补偿、寄生因式、超前与滞后设计对比。
- **学习延伸**：伯德图、相角裕度、系统带宽与根轨迹法。
