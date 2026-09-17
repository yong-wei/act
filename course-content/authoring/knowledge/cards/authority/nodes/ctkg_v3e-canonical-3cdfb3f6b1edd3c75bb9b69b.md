---
node_id: ctkg_v3e-canonical-3cdfb3f6b1edd3c75bb9b69b
authority_entity_id: "ctkg:v3e-canonical-3cdfb3f6b1edd3c75bb9b69b"
name: "测速反馈控制"
name_en: "Velocity-feedback Control"
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
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-f6d5220a709cc41c6d5536a691fdf0e28b208e4d1ee8d8db095f5b31d217d70e.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-f6d5220a709cc41c6d5536a691fdf0e28b208e4d1ee8d8db095f5b31d217d70e.json"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-core-20a/previous/ctkg_v3e-canonical-3cdfb3f6b1edd3c75bb9b69b.md"
asset_refs: []
---

## 首页

# 测速反馈控制 | Velocity-feedback Control

**一句话定义**：测速反馈控制将输出速度以明确符号反馈到控制量中，用来改变系统运动的动态特性。

在某些模型中它与误差PD具有相同阻尼分母，但参考输入通道并不相同。

---

## 详情

### 完整解释

位置误差反馈根据目标与位置差生成作用，测速反馈则另外利用输出的变化率。在机械模型中，负的速度项常表现为附加阻尼，但是否如此取决于符号、系数放置和对象方程。必须先写清控制律，才能解释“增大阻尼”。

本卡采用 $u=K(r-y)-K_t\dot y$，其中测速系数直接乘输出速度并进入控制量。它没有参考输入的导数项；与 $u=K(r-y)+K_t(\dot r-\dot y)$这种误差PD相比，差别正是参考导数的作用。

这种区别在参考变化时尤其明显。不能因为两种结构的特征分母相同，就宣称它们对所有输入具有完全相同的响应。极点只说明部分动态结构，分子与输入通道也必须保留。

### 教学计算/推理例

取对象 $\ddot y+\dot y=u$。代入速度反馈控制律得到

$$\ddot y+(1+K_t)\dot y+Ky=Kr,$$

参考传递函数为

$$T_v(s)=\frac{K}{s^2+(1+K_t)s+K}.$$

选 $K=4,K_t=1.8$，分母为 $s^2+2.8s+4$，阻尼比为0.7，固有频率为2。零初态单位阶跃下，输出初始速度为0，控制量最初为4。

若改成理想误差PD，原方程右侧会多出 $K_t\dot r$，参考传递函数变为

$$T_{PD}(s)=\frac{K+K_ts}{s^2+(1+K_t)s+K}.$$

它与速度反馈具有相同分母，却有不同分子。单位阶跃参考的理想导数作用包含冲激，因此不能将它与没有参考导数的测速反馈起始行为混为一谈。

### 适用条件与边界

速度信号可能来自传感器或估计，但实际取得方式会影响噪声、滤波和时延。若加入这些动态，就应把它们纳入最终模型。不能一方面使用理想速度反馈的二阶公式，另一方面把额外测量动态的影响当作已经被包含。

对本例，单位斜坡稳态误差为 $(1+K_t)/K$，所以增加测速反馈还可能带来跟踪精度代价。阶跃超调减小不等于全部输入情况下误差更小，应按具体任务检查。

如果资料把测速反馈放在前向增益之前，实际控制量的速度系数会是相应乘积。为了比较不同结构，最可靠的方法是从变量方程推导闭环，而不是只看方框位置或系数名字相似。

### 常见误区

1. 误区：测速反馈就是误差PD的完全等价写法。纠正：它通常没有参考导数项，参考分子与起始响应可能不同。
2. 误区：只需确认分母相同就能认定全部响应相同。纠正：分子和输入通道同样决定响应。

### 自检

1. 本例两种控制律的参考传递函数差在哪一项？
2. 为什么单位阶跃时这种差异不能忽略？

**核对要点**：理想误差PD分子多了 $K_ts$，对应参考导数。阶跃的理想导数含冲激，会改变起始作用，不能沿用无参考导数模型的结论。

### 关联节点

- **阻尼比**（无向，关系：相关）
- **测速反馈控制改善系统性能的方法**（无向，关系：相关）
