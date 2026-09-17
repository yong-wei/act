---
node_id: ctkg_v3e-canonical-df3167f36376f526f6ec5562
authority_entity_id: "ctkg:v3e-canonical-df3167f36376f526f6ec5562"
name: "超调量"
name_en: "Overshoot"
category: 概念性
knowledge_type: C
bloom_level: 应用
card_version: 3
content_origin: act-course-enrichment
authority_release_id: ctr:release:control-theory-engineering-v0.48
authority_snapshot_id: snap-7f1549103098d6efcc8a3989a344c047af682df7d8b4bddd7a28101dee04e731
authority_snapshot_hash: 7f1549103098d6efcc8a3989a344c047af682df7d8b4bddd7a28101dee04e731
status: ready
source_docs:
  - course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-4a13758c25b5facc89f9f6da1b25d8b64d3a53091f1b20c2cc28ac1acf0b5f87.json
  - course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-4a13758c25b5facc89f9f6da1b25d8b64d3a53091f1b20c2cc28ac1acf0b5f87.json
  - git:f655dee490f714247dea867602a4d42bf699f2fd:course-content/authoring/knowledge/cards/nodes/超调量_3_fc3f5b17.md
asset_refs: []
---

## 首页

# 超调量 | Overshoot

**一句话定义**：正向阶跃响应超过最终稳态值的最大幅度，相对于所定义变化幅度的百分比。

**核心直觉**：先确定基线、终值与峰值，再计算超出目标的比例。

**关键公式**：
$$
M_p=\frac{y_{\max}-y_\infty}{y_\infty-y_0}\,100\%.
$$

**学习目标**：从响应数据计算超调，区分数值、百分比和标准二阶近似。

---

## 详情

### 完整解释

#### 定义必须带参考尺度

本卡公式用于正向阶跃、$y_\infty>y_0$ 且终值存在的情形。常见零初值实验中 $y_0=0$，分母就是终值。若带偏置的过程从 $10$ 变为 $12$，则有意义的变化幅度是 $2$，不能直接把 $12$ 当作归一化尺度。

例如该过程最大输出为 $12.3$，超出终值 $0.3$，按变化幅度定义的超调为 $15\%$。负向阶跃应对应检查向下越过终值的极值，并清楚说明符号和分母。若没有稳态值，便不能套用这种稳态参考定义。

#### 标准二阶模型的公式

对无零点、单位直流增益、零初始状态的欠阻尼二阶模型，单位阶跃的百分比超调为
$$
M_p=100e^{-\pi\zeta/\sqrt{1-\zeta^2}}\%,\qquad 0<\zeta<1.
$$
取 $\zeta=0.5$ 得约 $16.30\%$。这里指数项本身是比例 $0.1630$，写成百分比时才是 $16.30\%$。若看到图谱公式没有前面的 $100$，应先检查它是否采用比例记法。

改变 $\omega_n$ 而保持模型结构和 $\zeta$，该公式的超调比例不变，但峰值时刻会变化。增加有限零点、初始状态或高阶动态后，需要重新计算响应。

#### 从数据测量时注意什么

测量区间要足够长，以确认终值及最大峰值；采样过稀可能漏掉峰顶。传感器噪声也可能形成假峰，滤波和数据处理方法必须说明。不能只截取“看起来已经稳定”的一小段曲线来宣布满足超调约束。

设计时还应同时检查调节时间、稳态误差和控制量。某方案降低了超调，却可能明显延长过渡过程；这不是单一指标能够裁决的。

#### 自检

1. 输出从 $0$ 达到终值 $2$，峰值为 $2.4$，超调是多少？
2. 输出从 $10$ 达到 $12$、峰值 $12.3$，为什么不是 $2.5\%$？

**核对要点**：$20\%$；本卡按变化幅度 $2$ 归一化，而不是按带偏置的终值 $12$。

### 关联节点

- **图谱关联**：动态性能指标、时域法校正、阻尼比与超调公式、速度与超调的取舍。
- **学习延伸**：一阶与二阶系统提供对照，根轨迹连接参数选择，稳态误差评价最终精度。
