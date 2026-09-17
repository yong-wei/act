---
node_id: ctkg_domainconcept_481adaa12fcb7e31a3b67683
authority_entity_id: "ctkg:domainconcept:481adaa12fcb7e31a3b67683"
name: "跟踪误差"
name_en: "Tracking Error"
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
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-c99c6f9778c3e424b05534473954e9fc396603122faab96ebbc28ace86415c84.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-c99c6f9778c3e424b05534473954e9fc396603122faab96ebbc28ace86415c84.json"
asset_refs: []
---

## 首页
# 跟踪误差 | Tracking Error

一句话定义：跟踪误差是参考输入与所要求跟踪的物理输出之差：$e_t(t)=r(t)-y(t)$。

- 先统一参考与输出的物理意义、单位和比例。
- 含测量噪声时，真实跟踪误差不等于比较器误差。
- 跟踪质量包含瞬态与稳态，不能只看最终值。

---
## 详情
### 完整解释

跟踪误差回答“实际输出离要求的运动或数值还有多远”。单位反馈且无测量误差时，比较器直接计算 $r-y$。若测量读数为 $y+n$，比较器得到的则是 $e_c=r-y-n$，所以 $e_t=e_c+n$。控制器可能把比较器误差降到零，却无法仅凭这个带偏差的读数判断物理输出是否准确。

对线性单位负反馈系统，设 $u=C(r-y-n)$、$y=P(u+d_i)+d_o$。其中 $d_i$ 在对象输入端加入，$d_o$ 在输出端加入。零初态下有

$$
E_t=SR-PS D_i-SD_o+TN,
\qquad S=\frac1{1+PC},\quad T=\frac{PC}{1+PC}.
$$

不同输入通过不同通道形成同一个真实误差。负号来自正向扰动使输出增大，而误差定义为参考减输出；比较误差大小时可以取幅值，推导信号方向时仍需保留符号。

### 教学计算/推理例

取 $P=1/(s+1)$、$C=2$，无扰动、无噪声，单位阶跃参考下

$$
y(t)=\frac23(1-e^{-3t}),\qquad
 e_t(t)=\frac13+\frac23e^{-3t}.
$$

系统稳定，但最终只能达到参考的 $2/3$，稳态误差为 $1/3$。误差初值为1，随后衰减到非零常数；“稳定”与“零误差”是两个不同判断。

再将控制器改为 $C=1+1/s$，保持同一对象，令 $r=0$、测量偏置 $n=1$。零初态解为 $y=-1+e^{-t}$，故 $e_t=1-e^{-t}$，而 $e_c=-e^{-t}$。比较器误差最终为0，真实误差却为1。积分作用消除了比较器的常值偏差，并没有识别传感器偏置。

### 适用条件与边界

非单位反馈下，应把传感器比例和参考标定纳入定义，不能把不同单位的信号直接相减。上述传递关系只描述线性模型的零状态响应；非零初态会额外产生响应。使用终值定理计算稳态误差前，应验证相应收敛条件；斜坡误差可能无界，不能总期待一个有限终值。

### 常见误区

1. 认为误差信号接近零就等于实际输出准确。应确认观察到的是 $e_t$ 还是 $e_c$。
2. 用稳态误差一个数完整评价跟踪。超调、滞后和过程偏差也会影响跟踪质量。
3. 把所有扰动统一乘以 $S$。对象输入扰动还经过 $P$。

### 自检

1. 已知比较器误差为0、测量偏置为0.2，真实跟踪误差是多少？
2. 单位阶跃参考下，本例比例控制是否既稳定又无静差？

**核对要点**：按上述标定 $e_t=e_c+n=0.2$；比例控制的闭环极点为 $-3$，稳定，但稳态误差为 $1/3$。

### 关联节点

- **前馈跟踪**（无向，关系：相关）
- **扰动信号**（无向，关系：相关）
- **渐近跟踪**（入边，关系：适用于）
