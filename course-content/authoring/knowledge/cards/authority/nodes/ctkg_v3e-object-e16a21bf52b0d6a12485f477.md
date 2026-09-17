---
node_id: ctkg_v3e-object-e16a21bf52b0d6a12485f477
authority_entity_id: "ctkg:v3e-object-e16a21bf52b0d6a12485f477"
name: "转折频率（拐角频率）"
name_en: "Corner Frequency"
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
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-fa0d807c5db92a6e0c995872b72de12341b82ac18bd79238841d2750276fc2ad.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-fa0d807c5db92a6e0c995872b72de12341b82ac18bd79238841d2750276fc2ad.json"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-core-25a/previous/ctkg_v3e-object-e16a21bf52b0d6a12485f477.md"
asset_refs: []
---

## 首页
# 转折频率（拐角频率） | Corner Frequency

一句话定义：转折频率是典型因子的对数幅频渐近线开始改变斜率的特征频率，一阶因子常为时间常数的倒数。

- 一阶极点和零点在转折后贡献相反的斜率变化。
- 精确频率响应通常平滑，不存在真正的尖角。
- 转折频率由因子决定，不普遍等于交越或带宽。

---
## 详情
### 完整解释

对稳定一阶极点因子 $1/(1+\tau s)$，转折频率为 $\omega_t=1/\tau$。低频幅值渐近线斜率为0，高频为 $-20$ dB/dec。对一阶零点因子 $1+\tau s$，转折后的斜率则增加 $20$ dB/dec。把这些贡献与原点零极点的初始斜率相加，就能构造乘积传递函数的幅值渐近线。

“拐角”来自用两段直线拼接的作图方式。精确曲线由 $\sqrt{1+(\omega\tau)^2}$ 等连续函数决定，不会在 $1/\tau$ 处突然折断。转折附近正是两种极限近似都不很精确的区域，需要用精确响应或修正规则补充。

### 教学计算/推理例

对 $G=1/(s+1)$，转折频率为1 rad/s。精确电平在此为 $-3.0103$ dB，幅值渐近线交点为0 dB。频率从远低于1增加到远高于1时，幅频斜率逐渐由接近0变为接近 $-20$ dB/dec，相位由接近0逐渐趋于 $-90^\circ$。

再把它放入单位负反馈环路 $L=2/(s+1)$。开环因子的转折仍为1 rad/s，但单位增益交越满足 $|L(j\omega_c)|=1$，得 $\omega_c=\sqrt3$ rad/s；闭环为 $T=2/(s+3)$，按相对直流下降半功率的带宽为3 rad/s。三个频率不同，不能因它们都标在幅频图上就互相替代。

若另有因子 $1+s/10$，它在10 rad/s处使总幅值渐近斜率增加20 dB/dec。多因子系统应列出所有转折频率后排序，再逐段累计斜率，而不是只保留其中一个所谓“系统转折点”。

### 适用条件与边界

对标准二阶因子，常以自然频率组织渐近线，但阻尼决定转折附近的精确形状，低阻尼可能产生明显峰值。幅值相同的左右半平面零点具有不同相位，因此幅值转折不能单独说明最小相位性质或闭环稳定性。

纯延迟会改变相位而不改变幅值，不能从幅值渐近线中寻找一个虚构的延迟转折点。原点极点和零点也应直接计入初始斜率。频率单位采用rad/s时为 $1/\tau$，改为Hz需除以 $2\pi$。

### 常见误区

1. 把直线近似的尖角当成真实响应不连续。
2. 根据一个幅值转折点就判定闭环带宽或稳定裕度。
3. 只数有限转折点，漏掉积分环节从低频开始的斜率贡献。

### 自检

1. 一阶极点与一阶零点在转折后分别怎样改变渐近斜率？
2. 本例开环转折1 rad/s为何不能直接报告为闭环带宽？

**核对要点**：极点减少20、零点增加20 dB/dec；带宽来自闭环通道及相对阈值，本例实际为3 rad/s。

### 关联节点

- **转折点**（无向，关系：相关）
