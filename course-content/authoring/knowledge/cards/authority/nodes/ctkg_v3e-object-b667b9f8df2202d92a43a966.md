---
node_id: ctkg_v3e-object-b667b9f8df2202d92a43a966
authority_entity_id: "ctkg:v3e-object-b667b9f8df2202d92a43a966"
name: "可观测性阵 (observability matrix)"
name_en: "Observability Matrix"
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
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-f661928c5b1d831fd97f64da9dec5c637d5a098809d4e7c2f6d2f08aaaa9f8cf.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-f661928c5b1d831fd97f64da9dec5c637d5a098809d4e7c2f6d2f08aaaa9f8cf.json"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-professional-03a/previous/ctkg_v3e-object-b667b9f8df2202d92a43a966.md"
asset_refs: []
---

## 首页
# 可观测性矩阵 | Observability Matrix

一句话定义：可观测性矩阵把输出与其动态传播组合起来，用满列秩判断能否从已知输入和输出信息区分全部初始状态。

- 单一时刻输出不足不代表连续观察必然不足。
- 矩阵为 $[C^T,(CA)^T,\ldots]^T$，注意堆叠方向。
- 理论可观测性不等于含噪数据中可精确估计。

---
## 详情
### 完整解释

对线性定常系统 $\dot x=Ax+Bu$、$y=Cx+Du$，输入及模型已知时可扣除输入贡献，考察初态差对输出的影响。可观测性矩阵为 $\mathcal O=[C;CA;\ldots;CA^{n-1}]$，尺寸为 $pn\times n$。满列秩n意味着不存在非零初态差在所有输出动态中都不可见。

零输入下输出导数满足 $y=Cx$、$\dot y=CAx$ 等关系，这帮助理解矩阵来源；实际估计不一定需要直接数值微分测量，因为微分可能放大噪声。代数可观测性与具体估计算法是不同层次。

### 教学计算/推理例

取 $A=[[-3,-2],[1,0]]$、$C=[1,3]$。有 $CA=[0,-2]$，故

$$
\mathcal O=\begin{pmatrix}1&3\\0&-2\end{pmatrix},\qquad \det\mathcal O=-2.
$$

该二阶系统完全可观测。对零输入理想数据，$\dot y=-2x_2$，可形式上恢复 $x_2=-\dot y/2$，再由 $y=x_1+3x_2$ 恢复 $x_1$。单个输出在时间上的变化提供了额外状态信息。

反例取 $A_h=\operatorname{diag}(-1,2)$、$C_h=[1,0]$，可观测性矩阵为 $[[1,0],[-1,0]]$，秩为1。两个初态若只在第二分量不同，输出始终无法区分；第二状态可能按 $e^{2t}$ 增长，但传感器看不到。这说明外部输出看起来正常，不足以证明所有内部状态稳定。

### 适用条件与边界

判据以已知输入与模型为条件。未知扰动、参数误差、传感器偏置和噪声会影响状态估计，不能用满秩一词保证任意数据下精确重建。若矩阵数值条件很差，即使理论满秩，也可能对误差敏感。

多输出时矩阵通常为高矩阵，满列秩不等于普通方阵可逆；可以用适当秩或估计方法分析。对于时变系统，应使用相应状态转移和观测Gramian等条件，不可把单时刻的常矩阵公式当完整判断。

可观测性关注全部初态差能否区分，不要求每个状态被直接单独测量。输出矩阵某列不为0也不自动保证相应模态可观测，仍需检查与A耦合的整体结构。

### 常见误区

1. 输出数少于状态数就断言不可观测，忽略时间信息。
2. 把满列秩等同于含噪测量下无限精度重建。
3. 稳定外部输出被误当成所有内部模态都受观测。

### 自检

1. 本例只有一个输出，为什么可区分两个状态？
2. 反例中初态第二分量改变，输出会改变吗？

**核对要点**：C与CA提供独立信息；不会，第二模态在输出中不可见，即使它会增长。

### 关联节点

- **能观性秩判据法**（无向，关系：相关）
- **离散可控性矩阵**（无向，关系：相关）
- **可观测性格拉姆判据**（无向，关系：相关）
