---
node_id: ctkg_v3e-object-36f969bb5befa8ef9f8d0a99
authority_entity_id: "ctkg:v3e-object-36f969bb5befa8ef9f8d0a99"
name: "频率响应法"
name_en: "Frequency-Response Design Method"
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
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-cdfed9c006fe5ccf20a84ee79c86d1f3656b29acec026b4e97c739d6000c2ec1.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-cdfed9c006fe5ccf20a84ee79c86d1f3656b29acec026b4e97c739d6000c2ec1.json"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-core-24a/previous/ctkg_v3e-object-36f969bb5befa8ef9f8d0a99.md"
asset_refs: []
---

## 首页
# 频率响应法 | Frequency-Response Design Method

一句话定义：频率响应法通过分析并调整系统的频率响应，设计满足稳定性和性能要求的控制器或校正装置。

- 在伯德、Nyquist或尼科尔斯图上表达同一环路响应。
- 校正设计同时改变幅值与相位，需重新确定交越频率。
- 频域设计结果仍需核验闭环稳定性及实际性能。

---
## 详情
### 完整解释

频率响应法把“在哪些频段跟踪或抑制扰动、哪些频段限制噪声与控制动作”等要求转化为环路形状的设计目标。常见步骤是建立被控对象模型，检查其开环极点与适用范围，确定目标交越频率和稳定裕度，再选取校正结构、调节参数并验证闭环。

幅值决定哪些频率会形成交越，相位决定这些交越附近的反馈关系。增加一个超前环节既增加相位，也改变幅值；若只把某频率的相位增量加到原裕度，却不重算实际交越点，所得裕度可能不对应校正后的系统。

### 教学计算/推理例

设单位负反馈环路的未校正部分为 $L_0=2/[s(s+1)]$，选取

$$
C(s)=K\frac{1+s/0.5}{1+s/2},\qquad K=\frac1{2\sqrt2}.
$$

在目标频率 $\omega_c=1$，$|L_0(j)|=\sqrt2$，校正器零极点比的幅值为2，故 $|C(j)L_0(j)|=2\sqrt2K=1$。校正器增加的相位为 $\arctan2-\arctan0.5\approx36.8699^\circ$，未校正部分在该频率的相位为 $-135^\circ$。于是新环路相位约为 $-98.1301^\circ$，该交越处相位裕度约为 $81.8699^\circ$。

进一步检查闭环特征多项式：

$$
0.5s^3+1.5s^2+(1+4K)s+2K.
$$

代入 $K\approx0.353553$，系数为0.5、1.5、2.414214、0.707107，均为正，且 $1.5(1+4K)>0.5(2K)$，满足三阶Routh稳定条件。这样，频域交越设计与独立的闭环稳定计算相互核对。该环路幅值随正频率严格下降，因而上述单位幅值交越唯一。

### 适用条件与边界

相位裕度是局部交越指标，不能在任意多交越、非最小相位或开环不稳定结构中脱离完整稳定分析使用。本例含开环积分极点，闭环稳定性已用特征多项式另行核验。这里没有计算阶跃超调、调节时间、执行器峰值或噪声响应，因此不能凭裕度数值宣称所有时域要求均已满足。

实际设计还应核验模型不确定性、采样延迟、饱和和测量噪声等与任务有关的因素。对非线性大范围运动，单一线性工作点频率响应的结论不能自动推广。

### 常见误区

1. 校正后仍沿用原交越频率，遗漏控制器带来的幅值变化。
2. 将正相位裕度作为无条件稳定证明，而不检查结构前提。
3. 把稳定裕度较大直接等同于响应更快或所有性能更好。

### 自检

1. 本例为什么需要在零极点确定后再选择增益 $K$？
2. 已通过闭环稳定检查，是否就能给出确定的阶跃超调百分比？

**核对要点**：增益用于使目标频率的环路幅值恰为1；稳定只说明极点位置满足要求，具体超调仍需按实际闭环响应计算。

### 关联节点

- **补偿器**（出边，关系：适用于）
- **伯德图**（无向，关系：相关）
- **频率响应**（无向，关系：相关）
