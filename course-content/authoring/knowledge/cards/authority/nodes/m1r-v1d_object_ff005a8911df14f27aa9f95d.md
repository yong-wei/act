---
node_id: m1r-v1d_object_ff005a8911df14f27aa9f95d
authority_entity_id: "m1r-v1d:object:ff005a8911df14f27aa9f95d"
name: "鲁棒无静差响应的设计方法"
name_en: "Robust Zero-Steady-State-Error Design"
category: 概念性
knowledge_type: C
bloom_level: 应用
card_version: 3
consevent_origin: act-course-enrichment
authority_release_id: "ctr:release:control-theory-engineering-v0.48"
authority_snapshot_id: "snap-7f1549103098d6efcc8a3989a344c047af682df7d8b4bddd7a28101dee04e731"
authority_snapshot_hash: "7f1549103098d6efcc8a3989a344c047af682df7d8b4bddd7a28101dee04e731"
status: ready
source_docs:
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-83056b2bf8c211105621f7ab93a94fd02cc7e3607120dc72752e775a7aa776c6.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-83056b2bf8c211105621f7ab93a94fd02cc7e3607120dc72752e775a7aa776c6.json"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-professional-12a/supporting-source-inventory.json"
asset_refs: []
---

## 首页
# 鲁棒无静差响应的设计方法 | Robust Zero-Steady-State-Error Design

一句话定义：鲁棒无静差设计在明确的对象变化与输入类别下，通过适当内部模型和稳定闭环，使稳态跟踪或调节误差保持为零。

- 积分作用必须配合全族闭环稳定。
- 参考、扰动与测量偏置需要分别分析。
- 无静差保证依赖可实现的稳态输入。

---
## 详情
### 完整解释

对于恒定参考或恒定扰动，积分作用可以在稳定闭环中保留所需控制贡献，而不要求持续存在非零误差。但“加入积分”不是完整证明：还要确认所有允许对象的闭环稳定、被要求的平衡状态可达，以及执行器能够提供相应输入。

本卡用不确定的一阶对象和PI控制器说明这一方法。它只对明确的固定参数范围、理想线性执行器及指定常值输入给出结论，不把无静差扩展为任意输入和所有非理想条件下的保证。

### 教学计算/推理例

取 $G(s)=k/(s+a)$，a和k为独立未知固定参数，分别位于[0.8,1.2]和[0.5,1.5]。单位负反馈控制器取 $C(s)=2+1/s$，误差为r-y，执行器不饱和。

闭环特征多项式为

$$
D(s)=s^2+(a+2k)s+k.
$$

对整个允许集合，a+2k与k都严格为正，因此这个二阶首一多项式的全部根都在左半平面，闭环稳定。对象状态与积分器状态的完整矩阵也具有这个特征多项式，没有只看简化输出传函而遗漏积分器内部模态。

零初态单位阶跃参考的误差变换为 $E(s)=(s+a)/D(s)$。由于相关极点稳定，终值定理给出 $e_\infty=\lim_{s\to0}sE(s)=0$，且这个结论对全部允许a、k成立。它不依赖把控制器按某一标称增益精确校准。

### 常值对象输入扰动

若常值扰动d0加在对象输入端，即对象接收u+d0，在参考保持不变时，其引起的输出分量为 $Y_d(s)=kd_0/D(s)$。相应终值同样为零，所以稳定PI闭环能在该模型内消除这个常值输入扰动带来的最终输出偏移。

这个通道与测量偏置不同。若传感器持续多读一个常数b，积分器可能使测得输出y+b趋近参考，从而实际输出趋近r-b；不能把对象输入扰动的零偏移结论搬到测量偏置上。

### 稳态控制量与约束

单位参考最终要求x=1，由对象平衡方程得到 $u_\infty=a/k-d_0$。没有扰动时，允许参数a=1.2、k=0.5需要稳态输入2.4。若实际执行器上限只有1，这个平衡就无法实现，原无饱和证明不能继续保证零误差。

即使稳态输入在允许范围内，还需要检查瞬态峰值与积分状态是否受限。抗积分饱和措施可以改善受限运行，但应明确其更新规则并重新分析，不能把输出截幅本身当成无静差保证的一部分。

### 适用条件与边界

这里的PI只包含一个积分器，针对的是常值参考和常值扰动。斜坡、周期输入、延迟或模型阶次变化可能需要不同的内部模型和稳定性分析，不能只凭“误差最终为零”的一个阶跃例子推广到全部任务。

固定未知参数与任意时变参数也不同。本例用正系数二阶判据证明每个允许的定常闭环稳定，没有因此声称覆盖任意切换和变化速度。保证始终应与不确定集合、输入通道和实现条件一起说明。

### 常见误区

1. 加入积分就省略闭环稳定性检查。
2. 把输入扰动抑制结论用于测量偏置。
3. 平衡输入超出执行器上限时仍承诺零误差。

### 自检

1. 本例PI为何能对整个参数族保证常值参考的零稳态误差？
2. a=1.2、k=0.5且无扰动时，为何输入上限1不够？

**核对要点**：全族二阶闭环稳定，误差传递关系保留积分内部模型的零终值条件；所需稳态输入为2.4，超过上限。

### 关联节点

本卡的结论可由上述定义与计算例独立复核。
