---
node_id: ctkg_v3e-object-563729def6c074a2e1ae6d1d
authority_entity_id: "ctkg:v3e-object-563729def6c074a2e1ae6d1d"
name: "继电特性"
name_en: "Relay Characteristic"
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
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-a6de361735c1bcc0ad01d6bcdf825fcd89804b4a3bd4474057d0568ff5489608.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-a6de361735c1bcc0ad01d6bcdf825fcd89804b4a3bd4474057d0568ff5489608.json"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-core-28a/previous/ctkg_v3e-object-563729def6c074a2e1ae6d1d.md"
asset_refs: []
---

## 首页
# 继电特性 | Relay Characteristic

一句话定义：继电特性按输入符号或阈值在有限输出等级之间切换，其正弦输入响应通常含有多个谐波。

- 本卡采用无迟滞、对称两位继电特性。
- 输出基波与完整方波应分别描述。
- 描述函数随输入振幅改变，并非普通常数增益。

---
## 详情
### 完整解释

设非零输入时 $y=M\operatorname{sgn}(u)$，$M>0$ 为输出等级幅值。本例在输入恰为0时取 $y=0$，作为明确的边界约定。对 $u=A\sin\theta$、$A>0$，输出为幅值 $M$ 的对称方波，其切换时刻对应输入过零。

对一个周期中有限个过零点的取值约定不会改变连续时间傅里叶积分，但在离散切换实现中仍需说明。带迟滞继电器具有不同规则和相位特性，不能直接套用本卡无迟滞结果。

### 教学计算/推理例

输出对输入正弦的基波系数为

$$
b_1=\frac1\pi\int_0^{2\pi}y(\theta)\sin\theta\,d\theta=\frac{4M}{\pi},\qquad a_1=0.
$$

因此基波输出为 $(4M/\pi)\sin\theta$，与输入同相。若 $M=1,A=2$，基波幅值约1.27324，除以输入幅值2得到描述函数 $N=2/\pi\approx0.63662$。

基波幅值大于方波输出等级1并不矛盾。傅里叶分量相加才得到完整波形，单独基波可以在峰值处超过完整方波。三次谐波幅值为 $4/(3\pi)\approx0.42441$，不是0；不能把基波近似画成完整继电输出。

若保持 $M=1$、把输入振幅从2降到1，完整输出仍为相同等级的方波，基波幅值不变，但描述函数增大到 $4/\pi\approx1.27324$。这说明等效基波增益依赖振幅，无法用一个常数对全部振幅进行线性叠加。

### 适用条件与边界

描述函数分析通常要求后续线性部分对高次谐波有足够衰减，使反馈到非线性输入的波形接近正弦。仅有继电元件并不能保证这个条件。若迟滞、偏置、延迟或不对称等级存在，基波系数可能改变，甚至出现额外相位和直流分量。

本卡未从继电特性单独推出闭环振荡或稳定性。是否存在周期运动取决于对象、反馈符号和全部动态。输入振幅趋近0时公式 $N=4M/(\pi A)$ 发散，这是理想不连续模型的结果，不能解释为真实装置能够提供无限能量或无限物理增益。

### 常见误区

1. 用输出等级 $M$ 代替方波基波幅值 $4M/\pi$。
2. 因为 $N$ 为实数，就声称继电器是精确线性元件。
3. 忽略三次等高次谐波，默认正弦输入必然产生正弦输出。

### 自检

1. 本例 $M=1,A=2$ 时，输出等级与基波幅值各是多少？
2. 把输入振幅加倍，描述函数如何变化？

**核对要点**：等级为 $\pm1$，基波幅值 $4/\pi$；在同一理想模型中 $N$ 与 $A$ 成反比，振幅加倍则描述函数减半。

### 关联节点

- **自激振荡**（无向，关系：相关）
