---
node_id: ctkg_m3-v1l_canonical-object_563362810a1baa53567a9d33
authority_entity_id: "ctkg:m3-v1l:canonical-object:563362810a1baa53567a9d33"
name: "闭环控制系统带宽"
name_en: "Bandwidth of a Closed-Loop Control System"
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
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-45a434cb93420df34c8d4aad7bc830438844d0e381a291e0567eda5de4b4ac9e.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-45a434cb93420df34c8d4aad7bc830438844d0e381a291e0567eda5de4b4ac9e.json"
asset_refs: []
---

## 首页
# 闭环控制系统带宽 | Bandwidth of a Closed-Loop Control System

一句话定义：在稳定低通闭环系统中，带宽常用幅值相对直流值降至 $1/\sqrt2$ 时的频率衡量，反映可有效跟踪的频率范围。

- 带宽阈值相对于低频基准，而非一律读取绝对 $-3$ dB。
- 频率指标不能单独决定超调、稳定性或抗噪能力。
- 必须声明使用的是闭环参考到输出通道。

---
## 详情
### 完整解释

令参考到输出的闭环传递函数为 $T(s)$。对稳定低通系统，若直流增益 $T(0)$ 有限且非零，常用半功率幅值阈值定义带宽频率：

$$
|T(j\omega_B)|=\frac{|T(0)|}{\sqrt2}.
$$

该阈值在分贝上比直流电平低 $10\log_{10}2\approx3.0103$ dB，通常简称下降3 dB。当 $|T(0)|=1$ 时，基准为0 dB，才能直接在绝对 $-3.0103$ dB处读数。使用“半功率”名称时应理解为幅值平方比减半；不同物理输入输出之间未必能直接解释为实际能量传递效率。

在单一低通通带的情形，可把0到 $\omega_B$ 视作常用的带宽范围。若有多个阈值交点，应明确采用通带下降边界等具体约定，不能随意选择其中一个。带通系统和直流增益为零的系统也不能直接套用此直流参考定义。

### 教学计算/推理例

设闭环 $T=2/(0.5s+1)$。直流增益为2，对应6.0206 dB。将幅值除以直流值，得到

$$
\frac{|T(j\omega)|}{|T(0)|}=\frac1{\sqrt{1+0.25\omega^2}}.
$$

令其等于 $1/\sqrt2$，得到 $\omega_B=2$ rad/s。此时绝对幅值为 $\sqrt2$，分贝电平为3.0103 dB。若机械地在图上寻找绝对 $-3$ dB点，就会读出更高的频率，并误报带宽。

单位阶跃响应为 $y(t)=2(1-e^{-2t})$，时间常数为0.5 s。对这一阶模型，带宽等于时间常数的倒数；但它的最终输出为2，并不等于参考1。带宽描述动态频率范围，不能代替直流跟踪精度。

### 适用条件与边界

把带宽与响应快慢联系起来，通常需要系统族、阻尼和零点结构相近。非最小相位零点、延迟、共振峰以及执行器约束都可能改变这种联系。带宽扩大还可能增加测量噪声影响和控制动作，不能只追求更大的数值。读闭环带宽前先确认模型稳定；一条形式上的幅频曲线不保证实际响应会收敛到正弦稳态。

### 常见误区

1. 非单位直流增益时仍把绝对 $-3$ dB当作统一阈值。
2. 将闭环带宽与开环单位增益交越频率视为严格相等。
3. 根据一个带宽值直接宣称稳态误差为零或所有响应更快。

### 自检

1. 本例带宽处的绝对分贝电平是多少？
2. 将分子2改为1而保持分母，按相对阈值定义的带宽是否改变？

**核对要点**：为3.0103 dB；幅值和直流基准同比缩放，带宽仍为2 rad/s，但直流增益改变。

### 关联节点

- **闭环带宽**（无向，关系：相关）
- **谐振频率ωr**（无向，关系：相关）
- **频域性能指标**（无向，关系：相关）
