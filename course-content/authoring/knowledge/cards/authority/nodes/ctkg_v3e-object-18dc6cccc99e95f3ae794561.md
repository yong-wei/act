---
node_id: ctkg_v3e-object-18dc6cccc99e95f3ae794561
authority_entity_id: "ctkg:v3e-object-18dc6cccc99e95f3ae794561"
name: "混叠"
name_en: "Aliasing"
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
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-6a39c93652917c8e3c57f62841032bc78d6de697f8d71151bb5b5b438ff16feb.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-6a39c93652917c8e3c57f62841032bc78d6de697f8d71151bb5b5b438ff16feb.json"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-professional-01a/previous/ctkg_v3e-object-18dc6cccc99e95f3ae794561.md"
asset_refs: []
---

## 首页
# 混叠 | Aliasing

一句话定义：混叠是不同连续频率在采样后形成相同或无法区分的离散频率表示，导致原始频率信息丢失的现象。

- 确定性信号和噪声都可能混叠。
- 离散角频率以 $2\pi$ 为周期等价。
- 采样后的滤波不能普遍分离已变成相同样值的信息。

---
## 详情
### 完整解释

均匀采样把连续角频率 $\omega$ 映射为离散角频率 $\Omega=\omega T_s$。对于整数 $m$，复指数满足 $e^{j(\Omega+2\pi m)k}=e^{j\Omega k}$。因此相差采样角频率整数倍的连续复指数，会在采样点上相同。

实正弦和余弦还涉及正负频率及相位关系，不能只取频率差的绝对值而忽略相位。例如余弦对正负频率为偶对称，正弦则会改变符号。判断是否相同，应直接比较样值或复指数表达。

### 教学计算/推理例

采样率为10 Hz，比较 $x_1(t)=\cos(2\pi\cdot2t)$ 与 $x_2(t)=\cos(2\pi\cdot8t)$。在 $t=k/10$ 时，8 Hz的离散角频率为 $1.6\pi$，与 $-0.4\pi$ 等价；余弦又是偶函数，因此两序列完全相同。

前六个样值约为1、0.30902、$-0.80902$、$-0.80902$、0.30902、1。连续波形每秒分别振荡2次和8次，数字样值却不能区分它们。若我们不知道输入已被限制在5 Hz以下，就不能仅从这组样值断定真实频率为2 Hz。

如果两个信号同时叠加，采样后的对应分量也叠在同一个离散频率上。数字低通滤波可以保留或删除这个离散分量，但无法凭空知道其中多少来自2 Hz、多少来自8 Hz。信息已在采样时混合，需要采样前的限制或其他额外观测才能解决。

### 适用条件与边界

避免基带混叠通常需要信号严格带限并使用足够高采样率；实际模拟预滤波器只能衰减带外信号，不能实现绝对理想截止，因此还需考虑剩余带外能量及容许误差。仅提高数字滤波器阶数无法替代采样前处理。

混叠是关于采样映射的现象，不限于随机高频噪声。转动轮辐的视觉倒转和数字频率误判都可以用离散观测解释，但具体方向和频率还依赖观测方式。非均匀采样及带通采样具有不同先验和分析条件，不应未经说明套用简单基带公式。

量化误差与混叠也不同：前者改变样值幅度表示，后者可能在无限精度样值中依然存在。真实系统应分别核验频谱范围、采样时序和幅度分辨率。

### 常见误区

1. 把混叠限定为噪声问题，忽略确定性正弦也会发生。
2. 认为采样后数字滤波能唯一找回原先的高低频组成。
3. 处理正弦频率折叠时忽略相位或符号变化。

### 自检

1. 本例8 Hz与2 Hz余弦为什么在10 Hz采样下相同？
2. 使用更精确的浮点数保存样值，能否解决这一不可区分性？

**核对要点**：离散频率相差整周并利用余弦偶对称；不能，两序列在理想精度下已经相同。

### 关联节点

- **测量噪声信号**（无向，关系：相关）
- **抗混叠预滤波器**（入边，关系：用于分析）
- **传感器噪声 N(s)**（无向，关系：相关）
