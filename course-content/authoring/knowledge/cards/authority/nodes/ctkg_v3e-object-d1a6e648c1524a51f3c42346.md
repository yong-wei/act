---
node_id: ctkg_v3e-object-d1a6e648c1524a51f3c42346
authority_entity_id: "ctkg:v3e-object-d1a6e648c1524a51f3c42346"
name: "描述函数"
name_en: "Describing Function"
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
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-277f49b2ebd461ffa842b8bd232753c1b69bef5f1898590c2c7cd628796e6d7d.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-277f49b2ebd461ffa842b8bd232753c1b69bef5f1898590c2c7cd628796e6d7d.json"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-core-28a/previous/ctkg_v3e-object-d1a6e648c1524a51f3c42346.md"
asset_refs: []
---

## 首页
# 描述函数 | Describing Function

一句话定义：描述函数是非线性元件在指定正弦输入下，稳态输出基波相量与输入相量之比，用于基波近似分析。

- 它只保留基波，不等于完整非线性输入输出关系。
- 通常依赖输入振幅，动态或有记忆元件还可能依赖频率。
- 相位与复数符号取决于明确的输入约定。

---
## 详情
### 完整解释

取输入 $u=A\sin\theta$，输出周期响应的基波写成 $y_1=b_1\sin\theta+a_1\cos\theta$。采用“输出为 $A|N|\sin(\theta+\arg N)$”的约定，描述函数为

$$
N=\frac{b_1+ja_1}{A},\qquad A>0.
$$

其中 $b_1$ 和 $a_1$ 由一周期傅里叶积分得到。若使用余弦作为输入基准，应一致变换相量约定，不能把不同教材的系数名称直接拼接。奇对称、无记忆的一些静态非线性会给出实数描述函数，但这不是所有非线性的通用性质。

### 教学计算/推理例

对于无迟滞对称继电器 $y=M\operatorname{sgn}(u)$，正弦输入产生方波，积分得到 $b_1=4M/\pi$、$a_1=0$，因而

$$
N(A)=\frac{4M}{\pi A}.
$$

取 $M=1$，输入振幅1时 $N\approx1.27324$，振幅2时 $N\approx0.63662$。两个数并不冲突：元件输出等级不随非零输入振幅变化，而基波相量与输入相量之比会改变。

输出还含有幅值 $4M/(3\pi)$ 的三次谐波等分量。若只用 $N(A)u$，保留的是基波近似，完整方波的平顶和切换无法由这个表达式精确重建。描述函数也不告诉我们任意非正弦输入下的瞬态响应。

### 适用条件与边界

使用描述函数通常需要周期输出可定义，输入接近单一正弦，并且系统的线性部分能够抑制高次谐波影响。若元件带迟滞或动态记忆，应明确初态、稳态分支和频率，描述函数可能写成 $N(A,\omega)$。多值响应或强高次谐波都可能削弱这种简化的可靠性。

与工作点线性化不同，描述函数不是对函数求局部导数，而是对有限振幅周期信号作基波投影。它可以随振幅变动；把它固定成一个传递函数后进行任意叠加，会丢失原有非线性。输入振幅0也不在上述相量比定义的直接适用范围内。

在闭环中，$1+G(j\omega)N(A)=0$ 可给出谐波平衡候选，但不能单独证明真实周期轨道存在、稳定或幅值精确等于候选。必要时须用完整非线性模型或其他理论交叉核验。

### 常见误区

1. 将描述函数误称为非线性元件的精确传递函数。
2. 把描述函数当作工作点微分增益，忽略有限振幅积分。
3. 只求得一个谐波平衡交点，就宣称周期运动和稳定性已经证明。

### 自检

1. 本例振幅从1变为2时，为何 $N$ 减半？
2. 描述函数为实数是否意味着输出不含高次谐波？

**核对要点**：基波输出幅值不变而输入加倍；实数仅表示基波同相，本例仍存在三次等高次谐波。

### 关联节点

- **极限环**（出边，关系：用于分析）
- **谐波线性化**（入边，关系：用于分析）
- **描述函数法**（入边，关系：包含组件）
