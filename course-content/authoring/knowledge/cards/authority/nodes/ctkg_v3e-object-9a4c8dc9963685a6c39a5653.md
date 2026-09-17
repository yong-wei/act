---
node_id: ctkg_v3e-object-9a4c8dc9963685a6c39a5653
authority_entity_id: "ctkg:v3e-object-9a4c8dc9963685a6c39a5653"
name: "容许控制"
name_en: "Admissible Control"
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
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-ff68f1644d4400feace28ac6f0b3be23784502ce43c43139f069220d85930918.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-ff68f1644d4400feace28ac6f0b3be23784502ce43c43139f069220d85930918.json"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-core-29a/previous/ctkg_v3e-object-9a4c8dc9963685a6c39a5653.md"
asset_refs: []
---

## 首页
# 容许控制 | Admissible Control

一句话定义：容许控制是在指定系统和任务中满足全部已声明约束的控制输入，约束可包括幅值、时间、状态与终端条件。

- 仅满足输入幅值上限未必满足整个任务。
- 容许性与最优性不同。
- 应先写明约束集合，再判断某个控制是否容许。

---
## 详情
### 完整解释

控制问题常要求输入不能超过执行器能力，还可能要求分段连续、状态不越界、规定时间到达目标等。不同文献有时把终端条件单列为可行轨迹约束，因此使用“容许”一词时应明确本问题包含哪些条件。本卡把所列动力学、输入限制和端点要求一起作为任务可行性的判断依据。

一个输入满足限制只是第一步，还要把它代入动力学，检查生成的状态轨迹。如果可行控制不止一个，选择性能最好的控制属于后续优化问题；可行例子本身并不构成最优性证明。

### 教学计算/推理例

取双积分器 $\dot x=v$、$\dot v=u$，要求 $|u|\le1$，时间区间为 $[0,2]$，初态 $(0,0)$，终态 $(1,0)$。选择前1秒 $u=1$，后1秒 $u=-1$，它是满足幅值限制的分段常值输入。

在 $0\le t\le1$，$v=t$、$x=t^2/2$，故切换时状态为 $(0.5,1)$。令 $q=t-1$，在后半段有

$$
v=1-q,\qquad x=0.5+q-\frac{q^2}{2}.
$$

到 $t=2$ 时 $q=1$，得到 $(x,v)=(1,0)$，满足终端要求。切换时控制可跳变，但本例状态连续；若额外要求控制变化率有限，则该理想切换输入需要重新检查，不能沿用旧的容许结论。

作为反例，恒定 $u=2$ 直接违反幅值约束；恒定 $u=0$ 虽满足幅值限制，却停在 $(0,0)$，未满足本任务终态。后者只能称输入幅值合格，不能称已经完成任务。

### 适用条件与边界

上述两秒控制展示了可行性，没有证明最短时间或最小能量。若目标函数、时域、约束或动力学改变，最优或容许控制集合都会改变。模型含饱和、延迟或状态限制时，应使用实际执行量及相应动态验证，而不是只检查理想命令。

若终端状态允许误差，应给出明确容差；若要求精确到达，则不能用“足够接近”替代。数值求解得到的候选也需复核约束，尤其在切换点和区间内部，不能只检查若干端点样本。

本例在时间1切换，并未由此推导一般状态反馈开关线。按时间切换的已知可行输入与通过相平面推导的控制策略不同，不能把它们无说明地互换。

### 常见误区

1. 只检查 $|u|\le1$ 就宣布终端任务完成。
2. 找到一个可行控制就称其最优，未给目标函数或证明。
3. 加入变化率等新约束后仍沿用原有容许结论。

### 自检

1. 本例 $u=0$ 为何不能满足完整任务？
2. 两段控制可行，是否已经证明其最短时间性质？

**核对要点**：终态仍为原点，不是 $(1,0)$；可行性验算不等于最优性证明，本卡未作该声明。

### 关联节点

- **状态可控**（出边，关系：适用于）
