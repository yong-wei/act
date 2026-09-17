---
node_id: ctkg_domainconcept_e64c6ad0fa1d0483faf9aa7c
authority_entity_id: "ctkg:domainconcept:e64c6ad0fa1d0483faf9aa7c"
name: "纹波"
name_en: "Intersample Ripple"
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
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-9200d74f6fdc4a2808caf3bc0d81fd41e727c13a1dfedfb3ae69a0dd07e5f7ea.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-9200d74f6fdc4a2808caf3bc0d81fd41e727c13a1dfedfb3ae69a0dd07e5f7ea.json"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-professional-10a/previous/ctkg_domainconcept_e64c6ad0fa1d0483faf9aa7c.md"
asset_refs: []
---

## 首页
# 纹波 | Intersample Ripple

一句话定义：本卡的纹波指采样控制中输出样值已满足要求，而相邻采样时刻之间的连续输出仍出现偏离或波动。

- 样值达标不能代替采样间检查。
- 纹波可以来自确定性动态，不必由噪声引起。
- 应区分持续纹波与逐渐衰减的纹波。

---
## 详情
### 完整解释

采样数据只给出离散时刻的信息。连续对象在两个采样点之间仍按原微分方程运行，保持器只固定输入，不会冻结对象状态。输出恰好在采样时刻回到目标，并不排除中间先偏离后返回；只查看样值曲线可能漏掉这个过程。

“纹波”也用于其他工程语境。本卡限定在最小拍采样控制的采样间行为，不把它直接等同于电源纹波、测量噪声或数值积分误差。要判断其来源与大小，应给出连续对象、输入保持方式及内部状态，而不只是连接采样点的直线。

### 教学计算/推理例

考虑 $\dot x_1=-x_1+x_2$、$\dot x_2=-x_2+u$，输出y=x1。零初态、T=1零阶保持、单位阶跃参考，输入没有幅值限制。令 $a=e^{-1}$、b=1-2a，使用一拍样值设计

$$
G(z)=\frac{bz+a^2}{(z-a)^2},\qquad
C(z)=\frac{(z-a)^2}{(z-1)(bz+a^2)}.
$$

零初态闭环参考传递函数为z的逆，因此y[0]=0，从y[1]起样值都为1。可是第一拍后状态为 $x[1]=[1,(1-a)/b]^T$，第二分量约2.39221。此刻输出导数为 $-x_1+x_2\approx1.39221$，并不为零，所以输出会继续变化。

第二个保持区间使用输入u[1]约-0.93825。对任意区间内时间 $0\leq\tau\leq1$，原连续方程给出

$$
y(k+\tau)=e^{-\tau}(x_1[k]+\tau x_2[k])
+u[k]\bigl[1-e^{-\tau}(1+\tau)\bigr].
$$

代入k=1、τ=1/2，得到y(1.5)约1.24737，而y[1]和y[2]都为1。中点偏差约0.24737，足以否定“从第一拍开始连续输出恒等于1”；这个数是中点值，不是未经求极值就宣称的区间峰值。

### 纹波是否持续

本例在y[k]=1之后，第二状态相对于1的偏差按系数 $-a^2/b\approx-0.51217$ 逐拍变化。该系数的模小于1，内部状态和保持输入逐渐趋于平衡，采样间波动也随之衰减。不能把这个例子写成等幅、永不衰减的振荡。

没有外部噪声时这里仍会出现纹波，因为第一拍只把输出送到目标，没有同时把内部状态送到持续保持该输出所需的平衡点。用更平滑的显示曲线或删除中间数据，不能改变真实对象的这个行为。

### 与无纹波要求的区别

如果要求从某个时刻起连续输出恒为1，那么由 $\dot x_1=-x_1+x_2$ 可知需要x2也为1；再由第二个方程可知保持输入应为1。达到这个完整平衡状态，比只在一个采样时刻令x1等于1更严格。

后续无纹波设计会安排两拍过程，使x[2]=[1,1]且之后u=1。通过平衡方程证明t至少为2时输出恒定，才能给出无纹波结论，而不是仅增加若干采样检查点。

### 适用条件与边界

采样间峰值是否允许取决于具体状态和执行器约束。即使纹波最终衰减，早期偏离也可能违反限制；因此不能用渐近稳定代替全过程安全判断。不同对象、保持方式和初态会产生不同采样间行为，本文数值不构成通用纹波界。

### 常见误区

1. 样值误差为零就认定连续输出已经恒定。
2. 把确定性采样间波动一律归因于噪声。
3. 把中点值未经求极值就当作最大峰值。

### 自检

1. 第一拍后哪个内部状态表明输出还会变化？
2. 本例纹波为何会衰减而不是保持等幅？

**核对要点**：x2约2.39221而非1，使输出导数不为零；内部偏差的逐拍系数模约0.51217，小于1。

### 关联节点

- **无纹波最小拍系统**（无向，关系：相关）
- **无纹波最小拍系统设计方法**（无向，关系：相关）
