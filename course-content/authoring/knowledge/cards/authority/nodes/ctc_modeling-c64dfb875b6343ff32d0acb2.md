---
node_id: ctc_modeling-c64dfb875b6343ff32d0acb2
authority_entity_id: "ctc:modeling-c64dfb875b6343ff32d0acb2"
name: "库仑干摩擦模型"
name_en: "Coulomb Dry-Friction Model"
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
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-690eb6f4ccae6395c924b2452b56abe018602efa0f5ebc968348154a846fd19c.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-690eb6f4ccae6395c924b2452b56abe018602efa0f5ebc968348154a846fd19c.json"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-core-27a/previous/ctc_modeling-c64dfb875b6343ff32d0acb2.md"
asset_refs: []
---

## 首页
# 库仑干摩擦模型 | Coulomb Dry-Friction Model

一句话定义：库仑干摩擦模型用近似恒定的滑动摩擦力描述干接触阻力，方向与相对滑动速度相反，零速度处需另给静止规则。

- 滑动摩擦随速度改变符号，通常不与速度成正比。
- 静止时不能仅靠 $\operatorname{sgn}(0)=0$ 描述粘着。
- 滑动解在首次停止后必须重新判断运动状态。

---
## 详情
### 完整解释

令 $v$ 表示物体相对接触面的滑动速度，$F_f$ 表示作用在物体上的摩擦力，$F_c>0$ 为滑动摩擦大小。最简单的滑动定律为

$$
F_f=-F_c\operatorname{sgn}(v),\qquad v\ne0.
$$

因此 $v>0$ 时摩擦为负，$v<0$ 时摩擦为正。功率为 $F_fv=-F_c|v|\le0$，说明在该相对运动方向上耗散能量。这个符号关系是检查模型是否把摩擦误写成推进力的直接方法。

在 $v=0$ 时，物体可能保持静止。若静摩擦上限为 $F_s$，静摩擦可在 $[-F_s,F_s]$ 内取值以平衡其他切向力；超过该能力后才进入滑动。滑动定律本身没有完整规定这一过程，把符号函数在零处设为0只是一个数值约定，不能代替静摩擦平衡条件。

### 教学计算/推理例

物体质量 $m=2$ kg，初速度 $v_0=2$ m/s，滑动摩擦大小 $F_c=3$ N，没有其他切向力。正向滑动期间

$$
\dot v=-\frac32,\qquad v(t)=2-1.5t.
$$

首次停止时间为 $t_s=4/3$ s，停止距离为 $m v_0^2/(2F_c)=4/3$ m。到达停止时刻后，外力为零，可以保持静止；不能继续把直线速度公式延长到负值，制造没有外力驱动的反向运动。

再考虑静摩擦上限4 N、滑动摩擦仍为3 N。物体静止时若施加2 N正向外力，摩擦取 $-2$ N，合力为0，物体可保持静止。若施加5 N，已超过静摩擦上限，开始正向滑动后摩擦为 $-3$ N，初始加速度为 $(5-3)/2=1$ m/s²。恰好等于静摩擦上限时，应声明保持或触发滑动的具体模型约定。

### 适用条件与边界

库仑模型忽略了速度依赖、温度、润滑、接触变形及微观滑移等因素。实际摩擦可随速度变化，静摩擦与滑动摩擦大小也未必相同。模型参数应与接触方向、法向载荷和实验条件匹配。

离散计算经过零速度时容易出现符号来回切换。正确处理需要识别停止与粘着状态，而不是仅用更小步长掩盖不完整的零速度规则。本卡的分段解析例只用于说明模型，未规定通用数值求解器。

### 常见误区

1. 在所有速度下都取固定负摩擦，导致反向滑动时摩擦反而助推。
2. 用 $\operatorname{sgn}(0)=0$ 宣称模型已包含静摩擦。
3. 将停止前解析解继续延长，得到无外力的周期性反向运动。

### 自检

1. 速度为负时，作用在物体上的库仑摩擦方向是什么？
2. 本例停止后没有外力，速度应继续变负还是保持零？

**核对要点**：摩擦为正，与负向滑动相反；达到首次停止后重新判断静止条件，本例保持零速度。

### 关联节点

本卡的结论可由上述定义与计算例独立复核。
