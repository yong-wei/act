---
node_id: ctkg_m3-v2l_canonical-object_94708a97f7508321feb998ea
authority_entity_id: "ctkg:m3-v2l:canonical-object:94708a97f7508321feb998ea"
name: "ITAE性能指标"
name_en: "Integral of Time-weighted Absolute Error"
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
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-c50009ca36725eafe12fe8d4f09699b29dc85f43fa8d237455a18a19ab033f42.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-c50009ca36725eafe12fe8d4f09699b29dc85f43fa8d237455a18a19ab033f42.json"
asset_refs: []
---

## 首页

# ITAE性能指标 | Integral of Time-weighted Absolute Error

**一句话定义**：ITAE对误差绝对值按发生时间加权积分，用来衡量持续到较晚时刻的误差代价。

$$J_{\mathrm{ITAE}}=\int_0^\infty t\,|e(t)|\,dt.$$

同样大小、同样持续时间的误差，出现得越晚，所占代价越大。

---

## 详情

### 完整解释

使用ITAE前先确定误差是什么，例如参考输入与被控输出之差，并固定开始计时的事件。绝对值使正负偏差都累加，不允许一段超调抵消另一段欠调；时间权重使后期残留偏差比同样大小的早期偏差受到更大惩罚。这一指标适合用作设计比较的一个定量标准，但它不是超调量、调节时间或执行器负担的别名。

比较控制方案时必须保持相同输入、相同误差单位、相同起点和相同积分区间。电压误差与温度误差的原始积分不能直接排序；同一系统换了输入幅度也会改变指标。若误差具有某个物理单位，乘时间再积分后的ITAE单位就是该误差单位乘时间平方。需要无量纲比较时，应明确所采用的幅值与时间归一化。

无限时域定义还要求积分收敛。仅有“系统稳定”这句话不够：稳定系统跟踪某输入时可能仍有恒定非零误差，此时时间加权积分发散。有限试验得到的积分只能报告为规定窗口内的指标，不能自动解释成无限时域结果。对于持续扰动或测量噪声，也应明确采用有限窗口、统计平均或其他合适的性能准则。

### 教学计算/推理例

取归一化一阶闭环模型 $T\dot y+y=u$，零初始状态，参考输入从0跃为1，并定义 $e=1-y$。由原方程得到

$$y(t)=1-e^{-t/T},\qquad e(t)=e^{-t/T}.$$

这里误差始终非负，才能在这个特定例子中将绝对值直接去掉。令 $x=t/T$，得到

$$J_{\mathrm{ITAE}}=T^2\int_0^\infty x e^{-x}\,dx=T^2.$$

最后一步可用分部积分验证：边界项 $-xe^{-x}$ 在零和无穷处都为零，剩余指数积分等于1。因而 $T=2\,\mathrm{s}$ 时，单位归一化误差的ITAE为 $4\,\mathrm{s^2}$；同样输入下 $T=1\,\mathrm{s}$ 时为 $1\,\mathrm{s^2}$。这说明在这一模型族中，误差更快衰减能明显降低时间加权代价。

若只记录到时刻 $H$，则

$$J_H=T^2\left[1-\left(1+\frac{H}{T}\right)e^{-H/T}\right].$$

剩余尾部严格为正，有限记录不能不加说明地代替完整积分。对于会改变符号的误差，必须在积分中保留绝对值，或按实际过零点分段，而不能继续套用这一单指数答案。

### 适用条件与边界

例子比较的是规定闭环模型的输出误差，并未说明怎样通过控制器实现更小的时间常数。实际对象可能有时延、噪声、非最小相位零点和执行器限幅，要求更快响应可能带来更大控制作用。因此，“本例的ITAE更小”不等于“该控制器已满足所有约束”，也不构成全局最优性的证明。

在船舶航向或机电伺服试验中，可把相同指令下的误差曲线按同一窗口计算ITAE，再同时报告最大偏差、稳定裕度和控制输入约束。ITAE提供了比较维度，具体采用哪组权重和约束仍取决于任务目的。不能通过缩短差方案的积分窗口制造更小的分数。

### 常见误区

1. 误区：正负误差相抵后积分较小，说明跟踪良好。纠正：ITAE积分的是绝对误差，符号不能抵消。
2. 误区：ITAE最小就保证超调最小且执行器安全。纠正：这些是不同要求，需要分别检查或显式加入约束。

### 自检

1. 在相同归一化单位阶跃下，一阶时间常数由2 s减到1 s，ITAE变为原来的多少？
2. 若误差最终趋于非零常数，无限时域ITAE是否有限？

**核对要点**：本模型中ITAE与时间常数平方成正比，因此变为四分之一。非零常值尾部使时间加权积分发散；有限窗口结果必须注明窗口，不能冒充收敛的无限积分。

### 关联节点

- **ITAE设计步骤**（无向，关系：相关）
- **ITAE目标PID三步设计法**（无向，关系：相关）
