---
node_id: ctkg_v3e-object-570b74ec5294ac993add9b5f
authority_entity_id: "ctkg:v3e-object-570b74ec5294ac993add9b5f"
name: "临界稳定系统"
name_en: "Marginally Stable System"
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
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-f49e42d396b8061dc275bb2d3b6045a3227dfc942383e5e6a8cef2b9efe79fe8.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-f49e42d396b8061dc275bb2d3b6045a3227dfc942383e5e6a8cef2b9efe79fe8.json"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-core-15a/previous/ctkg_v3e-object-570b74ec5294ac993add9b5f.md"
asset_refs: []
---

## 首页

# 临界稳定系统 | Marginally Stable System

**一句话定义**：在本卡的零输入运动语境中，临界稳定系统可保持有界自由运动，但其边界模态不衰减到零。

这不意味着它对所有有界输入都稳定；共振输入可以使输出无界增长。

---

## 详情

### 完整解释

连续时间线性系统若具有虚轴模态、其余模态衰减，可能表现为持续振荡或常值自由运动。工程课程常将这种边界情形称为临界稳定。这里要同时说明两点：它不满足渐近衰减要求，而在适当的特征结构下，足够小初始扰动引起的自由运动仍可保持较小。

不能只说“有虚轴根”就结束判断。虚轴特征值若对应非平凡Jordan块，解可能带有随时间增长的多项式因子，此时连零输入运动也可能不稳定。对于常见的最小单输入输出模型，简单虚轴极点加上严格左半平面其他极点，是易于识别的边界形式。

此外，输入会不断向系统注入作用。没有衰减的模态在同频激励下可能积累越来越大的响应，所以零输入下有界不保证BIBO稳定。两种稳定性看的是不同问题，不能用“临界”一词把它们含糊地合并。

### 教学计算/推理例

取无阻尼振子

$$\ddot y+y=u.$$

令输入为零、初态 $y(0)=1,\dot y(0)=0$，自由响应为 $y(t)=\cos t$。它保持有界，但不趋于零。将初态缩小，整条自由响应也按比例缩小，体现了该零输入运动的稳定性，而不是渐近稳定性。

若改为零初态单位阶跃，输出为 $1-\cos t$，仍然有界且持续振荡。只看这个阶跃例，很容易误判它满足全部有界输入要求。

现在仍用零初态，输入改为有界正弦 $u(t)=\sin t$。从原方程求得

$$y(t)=\frac{\sin t-t\cos t}{2}.$$

其中时间乘正弦项使幅值增长。特别在 $t=2n\pi$ 时，输出为 $-n\pi$，随着整数 $n$ 增大无界。一个有界输入就足以否定BIBO稳定，尽管前面的阶跃和自由响应都保持有界。

### 适用条件与边界

本例特征根为 $\pm j$，没有阻尼；它是理想线性模型，不代表实际设备一定可以永久无损振荡。微小阻尼、反馈参数变化或非线性都可能改变后续行为。若在临界参数附近设计，应检查模型误差，而不能依靠理想边界获得可靠衰减。

持续振荡也不自动等于非线性极限环。线性无阻尼自由振荡的幅度由初态决定，同频外力还可不断增加幅度；非线性极限环具有不同的定义和存在条件。观察到几次周期运动，不能跳过模型分析而直接命名为极限环。

在比较教材中的“稳定”“临界稳定”“不稳定”时，先确定它说的是内部自由运动、渐近稳定还是输入输出稳定。对本振子，可以同时说它的零输入原点为Lyapunov稳定、不是渐近稳定，并且不满足BIBO稳定。这些结论并不矛盾。

### 常见误区

1. 误区：阶跃响应有界说明临界系统也BIBO稳定。纠正：同频正弦是有界输入，却可引起共振无界增长。
2. 误区：任何虚轴特征值都保证自由响应有界。纠正：还要检查Jordan结构，缺陷模态可能带时间增长因子。

### 自检

1. 本例为什么可以零输入稳定，却不满足BIBO稳定？
2. 在哪些时刻，可以直接看出正弦强迫响应无界？

**核对要点**：零输入只考察初态运动，BIBO还要求承受所有有界外部输入。在 $t=2n\pi$ 时输出为 $-n\pi$，明确展示了无界序列。

### 关联节点

- **稳定系统**（出边，关系：属于）
- **不稳定系统**（无向，关系：相关）
- **虚轴临界稳定状态**（无向，关系：相关）
