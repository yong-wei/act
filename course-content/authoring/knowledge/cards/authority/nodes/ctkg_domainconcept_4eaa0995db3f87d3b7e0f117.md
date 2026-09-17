---
node_id: ctkg_domainconcept_4eaa0995db3f87d3b7e0f117
authority_entity_id: "ctkg:domainconcept:4eaa0995db3f87d3b7e0f117"
name: "参数不确定性"
name_en: "Parameter Uncertainty"
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
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-b81a249d49a5fa4b5bc21523a1ba7f9de6a11507245495f08d2a0e3b5385763b.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-b81a249d49a5fa4b5bc21523a1ba7f9de6a11507245495f08d2a0e3b5385763b.json"
  - "git:f655dee490f714247dea867602a4d42bf699f2fd:course-content/authoring/knowledge/cards/nodes/IMC_SIMC与模型匹配整定_4_42013.md"
asset_refs: []
---

## 首页

# 参数不确定性 | Parameter Uncertainty

**一句话定义**：对象或控制器参数未知、漂移或只能在范围内确定的状态。

**核心直觉**：设计基于名义模型，真实闭环要对允许的参数变化保留性能与稳定余量。

**关键公式**：
$$
G(s,p)=G_0(s)\bigl(1+\Delta_p(s)\bigr),\qquad \mathcal{S}_p^y=\frac{\partial\ln y}{\partial\ln p}
$$

**学习目标**：用局部灵敏度估计参数变化的影响，并判断何时必须做全范围验证。

---

## 详情

### 完整解释

参数不确定性描述的是模型中的量发生未知变化，例如对象增益 $K$、时间常数 $T$ 或阻尼参数随负载、温度和老化而改变；它不是传感器测量端叠加的随机噪声。可用名义模型 $G_0(s)$ 和无量纲偏差表示对象族：
$$
G(s,p)=G_0(s)\bigl(1+\Delta_p(s)\bigr),
$$
其中 $\Delta_p$ 只在声明的范围内成立。对参数 $p$ 的局部对数灵敏度定义为
$$
\mathcal{S}_p^y=\frac{\partial\ln y}{\partial\ln p}\approx\frac{\Delta y/y}{\Delta p/p}.
$$
它回答“参数相对改变一小点时，输出相对改变多少”，不能替代大范围参数扫描、极点检查或未建模动态分析。

闭环因果链是：参数变化 → 对象增益、极点或相位变化 → 环路增益变化 → 闭环输出和稳定裕度变化。反馈常能压低低频增益误差的灵敏度，但时间常数变化会移动极点，额外高频极点会带来相位损失，大偏差还可能使线性近似失效。因此应分别报告名义响应、参数范围内的最坏响应和稳定性结论，不能把一个名义点的好性能称为鲁棒性。

### 教学计算/推理例

取对象 $G(s)=K/(Ts+1)$、单位负反馈和单位阶跃输入。直流闭环输出为
$$
y_\infty(K)=\frac{K}{1+K}.
$$
对 $K$ 求对数灵敏度，得到
$$
\mathcal{S}_K^y=\frac{1}{1+K}.
$$
当名义值 $K=9$、相对变化 $\Delta K/K=10\%$ 时，局部估计给出输出相对变化约为 $0.1\times10\%=1\%$。精确比较 $K=9$ 与 $K=9.9$：输出从 $0.9$ 变为 $9.9/10.9\approx0.9083$，相对变化约 $0.917\%$；小变化估计与精确值接近，但两者并不完全相同。

### 适用条件与边界

灵敏度近似要求参数变化小、工作点不变且闭环仍在线性范围内。若 $T$、未建模极点或执行器饱和同时变化，应进行参数网格、区间极点或时域仿真，并重新检查相位裕度。

### 自检

1. 低频环路增益从 $9$ 增至 $99$ 时，对对象增益的低频灵敏度如何变化？为什么？
2. 参数不确定性和测量噪声是否是同一类输入？为什么？

**核对要点**：灵敏度从 $1/10$ 降为 $1/100$，因为反馈抑制了低频增益变化；不是，前者改变对象模型的参数，后者是测量通道中的附加信号。

### 关联节点

- **灵敏度**（关联）：给出输出对参数相对变化的局部响应。
- **系统灵敏度**（关联）：把参数变化放入闭环结构后考察其影响。
- **对数灵敏度函数**（关联）：用对数变化量比较不同量纲参数的相对影响。
