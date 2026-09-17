---
node_id: ctkg_domainconcept_d071dec567505ce641aa9b15
authority_entity_id: "ctkg:domainconcept:d071dec567505ce641aa9b15"
name: "一致渐近稳定性"
name_en: "Uniform Asymptotic Stability"
category: 概念性
knowledge_type: C
bloom_level: 应用
card_version: 3
confifteent_origin: act-course-enrichment
authority_release_id: "ctr:release:control-theory-engineering-v0.48"
authority_snapshot_id: "snap-7f1549103098d6efcc8a3989a344c047af682df7d8b4bddd7a28101dee04e731"
authority_snapshot_hash: "7f1549103098d6efcc8a3989a344c047af682df7d8b4bddd7a28101dee04e731"
status: ready
source_docs:
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-faf5babb4af709946782af0f262a845af99375b88a2f65689ac49d6c908c56d8.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-faf5babb4af709946782af0f262a845af99375b88a2f65689ac49d6c908c56d8.json"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-professional-05a/previous/ctkg_domainconcept_d071dec567505ce641aa9b15.md"
asset_refs: []
---

## 首页
# 一致渐近稳定性 | Uniform Asymptotic Stability

一句话定义：一致渐近稳定性同时要求一致稳定，以及在一个共同初始邻域内，用不依赖初始时刻的等待时间保证状态进入任意给定的小邻域。

- 一致吸引时间可以依赖误差容限和约定的初始范围。
- 不能依赖每次启动的绝对时刻。
- 一致渐近稳定仍不等同于指数稳定。

---
## 详情
### 完整解释

对 $\dot x=f(t,x)$ 的原点平衡，先要求一致稳定。再要求存在一个与起始时刻无关的初始半径c，使对任意容限epsilon，都可选出与 $t_0$ 无关的等待时间T；只要初态位于该半径内，所有 $t\geq t_0+T$ 的状态都位于epsilon邻域中。这里说的是一整组初值、所有起始时刻共同满足的保证。

这种定义比“每条轨迹分别趋于零”更强。逐条收敛允许等待时间随起始时刻任意增加，而一致吸引不允许出现这种退化。另一个常用表达是用只依赖初始距离和经过时间的统一衰减界约束轨迹。

### 教学计算/推理例

取 $\dot x=-2x$，解为 $x(t)=x_0e^{-2(t-t_0)}$。范数不增证明一致稳定。若约定 $|x_0|\leq r$，希望所有这些轨迹满足 $|x(t)|\leq\epsilon$，可取

$$
T=\max\left\{0,\frac12\ln\frac{r}{\epsilon}\right\}.
$$

因为在经过T以后有 $|x(t)|\leq r e^{-2T}\leq\epsilon$，而T完全不含起始时刻，所以得到一致吸引。取r=2、epsilon=0.01时，等待时间约为2.649；无论系统从哪一个时刻启动，相同保证都成立。若要求严格小于epsilon，可在该时间上再增加任意正量。

对照 $\dot x=-x/(1+t)$，其固定经过时间T后的比例为 $(1+t_0)/(1+t_0+T)$。对任何固定T，起始时刻足够大时该比例都会大于1/2。因此即使固定一个共同初始邻域，也不能用统一时间保证其中同一个非零初值减半，原点不一致渐近稳定。

### 一致渐近不一定指数

自治标量系统 $\dot x=-x^3$ 的解为 $x_0/\sqrt{1+2x_0^2(t-t_0)}$。在 $|x_0|\leq r$ 内，最大绝对值不超过 $r/\sqrt{1+2r^2(t-t_0)}$，它随经过时间趋于零且不依赖起始时刻，给出一致吸引。范数不增又给出一致稳定。

然而非零轨迹只有代数衰减，不能由统一的正指数速率长期上界。因此一致渐近稳定与指数稳定应分别陈述；前者要求统一趋零，后者还限定特定的衰减速度形式。

### 适用条件与边界

采用时变李雅普诺夫定理时，应核对V具有统一的正定上下界，沿轨迹导数受到与时间无关的严格负定函数约束等条件。仅看到每个固定时刻导数严格为负，不足以排除收敛速度随绝对时间消失的情况。

局部一致渐近稳定使用一个共同的小初始邻域。若宣称全局一致渐近稳定，应对任意有界初始范围给出相应统一吸引估计，并保证解对所有未来时刻存在，不能省略大状态区域的行为。

### 常见误区

1. 把逐条轨迹趋零当成一致吸引的充分证据。
2. 为每个起始时刻单独选择T，却仍称其一致。
3. 把统一趋零直接改写成统一指数衰减。

### 自检

1. $\dot x=-2x$ 的等待时间为什么不依赖启动时刻？
2. $\dot x=-x^3$ 可以一致渐近稳定而非指数稳定吗？

**核对要点**：解析解只通过经过时间决定衰减比例；可以，其统一上界代数趋零，但不满足固定指数速率要求。

### 关联节点

- **李雅普诺夫稳定性**（无向，关系：相关）
- **李雅普诺夫意义下的稳定性**（无向，关系：相关）
