---
node_id: ctkg_domainconcept_4dd405f4b14b1c56c98340c1
authority_entity_id: "ctkg:domainconcept:4dd405f4b14b1c56c98340c1"
name: "李雅普诺夫函数"
name_en: "Lyapunov Function"
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
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-5a028ad41f0bbce9a0d568a3a44ec9878119469f65c42b2f0c87a0d58be6155c.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-5a028ad41f0bbce9a0d568a3a44ec9878119469f65c42b2f0c87a0d58be6155c.json"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-professional-05a/previous/ctkg_domainconcept_4dd405f4b14b1c56c98340c1.md"
asset_refs: []
---

## 首页
# 李雅普诺夫函数 | Lyapunov Function

一句话定义：李雅普诺夫函数是与系统动态配合的标量函数，通过正定性和沿轨迹变化等条件，为指定区域内的稳定性结论提供证明。

- 它不必具有实际能量的物理单位。
- 结论强弱取决于满足的定理条件。
- 函数值下降不要求欧氏状态距离逐时单调下降。

---
## 详情
### 完整解释

对自治系统 $\dot x=f(x)$ 的原点平衡，常见构造要求V连续可微、原点取零且附近非零状态处严格为正。如果沿轨迹 $\dot V=\nabla V\cdot f\leq0$，可以在适当局部条件下证明稳定；若导数严格负定，则可进一步证明渐近稳定。全局结论还需要覆盖整个状态空间并保证轨迹不会逃逸等条件。

把系统与函数联系起来的是轨迹导数。相同正定函数面对不同动力学，可能下降、不变或上升。因此不能只列出函数表达式就跳到结论，也不能把李雅普诺夫函数理解为对任意系统都适用的固定距离公式。

### 教学计算/推理例

取 $A=[[-1,4],[0,-2]]$，并令

$$
P=\begin{pmatrix}1/2&2/3\\2/3&19/12\end{pmatrix},\qquad V=x^TPx.
$$

P对称，首个主子式为1/2，行列式为25/72，所以正定。它的两个特征值约为0.1827、1.9006，因而有 $0.1827\lVert x\rVert^2\lesssim V(x)\lesssim1.9007\lVert x\rVert^2$；这些小数用于直观理解，严格证明可保留精确特征值或正定矩阵界。

直接相乘得到 $A^TP+PA=-I$，所以 $\dot V=-\lVert x\rVert^2$。函数在全部非零状态处严格下降，且二次型径向无界。线性系统解对所有未来时刻存在，因此原点全局渐近稳定。

更精确地，令 $\lambda_{\max}(P)$ 为最大特征值，由 $V\leq\lambda_{\max}(P)\lVert x\rVert^2$ 得 $\dot V\leq-V/\lambda_{\max}(P)$。再结合最小特征值下界，可以得到状态范数的指数上界。这里指数结论来自二次界和导数界共同成立，而不是仅凭“严格下降”四个字。

### 子水平集的含义

集合 $\{x:V(x)\leq c\}$ 是一个椭圆及其内部。由于V沿轨迹下降，轨迹一旦从这个集合出发，就不能穿越到更高V值处。在稳定性证明中，可以选择足够小的初始集合，让这个正不变椭圆位于希望保持的状态邻域之内。

本例在 $(1,1)^T$ 处的欧氏范数平方导数为2，却不妨碍所选V下降。这说明状态距离可能短时增长，但仍受到椭圆子水平集的约束。非单调的范数曲线不等于不稳定，也不与李雅普诺夫证明冲突。

### 适用条件与边界

若只有导数负半定，需要根据目标结论检查是否要补充不变集分析。若V只在局部区域正定或导数条件只在局部成立，应明确有效区域。若V显含时间，则要使用完整导数，并检查一致上下界是否满足时变定理要求。

找到一个满足条件的函数足以建立相应结论，但找不到简单函数并不证明系统不稳定。候选选择、求导、区域验证与结论范围必须组成完整证据，不能仅以优化器或数值搜索“找到一个矩阵”代替符号与残差核验。

### 常见误区

1. 认为函数必须等于真实机械能。
2. 将V下降解释为欧氏范数每一刻都下降。
3. 将局部有效函数用作未经检验的全局证明。

### 自检

1. 本例V如何限制全部状态方向？
2. 为什么可以进一步得到指数界？

**核对要点**：P正定提供范数上下界；严格二次导数界与二次函数界共同给出指数衰减估计。

### 关联节点

- **平衡点**（出边，关系：适用于）
- **正定函数**（入边，关系：前置于）
- **正定函数**（出边，关系：属于）
