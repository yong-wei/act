---
node_id: ctkg_v3e-object-e28c6b3ef5b1335c8a086f34
authority_entity_id: "ctkg:v3e-object-e28c6b3ef5b1335c8a086f34"
name: "全状态反馈"
name_en: "Full-State Feedback"
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
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-8be6a7919600571893da3efa1ef2c148cf9419bbb3e700a33a7c421eb60b2aa9.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-8be6a7919600571893da3efa1ef2c148cf9419bbb3e700a33a7c421eb60b2aa9.json"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-professional-04a/previous/ctkg_v3e-object-e28c6b3ef5b1335c8a086f34.md"
asset_refs: []
---

## 首页
# 全状态反馈 | Full-State Feedback

一句话定义：全状态反馈利用全部状态构造控制输入，在线性定常模型中常写为 $u=-Kx+v$，通过改变 $A-BK$ 调整闭环动态。

- “全部状态”指控制律需要的状态信息，不要求每个状态都由独立传感器直接测量。
- 可控性保证任意配置闭环极点的理论可能性，可镇定性只保证能够稳定。
- 极点配置不自动保证参考跟踪、输入限幅与噪声性能。

---
## 详情
### 完整解释

对连续时间系统 $\dot x=Ax+Bu$，取 $u=-Kx+v$ 后，状态方程变为 $\dot x=(A-BK)x+Bv$。这里K的尺寸为输入数乘状态数，负号是本卡采用的控制律约定。改变K能够改变输入可作用的动态模态；不可控模态不会因为增益取得很大就任意移动。

若状态不能全部直接测量，可用观测器估计，再以估计量代入控制律，但此时实际系统还包含估计误差动态。全状态反馈设计可以作为这类输出反馈方案的一部分；不能在说明实际闭环时省略观测器。反馈用到哪些变量、这些变量能否可靠获得，都是设计前必须说明的条件。

### 教学计算/推理例

取双积分器

$$
A=\begin{pmatrix}0&1\\0&0\end{pmatrix},\quad
B=\begin{pmatrix}0\\1\end{pmatrix},\quad K=\begin{pmatrix}6&5\end{pmatrix}.
$$

采用 $u=-6x_1-5x_2$，闭环矩阵为 $A-BK=[[0,1],[-6,-5]]$。其特征多项式为 $s^2+5s+6=(s+2)(s+3)$，所以两个闭环极点是 -2、-3，零输入闭环状态渐近衰减到零。

同一模型中，若误把控制律写成 $u=+6x_1+5x_2$ 而保持数值不变，闭环特征多项式成为 $s^2-5s-6=(s-6)(s+1)$，出现正极点6。配置增益时必须把控制律负号一并核对，不能只比较增益的绝对值。

若令输出 $y=x_1$，并在上述稳定反馈后直接加入常数 $v=1$，平衡方程给出 $x_2=0$、$x_1=1/6$，并非单位跟踪。对于本例精确模型，可以用 $v=6r$ 使常值参考r对应平衡输出r；这种静态前馈依赖模型，不能替代对扰动和模型误差的分析。

### 适用条件与边界

本例使用有限维、连续时间、线性定常模型，且未设置执行器饱和。满秩可控性矩阵允许理论上的任意极点配置，但所需输入幅值、响应速度与噪声放大仍需检查。过快极点可能要求超出执行器能力的输入，线性模型得到的结论也可能在大范围运动中失效。

稳定与跟踪是两个验收问题。零参考下状态回零只证明调节目标的一部分；常值或时变参考的稳态误差取决于前馈、积分作用及闭环结构。若使用估计状态，应进一步验证观测误差收敛以及反馈与观测器组合后的稳定性。

### 常见误区

1. 计算时采用负反馈公式，实现时却遗漏负号。
2. 闭环极点稳定就认为任意参考都无稳态误差。
3. 把全状态反馈等同于必须安装n个独立传感器。

### 自检

1. 本例K对应的闭环特征多项式是什么？
2. 加入常数v=1后，输出平衡值为何不是1？

**核对要点**：$s^2+5s+6$；平衡时输入满足 $-6x_1+1=0$，因此输出为1/6。

### 关联节点

- **状态反馈镇定**（无向，关系：相关）
- **全状态反馈设计步骤**（入边，关系：适用于）
- **状态反馈控制设计方法**（无向，关系：相关）
