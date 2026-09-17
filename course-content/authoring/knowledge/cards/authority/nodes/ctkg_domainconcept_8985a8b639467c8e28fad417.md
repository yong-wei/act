---
node_id: ctkg_domainconcept_8985a8b639467c8e28fad417
authority_entity_id: "ctkg:domainconcept:8985a8b639467c8e28fad417"
name: "李雅普诺夫第二法（直接法）"
name_en: "Lyapunov Direct Method"
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
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-1649a940faedb4e68d115ba71102e3297192d50adb573aa39833fa6390e86b31.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-1649a940faedb4e68d115ba71102e3297192d50adb573aa39833fa6390e86b31.json"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-professional-05a/previous/ctkg_domainconcept_8985a8b639467c8e28fad417.md"
asset_refs: []
---

## 首页
# 李雅普诺夫第二法（直接法） | Lyapunov Direct Method

一句话定义：直接法通过标量函数及其沿轨迹导数判断平衡点稳定性，不要求预先求出系统的完整解。

- 正定函数与导数条件必须一起检查。
- 局部结论与全局结论需要不同的区域条件。
- 渐近稳定不自动意味着指数稳定。

---
## 详情
### 完整解释

对自治系统 $\dot x=f(x)$，设原点是平衡点，向量场局部Lipschitz。直接法寻找连续可微的函数V，用函数值限制状态偏离原点的程度，再由轨迹导数判断这种限制是否会保持或加强。V在原点为零、附近非零点为正，且导数非正时，可以建立局部稳定；导数严格负定时，可进一步得到局部渐近稳定。

“直接”指从原系统和标量函数建立证明，不是忽略条件直接下结论。函数符号、导数符号、有效区域和解的存在都属于证明。若希望获得全局渐近稳定，需要在整个状态空间满足相应条件，并通过径向无界等条件保证轨迹不会逃逸。

### 教学计算/推理例

考虑二状态系统

$$
\dot x_1=-x_1,\qquad \dot x_2=-x_2^3.
$$

原点为平衡点，向量场光滑。选择 $V=(x_1^2+x_2^2)/2$，则V全局正定，且当状态范数趋于无穷时V趋于无穷。沿真实系统求导得到

$$
\dot V=x_1(-x_1)+x_2(-x_2^3)=-x_1^2-x_2^4.
$$

任意非零状态至少有一个分量不为零，因此导数严格为负。初始V值为c时，之后轨迹始终留在半径 $\sqrt{2c}$ 的闭圆盘内。这个集合紧且正不变，局部Lipschitz条件与有界性保证解能够向前延拓。因此原点全局渐近稳定。

这里不需要先求轨迹。但解析解可作为核对：令 $\tau=t-t_0$，有 $x_1=x_{10}e^{-\tau}$、$x_2=x_{20}/\sqrt{1+2x_{20}^2\tau}$。两个分量均趋于零，其中第二个分量是代数衰减。取任意非零且足够小的 $x_{20}$、令 $x_{10}=0$，其衰减最终比任意固定指数上界都慢，所以系统并非局部指数稳定。

### 从不等式到结论

V的正定性说明函数能区分原点与其他状态；其子水平集用于把初始邻域限制在指定邻域内，从而证明稳定。严格负定导数进一步排除了非零状态长期维持相同V值的可能，在适当紧性条件下得到吸引性。稳定与吸引两部分合起来才是渐近稳定。

若希望证明指数稳定，还需适当的函数上下界和导数衰减界。例如二次上下界配合 $\dot V\leq-c\lVert x\rVert^2$、c为正常数，可以导出指数估计。本例沿 $x_1=0$ 方向有 $-\dot V/\lVert x\rVert^2=x_2^2$，靠近原点趋于零，不能从现有导数得到这样的统一正常数。

### 适用条件与边界

导数负半定足以支持稳定性，但若要证明渐近稳定，通常还需不变集分析等额外论证。若V和导数条件只在局部区域成立，应选择位于该区域内的正不变子水平集，不能把局部条件直接扩大到整个状态空间。

时变系统若采用显含时间的V，沿轨迹导数必须包括时间偏导。此时还要核对与时间无关的上下界，才能使用相应的一致稳定性定理。这里的自治例不能代替所有时变情况的条件。

### 常见误区

1. 只检查V正定，省略沿原系统求导。
2. 把导数严格负定直接解释为指数衰减。
3. 条件只在局部成立，却给出全局结论。

### 自检

1. 本例为何能够保证解在全部未来时刻存在？
2. 哪个状态分量说明渐近稳定与指数稳定不同？

**核对要点**：轨迹被限制在紧子水平集中，光滑向量场保证可继续延拓；第二分量按代数规律衰减，不能满足固定的局部指数估计。

### 关联节点

- **李雅普诺夫函数**（无向，关系：相关）
- **李雅普诺夫直接法**（无向，关系：相关）
- **李雅普诺夫第二方法**（无向，关系：相关）
