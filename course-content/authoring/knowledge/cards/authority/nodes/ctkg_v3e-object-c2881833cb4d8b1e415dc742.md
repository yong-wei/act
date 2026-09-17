---
node_id: ctkg_v3e-object-c2881833cb4d8b1e415dc742
authority_entity_id: "ctkg:v3e-object-c2881833cb4d8b1e415dc742"
name: "幅值裕度"
name_en: "Gain Margin"
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
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-ea8b55856ec1377fdbb1bdb20df31061bf9003b45224b3d562348048e07fe7d5.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-ea8b55856ec1377fdbb1bdb20df31061bf9003b45224b3d562348048e07fe7d5.json"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-scale-01f/previous/ctkg_v3e-object-c2881833cb4d8b1e415dc742.md"
asset_refs: []
---

## 首页

# 幅值裕度 | Gain Margin

**一句话定义**：幅值裕度是在相位穿越频率处，开环幅值距离单位幅值的倍率余量。

**核心直觉**：保持相位不变地调节正增益，观察环路负实轴交点何时触及临界点 $-1$。

**关键公式**：
$$GM=\frac1{|L(j\omega_{pc})|}.$$

**学习目标**：区分倍率与分贝，并结合模型判断增益变化是否跨越闭环稳定边界。

---

## 详情

### 完整解释

幅值裕度的线性值是一个倍率，分贝值为 $GM_{\mathrm{dB}}=20\log_{10}GM=-20\log_{10}|L(j\omega_{pc})|$。例如倍率2对应约6.02 dB，不是2 dB；倍率1对应0 dB。它度量正的整体环路增益变化，不是输出幅值本身，也不直接描述参数改变引起的相位变化。

在标称闭环稳定、交越结构适当的常见负反馈系统中，增加环路增益至这一倍率会到达相应临界边界。但若有多个相位交越、开环不稳定极点或复杂非最小相位结构，增益稳定区间可能更复杂，应使用完整奈奎斯特或特征方程分析。不能普遍把“GM大于1”当成闭环稳定的充分条件，也不能把没有有限相位穿越误解为对时延或未建模动态无限鲁棒。

### 教学计算/推理例

考虑 $L(s)=3/[s(s+1)(s+2)]$。在 $\omega_{pc}=\sqrt2$ 处，$L=-0.5$，因此 $GM=2$、$GM_{\mathrm{dB}}\approx6.0206$。设整体正增益倍率为 $k$，闭环特征方程是
$$D(s)=s^3+3s^2+2s+3k.$$
劳斯首列为 $1,3,2-k,3k$，因此严格稳定范围为 $0<k<2$。当 $k=2$，$D=(s+3)(s^2+2)$，出现一对虚轴根；当 $k=2.5$，首列正、正、负、正，两个根进入右半平面。频域所得倍率2与独立的多项式边界完全一致。

若控制器参数变化还移动零极点或引入时延，相位也会变化，此时不能只用这个倍率估计真实安全范围。船舶载荷、速度和执行器变化往往同时影响多个模型参数；应明确幅值裕度是针对哪一种增益变化给出的局部设计指标。

### 常见误区与边界

1. **误区**：GM为2就表示增益能增加2倍后仍严格稳定。**纠正**：本例增至原来的2倍已到边界；严格稳定要求小于该倍率。
2. **误区**：只给幅值裕度就足够评价相对稳定性。**纠正**：应同时考察相位裕度、全部交越、闭环极点及实际模型不确定性。

### 自检

1. 开环相位穿越处幅值为0.25时，线性与分贝裕度分别多少？
2. 本例 $k=2$ 是否严格稳定？

**核对要点**：倍率4、约12.04 dB；不是，已出现不衰减的虚轴振荡模式。

### 关联节点

- **相位穿越频率**（关联）：幅值倒数必须在该频率读取。
- **同时考察相角裕度与幅值裕度的命题**（关联）：提示单一标量不足以完整描述相对稳定程度。
- **幅值裕度的临界增益含义**（适用关系）：本卡用完整特征方程限定并验证这一工程解释。
