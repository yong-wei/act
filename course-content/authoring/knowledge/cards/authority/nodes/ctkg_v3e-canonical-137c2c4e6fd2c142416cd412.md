---
node_id: ctkg_v3e-canonical-137c2c4e6fd2c142416cd412
authority_entity_id: "ctkg:v3e-canonical-137c2c4e6fd2c142416cd412"
name: "动态性能指标"
name_en: "Transient Performance Measures"
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
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-c68a6ea6a16ce7440f03125bf749a2c2edf46f11532caa0bacf0c09776c81a1b.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-c68a6ea6a16ce7440f03125bf749a2c2edf46f11532caa0bacf0c09776c81a1b.json"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-core-13a/previous/ctkg_v3e-canonical-137c2c4e6fd2c142416cd412.md"
asset_refs: []
---

## 首页

# 动态性能指标 | Transient Performance Measures

**一句话定义**：动态性能指标把规定输入下的响应过程转化为可比较的时间与幅值量。

它们分别回答“升得多快、超过多少、多久保持在容差内”，必须同时说明输入、初态和计量口径。

---

## 详情

### 完整解释

评价一条响应曲线不能只说“很快”或“很平稳”。上升时间、峰值时间、超调量和调节时间各测量不同事件：上升时间需要规定起止阈值；峰值时间关注首次规定峰值；超调量衡量超过稳态值的相对或绝对幅度；调节时间要求此后持续保持在允许带内。定义并不互相替代，一次穿过终值也不意味着动态过程结束。

本卡采用零初态单位阶跃，终值为1，上升时间用首次从0到100%的口径，调节时间用终值的2%误差带。峰值与时间都从阶跃开始计量。换成10%至90%上升时间或5%调节带，会得到不同数值，报告应保留这些条件。对没有有限首次到达终值的单调渐近响应，不能强行给出有限的0至100%上升时间。

上述指标在稳定、具有合适终值的响应上最易解释。若输出不收敛或初态本身已超出终值，就需要重新明确基准。对于零终值调节任务，应给出绝对容差或另一个幅值尺度，不能除以零计算百分比。实际采样还受时间分辨率和记录长度影响，有限记录仅支持其覆盖区间内的观察。

### 教学计算/推理例

取单位静态增益、无零点的标准二阶闭环模型

$$T(s)=\frac{16}{s^2+4.8s+16}.$$

由系数得到 $\omega_n=4\,\mathrm{rad/s}$、$\zeta=0.6$、$\omega_d=3.2\,\mathrm{rad/s}$。零初态单位阶跃的完整响应是

$$y(t)=1-e^{-2.4t}\left[\cos(3.2t)+0.75\sin(3.2t)\right].$$

首次峰值出现在 $t_p=\pi/3.2\approx0.981748\,\mathrm{s}$，超调约9.478022%。首次达到终值的时刻为

$$t_r=\frac{\pi-\arccos(0.6)}{3.2}\approx0.691968\,\mathrm{s}.$$

调节时间不能由第一次进入误差带直接确定。按响应极值划分单调区间，分别解 $y=0.98$ 和 $y=1.02$，最后一次边界交点约为 $1.485747\,\mathrm{s}$。结合解析包络

$$|y(t)-1|\le1.25e^{-2.4t}$$

及之前各极值，可证明最后交点后不再越界。包络单独给出的保证时刻约1.722986 s，是一个上界；常用 $4/(\zeta\omega_n)\approx1.666667\,\mathrm{s}$ 则是估算。三个数的含义不同，不应放在同一表格中都标为“精确调节时间”。

### 适用条件与边界

公式计算依赖标准二阶、零初态、无零点、单位阶跃等条件。实际高阶系统即使具有同样一对极点，额外极点、零点及其响应权重也会改变指标。不能仅从某一对极点位置读取整个实际系统的精确峰时和超调；应先判断二阶近似是否适用，再用完整模型或实验核验。

指标还必须与用途相连。对于要求快速到位但不能碰撞的伺服装置，超调约束可能比首次上升快更重要；对于需要进入精度带后开始下一步操作的过程，持续保持的调节时间才更相关。将几个指标并列，是为了支持具体取舍，而不是把它们合成一个未经定义的“速度分数”。

### 常见误区

1. 误区：只要上升时间较短，所有动态性能都更好。纠正：峰值、超调和调节时间测量不同方面，必须分别比较。
2. 误区：$4/(\zeta\omega_n)$就是2%调节时间的精确值。纠正：它是常用近似，完整响应的最后越界时刻才决定严格结果。

### 自检

1. 本例0.691968 s和1.485747 s分别对应什么条件？
2. 若另一报告采用10%至90%上升时间，能否不换算就与本例的上升时间排序？

**核对要点**：前者是首次达到终值，后者是在2%带内持续保持的最早时刻。两种上升时间口径不同，需要先统一定义；二阶估算还必须说明模型条件。

### 关联节点

- **超调量**（出边，关系：包含组件）
- **稳态性能**（无向，关系：相关）
- **动态性能**（无向，关系：相关）
