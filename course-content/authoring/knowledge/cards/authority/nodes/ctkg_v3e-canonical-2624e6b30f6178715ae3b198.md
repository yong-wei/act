---
node_id: ctkg_v3e-canonical-2624e6b30f6178715ae3b198
authority_entity_id: "ctkg:v3e-canonical-2624e6b30f6178715ae3b198"
name: "比例-积分控制器"
name_en: "Proportional-integral Controller"
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
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-c2ced6b23a3945f2706397db10ed5823f120daee202a1814523d5a0073d76362.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-c2ced6b23a3945f2706397db10ed5823f120daee202a1814523d5a0073d76362.json"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-core-19a/previous/ctkg_v3e-canonical-2624e6b30f6178715ae3b198.md"
asset_refs: []
---

## 首页

# 比例-积分控制器 | Proportional-integral Controller

**一句话定义**：PI控制器把当前误差的比例作用与误差历史的积分作用相加，用积分状态维持所需的持续控制量。

$$u(t)=K_pe(t)+K_iz(t),\qquad\dot z(t)=e(t).$$

误差瞬时为零，并不意味着积分状态或控制输出也为零。

---

## 详情

### 完整解释

比例项响应当前误差，积分项则由过去误差累积形成。两者通过同一个控制输出作用于对象，但具有不同的状态性质。积分状态需要初值；没有说明初值，就不能仅凭当前误差确定控制量。

理想零状态传递形式为 $C(s)=K_p+K_i/s$。当 $K_p\ne0$时，也可写成 $K_p(1+1/(T_is))$，其中 $T_i=K_p/K_i$。这两种参数记法必须连同结构一起使用，不能把 $K_i$和 $T_i$当作同一个数。

积分有助于在适当稳定闭环下消除某些持续误差，但它也增加动态状态，可能改变阻尼和控制作用。不能不检查对象、稳定性和实现约束，就宣称加上积分会改善全部性能。积分输出是否受到限幅等处理，也会影响实际行为。

### 教学计算/推理例

取对象 $G(s)=1/(s+1)$，负单位反馈、零初态单位阶跃，选择 $K_p=2,K_i=1$。完整状态方程为

$$\dot y=-y+u,\qquad\dot z=1-y,\qquad u=2(1-y)+z.$$

闭环传递函数为

$$T(s)=\frac{2s+1}{s^2+3s+1}.$$

分母两个根均在左半平面，单位阶跃终值为1。在平衡处误差为零，积分状态却为 $z=1$，所以控制量 $u=1$仍能抵消对象方程中的输出衰减项。若误以为误差零就把积分状态清空，会改变这个平衡。

零初始状态下，比例项使控制量最初为2；随着响应变化，控制量最终趋于1。该例2%调节时间约6.875200 s。另一组 $K_p=1,K_i=1$的调节时间反而约3.912023 s，说明增大比例项不保证与积分配合后的全部指标更优。

### 适用条件与边界

终值结论建立在该闭环稳定、输入及模型符合所列条件的基础上。对于不同参考输入、扰动位置或非线性对象，不能只凭控制器有积分项就直接宣称误差为零。应从相应误差传递关系和稳定条件推导。

实际执行器饱和时，误差可能继续累积而控制输出不能按理想值实现，因此需要按具体实现考虑积分状态处理。这里没有把任何未说明的限幅机制并入理想模型；如果实现中采用这些机制，应重新核验行为。

非零初始积分状态会改变初始控制量和过渡过程。报告或复现实验时应将它与对象初态一起记录，不能在不同候选之间使用不同积分初值而仍称为同条件比较。

### 常见误区

1. 误区：误差为零时PI输出必为零。纠正：积分状态可以保持非零，本例平衡控制量为1。
2. 误区：只要加入积分，稳定性和全部动态指标都会改善。纠正：积分改变闭环阶次和模态，必须检查具体对象与参数。

### 自检

1. 本例稳态时为什么 $z=1$而不是0？
2. $K_p=2,K_i=1$对应的积分时间是多少？

**核对要点**：对象需要持续控制量1维持输出1，比例误差项此时为零，因此由积分状态提供。所列形式下 $T_i=K_p/K_i=2$，不等于积分增益1。

### 关联节点

- **比例积分控制器**（无向，关系：相关）
- **比例-积分控制规律**（无向，关系：相关）
