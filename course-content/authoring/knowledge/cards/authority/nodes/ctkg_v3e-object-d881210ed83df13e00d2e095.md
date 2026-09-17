---
node_id: ctkg_v3e-object-d881210ed83df13e00d2e095
authority_entity_id: "ctkg:v3e-object-d881210ed83df13e00d2e095"
name: "死区特性"
name_en: "Dead-Zone Characteristic"
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
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-b1b0859bd95f3e62633ae3cb270b2fd032ef31b4d6f9adc93f4fe0f4decc84df.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-b1b0859bd95f3e62633ae3cb270b2fd032ef31b4d6f9adc93f4fe0f4decc84df.json"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-core-27a/previous/ctkg_v3e-object-d881210ed83df13e00d2e095.md"
asset_refs: []
---

## 首页
# 死区特性 | Dead-Zone Characteristic

一句话定义：死区特性用一个有限的无响应输入区间及区外响应规律，描述小输入无法产生输出的非线性关系。

- 完整模型同时包含区间、区外增益及边界规则。
- 连续死区模型的区外直线带有阈值偏移。
- 若同时存在饱和，应把两种限制分别表达。

---
## 详情
### 完整解释

采用对称连续死区 $D(u)$：半宽 $d$，区外斜率 $k$。区内 $|u|\le d$ 时输出0，区外为 $k[u-d\operatorname{sgn}(u)]$。这既表达小输入无响应，又保证跨越阈值时输出从0连续变化。

此处死区是无记忆的，输出由当前输入唯一确定。它不是迟滞的带内保持，也不等同于机械间隙的接触分支。若器件具有这些额外行为，需要增加状态和历史规则，不能仅用一个死区宽度代替。

### 教学计算/推理例

取 $d=0.5$、$k=2$。输入0.4、0.6、1依次产生0、0.2、1。对正输出目标 $y^*=0.2$，区外关系要求输入为 $u=d+y^*/k=0.6$，而不是简单的 $y^*/k=0.1$。后者仍落在死区内，实际输出为0。

这个代数计算可以帮助理解死区补偿，但它只是静态关系的逆分支。输出目标为0时，所有 $u\in[-0.5,0.5]$ 都满足，逆并不唯一；未知阈值、噪声或动态限制会影响实际补偿。不能把一个静态逆公式直接当成完整闭环性能保证。

若再叠加输出饱和上限1，可定义 $y=\operatorname{clip}(D(u),-1,1)$。此时输入0.6仍输出0.2，输入1输出1，输入2也只输出1。死区决定小输入段不响应，饱和决定大输入段受限，中间才是斜率2的线性段。两种非线性作用在不同区域，不能省略其一。

### 适用条件与边界

死区可造成小信号控制作用不足，但闭环是否留下静差、发生振荡或通过积分跨越阈值，取决于控制器和对象。仅凭元件曲线不能指定最终误差。所谓补偿若会产生输入跳变，还应考虑执行器幅值和速率约束。

参数应注明输入输出单位。非对称死区可能有不同的正负阈值和斜率；若使用对称模型近似，应说明适用范围。采用描述函数等方法时，等效关系可能随输入振幅变化；精确输出还可能包含高次谐波，不能把近似结果说成普通常数增益。

### 常见误区

1. 只给出死区宽度，遗漏区外斜率和偏移。
2. 求逆时忽略死区偏移，得到仍落在无响应区的输入。
3. 把死区与饱和合并成一个含糊的“限幅”，不区分小输入和大输入行为。

### 自检

1. 本例想得到输出0.2，为什么输入0.1不够？
2. 加上输出饱和后，输入2是否还能得到无饱和死区模型的输出3？

**核对要点**：0.1位于死区，必须先跨越0.5阈值，所需输入0.6；叠加饱和后输出被限制为1。

### 关联节点

- **死区**（无向，关系：相关）
- **开关线**（无向，关系：相关）
- **等效增益**（无向，关系：相关）
