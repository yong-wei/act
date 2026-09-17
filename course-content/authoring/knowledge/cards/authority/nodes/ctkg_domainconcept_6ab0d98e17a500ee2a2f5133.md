---
node_id: ctkg_domainconcept_6ab0d98e17a500ee2a2f5133
authority_entity_id: "ctkg:domainconcept:6ab0d98e17a500ee2a2f5133"
name: "无纹波最小拍系统"
name_en: "Ripple-Free Deadbeat System"
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
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-f858e987440108bfacc73d118aae49e066ec9c46a82e0d933f93fce6d0c996ac.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-f858e987440108bfacc73d118aae49e066ec9c46a82e0d933f93fce6d0c996ac.json"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-professional-10a/previous/ctkg_domainconcept_6ab0d98e17a500ee2a2f5133.md"
asset_refs: []
---

## 首页
# 无纹波最小拍系统 | Ripple-Free Deadbeat System

一句话定义：无纹波最小拍设计在满足指定有限拍样值整定的同时，使此后连续输出在采样间也保持要求的稳态。

- 它比只要求样值误差归零更严格。
- 应核验内部状态、保持输入和连续平衡条件。
- 最少拍数取决于对象及约束。

---
## 详情
### 完整解释

本卡讨论零初态单位阶跃、固定采样和零阶保持下的无纹波最小拍。要求从某一有限拍开始，不仅输出样值等于目标，而且之后连续输出也不再在采样间偏离。为了证明“最小”，还要说明更少的保持区间为什么不能满足这些条件。

对于有多个内部状态的对象，先把输出送到目标可能仍留下使输出继续变化的内部状态。无纹波设计需要消除这种未完成的动态，而不只是让输出在每个采样点恰好返回目标。

### 教学计算/推理例

仍取 $\dot x_1=-x_1+x_2$、$\dot x_2=-x_2+u$、y=x1，零初态，T=1零阶保持且输入不设幅值上限。令 $a=e^{-1}$、$b=1-2a$、$d=(1-a)^2=b+a^2$。精确离散对象为 $G(z)=(bz+a^2)/(z-a)^2$。

选择两拍闭环目标

$$
\Phi(z)=\frac{bz+a^2}{dz^2}
=\alpha z^{-1}+\beta z^{-2},\qquad
\alpha=\frac{b}{d},\quad\beta=\frac{a^2}{d}.
$$

因为α+β=1，单位阶跃样值为y[0]=0、y[1]=α约0.66130，从y[2]起为1。实现该目标的一组保持输入为u[0]=1/d约2.50265、u[1]=b/d约0.66130，之后u[k]=1。由精确状态递推得到x[2]=[1,1]。

将这个状态与后续输入代回连续方程，两项导数都为零。因此从t=2起，状态保持[1,1]，输出连续地等于1。这个平衡证明覆盖整个后续时间，不只是有限网格上的抽样检查。

### 为什么本例至少需要两拍

若希望一拍后就无纹波且输出为1，则t=1时必须同时有x1=1与x2=1；否则输出导数不为零。零初态在一个保持区间后只能到达

$$
x[1]=\begin{pmatrix}b\\1-a\end{pmatrix}u[0].
$$

由于b不等于1-a，没有一个标量u[0]能让两个分量同时为1。因此一拍无纹波不可能，而上面的两拍构造确实达到要求，故在本例已声明的输入保持和初态条件下，两拍是最少拍数。

这与只要求输出样值一拍归零并不矛盾。较弱的要求允许第二状态继续变化，较强的无纹波要求则必须把它一并送到持续保持输出所需的平衡点。

### 内部稳定与输入要求

对应控制器的完整互连特征根包含a、a、0、0，全部位于单位圆内。稳定的内部模态没有被当作不存在，但所给零初态参考轨迹恰好在两拍后到达平衡。对任意非零初态，不应直接复用同一个有限拍结论而省略验证。

本例第一拍需要输入约2.50265；若执行器上限低于该值，这个具体输入序列不能执行，无纹波最少拍数也可能改变。不能在输出上简单限幅后仍声称已实现同一理想设计。

### 适用条件与边界

无纹波结论针对单位阶跃和所给连续对象，不能自动覆盖斜坡、正弦参考、扰动或模型失配。不同保持形式也会改变可达状态和采样间轨迹。其他系统的无纹波条件应从其动态推导，不可只照搬两拍这个数字。

### 常见误区

1. 只检查输出样值，不核验完整平衡状态。
2. 把一个两拍方案称为最少拍数，却没有排除一拍可能。
3. 忽略输入幅值或更换初态后继续沿用结论。

### 自检

1. 本例t=2后为何可以证明整个连续输出不变？
2. 一拍不可能的关键代数事实是什么？

**核对要点**：x=[1,1]、u=1使连续方程两项导数都为零；一个保持输入只能沿Bd方向到达状态，而Bd两分量不相等。

### 关联节点

- **纹波**（无向，关系：相关）
- **最小拍系统**（无向，关系：相关）
- **最小拍系统**（出边，关系：属于）
