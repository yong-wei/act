---
node_id: ctkg_v3e-object-e281edb0bf991d873b515ce3
authority_entity_id: "ctkg:v3e-object-e281edb0bf991d873b515ce3"
name: "虚奇点"
name_en: "Virtual Regional Singular Point"
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
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-fbc7c37d0ef288982128d047a9d5151761205265d82eb4c57123dd3f936d6e2e.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-fbc7c37d0ef288982128d047a9d5151761205265d82eb4c57123dd3f936d6e2e.json"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-core-29a/previous/ctkg_v3e-object-e281edb0bf991d873b515ce3.md"
asset_refs: []
---

## 首页
# 虚奇点 | Virtual Regional Singular Point

一句话定义：分区线性方程延拓得到的平衡点若落在该方程有效区域之外，称为虚奇点，不能直接作为完整系统的实际平衡。

- “虚”指不属于该有效区域，不指虚数坐标。
- 延拓平衡可辅助理解局部轨迹形状。
- 到达区域边界后应切换到真实适用的方程。

---
## 详情
### 完整解释

分段系统在每个区域内可能表现为线性或仿射方程。为了绘制轨迹，有时先把该方程延拓到整个平面，求出其平衡点及轨迹族。如果这个平衡不在原区域内，它只是延拓分析的参考中心或参考点，不是该分支能够直接实现的平衡状态。

虚奇点仍可具有普通实坐标，也可对应具有实数或复数特征值的延拓矩阵。因此不能按“坐标是虚数”或“特征值是虚数”解释名称。正确判断只需同时核验平衡方程与分区条件。

### 教学计算/推理例

设 $\dot x=v$，$\dot v=-v-x+0.5\operatorname{clip}(x,-1,1)$。在 $x>1$ 区域，方程是 $\dot v=-v-x+0.5$。令 $v=0$、加速度为0，得到延拓平衡 $(0.5,0)$，但它不满足 $x>1$，所以是该区域的虚奇点。

在 $x<-1$ 区域，方程为 $\dot v=-v-x-0.5$，延拓平衡为 $(-0.5,0)$，同样不属于对应区域，也为虚奇点。实际内区方程是 $\dot v=-v-0.5x$，因此在两个延拓点处，加速度分别为 $-0.25$ 与0.25，均非零。完整系统真正的平衡只有原点。

虚奇点可以帮助画出某个区域内的延拓轨迹片段，但一旦轨迹越过 $x=1$ 或 $x=-1$，就必须使用新区域方程。不能继续沿外区延拓曲线走向位于内区的虚奇点，再宣布系统停在那里。

### 适用条件与边界

这套术语用于分区线性相平面分析。它不意味着实际系统存在一个“看不见的平衡”，也不直接给出不稳定性。稳定性应由实际可达区域内的向量场和完整连接规则判断。

若平衡位于边界上，应检查区域定义是否包含等号以及边界向量场规则。连续分段模型的两侧向量可能一致，不连续模型则还需明确切换或滑动等解概念。不能因为外区延拓平衡存在，就省略这些边界条件。

同一个几何点可能对一个区域是虚奇点，而在另一个区域的实际方程中并非平衡；也可能在参数变化后进入有效区域并改变分类。计算必须跟随当前参数与分区，不可仅记住某个点的固定标签。

### 常见误区

1. 将虚奇点理解为坐标或特征值必须是虚数。
2. 把外区延拓平衡直接加入完整系统平衡点清单。
3. 轨迹进入新区域后仍使用旧分支，误判最终停留位置。

### 自检

1. 本例 $(0.5,0)$ 是否为完整系统的平衡，为什么？
2. 由正外区进入内区后，可以继续用 $-v-x+0.5$ 吗？

**核对要点**：不是，实际内区加速度为 $-0.25$；进入内区应改用 $-v-0.5x$，延拓方程不再有效。

### 关联节点

- **奇点**（入边，关系：前置于）
- **奇点**（出边，关系：属于）
