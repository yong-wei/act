---
node_id: ctkg_v3e-canonical-23c4127cb1ffab795d290351
authority_entity_id: "ctkg:v3e-canonical-23c4127cb1ffab795d290351"
name: "系统模态"
name_en: "System Modes"
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
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-e93f47d31a82889ade46875eb7682ccbd3077306bb8e97abb8180ac5b15a3187.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-e93f47d31a82889ade46875eb7682ccbd3077306bb8e97abb8180ac5b15a3187.json"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-core-14a/previous/ctkg_v3e-canonical-23c4127cb1ffab795d290351.md"
asset_refs: []
---

## 首页

# 系统模态 | System Modes

**一句话定义**：系统模态是线性系统内部运动的基本时间成分，其形式由状态矩阵的特征结构决定。

模态是否在某条输出曲线上明显出现，还取决于激励、初态和测量方式。

---

## 详情

### 完整解释

把复杂运动拆成基本成分，可以帮助解释系统为什么同时具有快变化、慢变化或振荡。连续时间线性定常系统的实特征值常对应指数项，共轭复特征值对应衰减或增长的正弦成分；当矩阵不可对角化时，还可能出现时间多项式乘指数。模态讨论的是状态运动的结构，不只是给曲线某一段起一个名字。

在状态方程中，零输入响应由状态转移矩阵作用于初态得到。即使系统具有某个特征值，如果初态没有相应分量，它也可能不出现在这次自由运动中。加入外部输入后，还要看该输入能否激励该模态。最后，输出只测量状态的某种组合，因此一个已被激励的内部模态也可能在选定输出中不可见。

这三个层次应分开：系统是否具有该模态、本次运动是否激励它、当前输出是否观察到它。看到一条单指数输出不能立即断言整个系统只有一阶；同样，某个内部状态变化较慢，也不保证它支配所有测量量。模态分析应明确系统边界和输入输出通道。

### 教学计算/推理例

考虑无输入的二状态系统

$$\dot x=Ax,\qquad A=\begin{bmatrix}-1&0\\0&-5\end{bmatrix},\qquad x(0)=\begin{bmatrix}1\\1\end{bmatrix}.$$

两个特征值是-1和-5。直接解两条原方程得

$$x_1(t)=e^{-t},\qquad x_2(t)=e^{-5t}.$$

这次运动中两个模态均被初态激励。若输出定义为 $y=x_2$，则只能看到快速指数 $e^{-5t}$；慢状态 $x_1$仍然存在，并没有因为输出曲线中看不到而被删除。

若改成 $y=x_1+x_2$，两个分量都可见，后期通常由 $e^{-t}$ 主导。若保持后一种输出但将初态改为 $(0,1)$，此次自由响应又只剩 $e^{-5t}$。这些变化都没有改变状态矩阵的特征值，却改变了测得的响应。这说明仅按特征值列表推断一次实验曲线，信息并不完整。

对复特征值 $-0.4\pm0.3j$，相应实运动可由 $e^{-0.4t}\cos(0.3t)$ 和 $e^{-0.4t}\sin(0.3t)$ 的线性组合表示。其中0.4决定指数包络的衰减速率，0.3决定振荡角频率，具体幅度与相位仍由初态及通道决定。

### 适用条件与边界

这里采用常系数线性模型。非线性系统在平衡点附近可以通过线性化讨论局部模态，但这并不保证大范围运动仍由同样的指数叠加精确描述。时变系统也不能不加条件地使用固定特征值分解作为全程响应。

对重特征值，必须进一步检查特征向量是否足够，不能一律只写重复的纯指数。例如存在非平凡Jordan块时，解中会出现 $te^{\lambda t}$ 等因子。模态的“重数”、响应中是否出现该模态以及其幅值大小，是不同信息，不能由单个标签替代。

工程测量中，某一传感器可能对某种运动不敏感。调整测量位置或选择另一输出，可能看到先前隐藏的分量；但是否可观测需要结合完整模型判断，不能凭一次低噪声记录中未见波动就下结论。本卡的例子用于区分这些判断层次。

### 常见误区

1. 误区：输出中没有慢指数，系统就没有慢模态。纠正：模态可能未激励或在该输出中不可见。
2. 误区：相同特征值必然产生相同输出曲线。纠正：初态、输入和测量方式决定组合系数及可见性。

### 自检

1. 本例 $y=x_2$ 时，慢模态是否仍存在于状态运动中？
2. 保持 $y=x_1+x_2$，将初态改为 $(0,1)$，为什么测量只剩快速指数？

**核对要点**：在原初态下慢状态仍按 $e^{-t}$ 运动，只是没有进入输出。修改初态后慢模态没有被这次自由运动激励；系统特征结构并未改变。

### 关联节点

- **传递函数**（出边，关系：推导自）
