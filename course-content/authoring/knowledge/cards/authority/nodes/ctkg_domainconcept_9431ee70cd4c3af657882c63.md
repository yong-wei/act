---
node_id: ctkg_domainconcept_9431ee70cd4c3af657882c63
authority_entity_id: "ctkg:domainconcept:9431ee70cd4c3af657882c63"
name: "直接数字设计法"
name_en: "Direct Digital Controller Design"
category: 概念性
knowledge_type: C
bloom_level: 应用
card_version: 3
consixt_origin: act-course-enrichment
authority_release_id: "ctr:release:control-theory-engineering-v0.48"
authority_snapshot_id: "snap-7f1549103098d6efcc8a3989a344c047af682df7d8b4bddd7a28101dee04e731"
authority_snapshot_hash: "7f1549103098d6efcc8a3989a344c047af682df7d8b4bddd7a28101dee04e731"
status: ready
source_docs:
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-1b0cccdc2489e2dc5651f887871c1cf0ad69ada7f4f9d49f70cc37b4fa519ef8.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-1b0cccdc2489e2dc5651f887871c1cf0ad69ada7f4f9d49f70cc37b4fa519ef8.json"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-professional-09a/previous/ctkg_domainconcept_9431ee70cd4c3af657882c63.md"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-professional-09a/supporting-source-inventory.json"
asset_refs: []
---

## 首页
# 直接数字设计法 | Direct Digital Controller Design

一句话定义：直接数字设计先按实际采样与保持建立离散对象，再在离散模型上求控制器并核验实现后的闭环。

- 先确定采样和保持，再确定离散模型。
- 连续控制器直接搬用不等于直接数字设计。
- 离散样值目标与采样间要求需要分别核验。

---
## 详情
### 完整解释

数字控制器的输入由样值产生，输出通常通过保持环节施加到连续对象。直接数字设计把这种实现方式纳入被控对象模型，再求离散控制器系数。它与先设计连续控制器、然后通过近似变换得到数字控制器的路线不同；两条路线都需要验证，不能默认它们在有限采样周期下严格相同。

开始设计前应明确采样周期、输入保持方式、计算延迟、输出测量时刻与初态含义。遗漏一拍延迟或把零阶保持误作实时输入，会改变离散对象和最终闭环特征方程，即使增益求解过程没有算术错误也可能得到不匹配结果。

### 教学计算/推理例

取连续对象 $\dot x=-x+u$，采样周期 $T=\ln(5/4)\approx0.22314$，输入零阶保持。精确离散模型为

$$
x[k+1]=0.8x[k]+0.2u[k].
$$

希望零输入闭环样值按连续衰减率4对应的速度衰减，目标离散极点应为 $\rho=e^{-4T}=0.8^4=0.4096$。采用当前样值反馈u[k]=-Kx[k]，无额外计算延迟，闭环极点为0.8-0.2K。令它等于目标值，得到

$$
K=\frac{0.8-0.4096}{0.2}=1.952.
$$

因此离散闭环样值满足 $x[k]=0.4096^k x[0]$，在采样点与指定的指数衰减序列一致。这是直接根据实际离散对象求得的增益，不需要先构造一个连续反馈控制器再作近似离散化。

### 为什么不直接使用连续增益

若在原连续对象上采用实时反馈u(t)=-3x(t)，闭环确实是 $\dot x=-4x$。但是把数字控制器改成u[k]=-3x[k]并零阶保持后，闭环样值极点变成 $0.8-0.2\times3=0.2$，并不是期望的0.4096。

两者在这个例子中都稳定，但响应速度和输入使用不同。差异来自输入在采样区间内是否随真实状态实时更新。不能把连续闭环的指数采样表达式直接当成数字保持反馈闭环，而绕过对象保持等效与反馈互连的顺序。

### 设计结论的范围

本例要求的是零输入调节的样值衰减率，没有要求单位参考的无静差跟踪。若加入参考输入，还需检查参考通道增益；若要求抗恒定扰动或幅值受限，也要把这些要求分别纳入设计。匹配一个闭环极点不会自动完成所有控制任务。

即便样值按目标指数变化，区间内部仍由原连续对象在保持输入下运行。它通常不同于连续实时反馈的完整指数曲线。若指标关心采样间峰值或状态边界，应利用连续方程和保持输入继续核验。

### 适用条件与边界

较高阶系统可能包含非最小相位零点、延迟或不可稳定模态，目标闭环不能随意指定。控制器还需满足因果性和可实现性，不能通过要求未来输入或不允许的极零点约消来假造目标响应。

实际部署后出现计算延迟、量化或执行器饱和，应按真实实现重新建立模型。直接数字设计的优势在于从一开始明确数字实现条件，而不是使这些非理想因素自动消失。

### 常见误区

1. 将连续闭环采样与采样保持反馈闭环当成同一系统。
2. 只匹配一个离散极点就宣称所有性能达标。
3. 设计时省略保持方式和控制计算延迟。

### 自检

1. 本例目标离散极点和直接设计的K分别是多少？
2. 数字实现直接使用K=3为何产生不同极点？

**核对要点**：目标0.4096、K=1.952；输入只在采样时刻更新并保持，闭环极点应由0.8-0.2K计算。

### 关联节点

本卡的结论可由上述定义与计算例独立复核。
