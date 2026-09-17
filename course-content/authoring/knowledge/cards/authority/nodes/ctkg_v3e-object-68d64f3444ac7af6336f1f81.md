---
node_id: ctkg_v3e-object-68d64f3444ac7af6336f1f81
authority_entity_id: "ctkg:v3e-object-68d64f3444ac7af6336f1f81"
name: "PI控制器"
name_en: "PI Controller"
category: 概念性
knowledge_type: C
bloom_level: 应用
lesson_units:
  - "3-9"
card_version: 3
content_origin: act-course-enrichment
authority_release_id: ctr:release:control-theory-engineering-v0.48
authority_snapshot_id: snap-7f1549103098d6efcc8a3989a344c047af682df7d8b4bddd7a28101dee04e731
authority_snapshot_hash: 7f1549103098d6efcc8a3989a344c047af682df7d8b4bddd7a28101dee04e731
status: ready
source_docs:
  - course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-b244a523f691c83583a597a6ef6b3ea6feb3f77fcd4181f725ef23773bac074a.json
  - course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-b244a523f691c83583a597a6ef6b3ea6feb3f77fcd4181f725ef23773bac074a.json
  - git:f655dee490f714247dea867602a4d42bf699f2fd:course-content/authoring/knowledge/cards/nodes/PI控制器_6_29ebe858.md
  - course-content/authoring/lessons/3-9/design/3-9-handout.md
asset_refs: []
---

## 首页

# PI控制器 | PI Controller

**一句话定义**：将比例作用与积分作用相加，用两个参数调节误差响应的控制器。

**核心直觉**：比例立即响应当前误差，积分持续修正累积偏差，两者共同决定动态与稳态表现。

**关键公式**：
$$
C(s)=K_p+\frac{K_i}{s}=K_p\left(1+\frac1{T_i s}\right),\qquad K_i=\frac{K_p}{T_i}
$$

**学习目标**：区分两种参数形式，计算极零点，并检查精度收益与动态代价。

---

## 详情

### 完整解释

#### 两条作用如何合成

在零积分初值下，$u(t)=K_pe(t)+K_i\int_0^t e(\tau)\,\mathrm d\tau$。当 $K_p,K_i>0$ 时，控制器有一个原点极点和一个位于 $-K_i/K_p=-1/T_i$ 的零点。

固定 $K_p$ 时，减小 $T_i$ 会增大 $K_i$，加强积分作用。不能把“积分时间更小”理解为“积分作用更弱”。也不能把这里的比例参数 $K_p$ 与静态位置误差系数混为一谈。

#### 一个可完整验算的设计例

取教学对象 $G(s)=1/(s+1)$，单位负反馈。选 $K_p=2$、$K_i=1$，则 $T_i=2$ 秒，控制器零点为 $-0.5$。闭环为
$$
\Phi(s)=\frac{2s+1}{s^2+3s+1}.
$$
极点为 $(-3\pm\sqrt5)/2$，约 $-0.382$ 与 $-2.618$，均在左半平面。对单位阶跃参考，$E(s)=(s+1)/(s^2+3s+1)$，稳态误差为零。

对比仅用比例控制 $C=2$，其单位阶跃稳态误差为 $1/3$。PI 改善了静差，但也引入了一个较慢的极点。由于闭环分子含零点，不能直接套无零点二阶系统的超调公式。

#### 怎样理解图谱中的误差结论

图谱关联了“加入 PI 后由 I 型提高到 II 型、斜坡误差变为零”的陈述。这是一类特定系统的结论，不是每个 PI 系统都成为 II 型。本例原环路为 0 型，加入 PI 后是 I 型，单位斜坡误差仍为 $1/K_v=1$。

因此设计步骤应为：明确原型别与误差通道，确定精度目标，选择参数，再检查闭环极点、频率裕度和执行器约束。PI 的存在本身不是稳定或性能达标的证明。

#### 常见误区

- **积分保证一切输入零误差**：输入类别与最终型别仍然重要。
- **零点一定抵消对象极点**：零点位置由参数决定，精确消去还可能对模型误差敏感。

#### 自检

1. $K_p=2$、$T_i=4$ 秒时，$K_i$ 与零点分别是多少？
2. 本例单位阶跃零误差，是否意味着单位斜坡也零误差？

**核对要点**：$K_i=0.5$、零点 $-0.25$；不意味着，例子仍为 I 型。

### 关联节点

- **图谱公式**：比例项与误差积分项相加的控制规律。
- **图谱关联**：比例-积分控制规律、PI 对稳态性能的改善。
- **学习延伸**：积分控制器、系统型别、稳态误差、相角裕度。
