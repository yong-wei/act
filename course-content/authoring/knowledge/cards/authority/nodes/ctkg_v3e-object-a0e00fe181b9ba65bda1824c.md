---
node_id: ctkg_v3e-object-a0e00fe181b9ba65bda1824c
authority_entity_id: "ctkg:v3e-object-a0e00fe181b9ba65bda1824c"
name: "相平面法"
name_en: "Phase-Plane Method"
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
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-db4c0abd4769927ec3f48911c1433980eb12945eb768619bb83fd4417e4344e7.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-db4c0abd4769927ec3f48911c1433980eb12945eb768619bb83fd4417e4344e7.json"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-core-29a/previous/ctkg_v3e-object-a0e00fe181b9ba65bda1824c.md"
asset_refs: []
---

## 首页
# 相平面法 | Phase-Plane Method

一句话定义：相平面法通过二维状态空间中的方向场、相轨迹和平衡点，分析不同初态下系统的运动形式与稳定行为。

- 完整二维相平面适用于二阶自治状态模型。
- 轨迹形状、时间方向与到达时间需要分别处理。
- 分段系统需核验各区域方程及边界连接。

---
## 详情
### 完整解释

对二阶方程 $\ddot x=f(x,\dot x)$，引入 $v=\dot x$ 后，在 $(x,v)$ 平面研究 $\dot x=v$、$\dot v=f(x,v)$。可先求平衡点，再画方向场或等倾线，结合初态描绘相轨迹，判断趋近、远离、转向和周期运动。

这种方法强调几何结构，未必需要先求显式时间解。但若任务要求到达时间、精确峰值时刻等，仍需额外计算。相平面图中一段较长曲线不必对应较长时间，因为各处状态变化速度可能不同。

### 教学计算/推理例

取 $\dot x=v$、$\dot v=-x-v$。平衡条件给出原点，线性矩阵特征值为 $-1/2\pm j\sqrt3/2$，所以原点是稳定焦点。初态 $(1,0)$ 的向量为 $(0,-1)$，轨迹先向下，再随位置和速度变化绕向原点。

利用 $V=(x^2+v^2)/2$，有 $\dot V=-v^2\le0$。这与阻尼造成的幅度衰减一致。不过仅写出半负定导数时，不能不加分析便把“非增加”直接等同于“所有非零轨迹严格收敛”。本例已有特征值核验；也可检查 $v=0$ 上除原点外并不保持不动，因为 $\dot v=-x$。

去掉阻尼后变为 $\dot v=-x$，同一个 $V$ 满足 $\dot V=0$，轨迹为连续闭合圆族。加入阻尼与去掉阻尼的相图有根本差别，不能因二者都可能看见振荡就给出相同长期结论。

### 适用条件与边界

对于一阶自治系统，常用相线而非完整二维状态图。高阶系统的二维投影可以辅助观察，但通常丢失其他状态，不能直接把二维自治唯一性和闭合轨道判断搬过去。含外部时间信号时，也需明确时间或激励相位的作用。

非光滑分段模型应明确切换规则。实奇点与虚奇点要按所在区域判断，不能把分区方程延拓得到的平衡都视为实际平衡。遇到状态重置或冲击，需要额外连接规则；普通连续状态的表达式切换不代表状态跳跃。

数值相图应注明初态、箭头、尺度及积分范围。有限时长看似闭合或趋近的轨迹只能作为证据之一，靠近慢模态或半稳定轨道时尤其需要谨慎解释。方法的图解便利性不能替代模型条件检查。

### 常见误区

1. 将二阶自治分析无条件推广到任意高阶二维投影。
2. 只见 $\dot V\le0$ 就省略收敛所需的进一步分析。
3. 只依据轨迹形状、不看方向，就判断稳定性。

### 自检

1. 本例为什么能确定原点为稳定焦点？
2. 去掉阻尼后，闭合圆族是否都成为稳定极限环？

**核对要点**：特征值实部为负且有非零虚部；无阻尼圆族不孤立，不满足极限环定义，也不具有向单一圆周的吸引。

### 关联节点

- **相轨迹**（出边，关系：有表示）
- **相平面**（出边，关系：包含组件）
- **非线性系统**（出边，关系：适用于）
