---
node_id: ctkg_m3-v2j_source-object_5b9db9f6bfeb1491df0d9414
authority_entity_id: "ctkg:m3-v2j:source-object:5b9db9f6bfeb1491df0d9414"
name: "定量反馈理论"
name_en: "Quantitative Feedback Theory"
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
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-30d0689770d6fd958157314be935cc04847533236cd8510f752d37f4d973805e.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-30d0689770d6fd958157314be935cc04847533236cd8510f752d37f4d973805e.json"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-professional-12a/supporting-source-inventory.json"
asset_refs: []
---

## 首页
# 定量反馈理论 | Quantitative Feedback Theory

一句话定义：定量反馈理论把不确定对象的频率响应与明确性能要求转化为回路设计约束，并据此进行反馈与参考通道设计。

- 不确定对象在每个频率形成一组响应模板。
- Nichols图使用相位与对数幅值表达约束。
- 有限模板采样不自动构成全范围证明。

---
## 详情
### 完整解释

定量反馈理论通常简称QFT。它从量化的不确定对象集合和性能容差出发，在选定频率构造对象响应模板，把闭环要求转化成对标称开环回路的界限，再进行回路整形。参考跟踪任务还可能配合前置滤波器，并需要重新验证完整闭环。

Nichols图的横轴为相位、纵轴为对数幅值。模板不是一条名义Bode曲线，而是同一频率下不同允许对象形成的响应集合。实际计算可以采样，但如果要给出连续不确定集合的保证，仍需核验模板覆盖与约束，而不能只把几个点画出来便认为全部对象已被穷尽。

### 教学计算/推理例

取对象族 $G(s)=k/(s+a)$，其中a和k为独立固定参数，均在[1,2]内。在角频率ω=1处，有

$$
|G(j)|=\frac{k}{\sqrt{a^2+1}},\qquad
\arg G(j)=-\arctan(1/a).
$$

a=1时相位为-45度，k从1变2使幅值从1/√2变成√2；a=2时相位约-26.565度，幅值从1/√5变成2/√5。它们是模板的四个参数角点，参数连续变化还会产生中间响应，不能把四点本身当成整个模板。

假定这一频率的灵敏度要求为 $|S(j)|\leq0.6$，其中 $S=1/(1+CG)$。试选常值控制器C=2，则

$$
|S(j)|=\sqrt{\frac{a^2+1}{(a+2k)^2+1}}.
$$

在给定正参数区间内，该量随k增加而减小，随a增加而增大。后一个方向可由平方比值的导数符号 $a(a+2k)-1>0$ 核验。因此最坏点为a=2、k=1，最坏幅值为√(5/17)，约0.54233，小于0.6，整族在这一频率满足要求。

### 模板、界限与候选验证

上述计算展示了由对象集合得到频率响应范围，再核验一条闭环性能约束的过程。一般QFT设计会在相关频率把这些要求转化为标称回路L0=C G0的允许位置，并通过控制器极零点及增益整形，使其满足所需界限。

取标称G0=1/(s+1)，本例C=2时的L0在ω=1具有约3.0103分贝幅值和-45度相位。这个名义点只有结合整族模板和要求才有意义；不能只因它看起来位置合适，就省略上面针对全参数集合的核验。

### 适用条件与边界

本例只具体演示一个频率约束，不构成任意频带或复杂对象的完整QFT设计。该一阶族的闭环极点为-(a+2k)，因此可另外证明整族稳定；对于一般对象，稳定性和其他频率性能仍需相应检查。

前置滤波可以改变参考通道，却不自动改变反馈稳定边界或消除扰动误差。控制器带宽、噪声放大和执行器限制也可能与性能界限形成取舍，应按任务明确处理，不能把模板方法理解为无代价地提升全部指标。

### 常见误区

1. 用名义频响点代替整族对象模板。
2. 只检查有限角点却不说明它们为何足够。
3. 单一频率通过就宣称全频带和所有时域性能通过。

### 自检

1. 本例在ω=1处的最坏灵敏度由哪组参数给出？
2. 为什么四个模板角点本身不能自动证明所有参数都合格？

**核对要点**：a=2、k=1，幅值√(5/17)；本例的全范围结论另外依赖已核验的参数单调性，一般模板没有这种默认保证。

### 关联节点

- **等M圆**（无向，关系：相关）
- **利用Nichols图确定闭环频率响应**（无向，关系：相关）
