---
node_id: ctkg_v3e-object-aa79b6fedda690cfd68855aa
authority_entity_id: "ctkg:v3e-object-aa79b6fedda690cfd68855aa"
name: "继电器"
name_en: "Relay Element"
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
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-02c656d156879118930dea39aee70912158bc879d78127c32390eb297826fb8f.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-02c656d156879118930dea39aee70912158bc879d78127c32390eb297826fb8f.json"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-core-27a/previous/ctkg_v3e-object-aa79b6fedda690cfd68855aa.md"
asset_refs: []
---

## 首页
# 继电器 | Relay Element

一句话定义：理想继电器按输入符号或阈值在有限输出等级之间切换，是常见的不连续非线性元件模型。

- 理想两位继电器与带迟滞继电器应分别定义。
- 切换阈值处的取值必须说明。
- 输出有界不等于闭环必然稳定或没有振荡。

---
## 详情
### 完整解释

最简单的对称两位继电模型在 $u\ne0$ 时写成 $y=M\operatorname{sgn}(u)$，其中 $M>0$。正输入产生固定正输出，负输入产生固定负输出。无论输入幅值多小，只要改变符号，输出就发生有限跳变，因此它不同于连续比例环节。

理想模型在输入恰为0时没有由左右极限确定的唯一值。本卡为计算明确选择 $y(0)=0$；也可以在其他模型中约定保持旧状态或指定一个等级，但必须声明，不能在推导中随意切换。若零点保持旧状态，就引入了与本卡不同的边界规则。

### 教学计算/推理例

取 $M=2$。输入 $-0.01$、0、0.01对应输出 $-2$、0、2。输入从0.01增大到1，输出仍为2；输入缩小但保持正号时输出也不同比缩小。这说明继电器的输出等级不等于输入增益关系。

若输入为小幅噪声并频繁跨过0，理想输出也会在 $\pm2$ 之间频繁切换。作为对照，带迟滞继电器可设阈值 $\pm0.5$，在带内保持旧状态；对于始终位于 $(-0.5,0.5)$ 的噪声，它不会因每次过零而切换。这个对照并不说明任意噪声都会被迟滞消除，跨过两阈值仍能触发切换。

取带迟滞模型初态 $-2$，输入从0到0.6后输出变为2，再返回0仍保持2；理想无迟滞模型在0处按本卡约定输出0。两种模型的同一输入得到不同结果，原因是切换规则和状态不同，不能只用“继电器”一词省略这些信息。

### 适用条件与边界

真实继电器或开关可能具有动作延迟、机械寿命、接点行为、驱动限制和不对称阈值。理想模型只保留有限等级切换，不代表所有物理细节。模拟其闭环行为时还需考虑对象动态及切换时刻处理。

描述函数可在附加假设下近似分析继电振荡，但继电输出一般含有高次谐波，不能把基波近似说成精确线性增益。输出限值也不能独立保证状态有界；某些对象对持续有限输入仍会积累状态。

### 常见误区

1. 把理想继电器与连续饱和曲线混同。
2. 忽略零输入处规则，却声称模型在所有点都已唯一确定。
3. 因输出只有两个有限等级，就推断闭环不会振荡或发散。

### 自检

1. 本例输入0.01与1时，理想输出是否相同？
2. 加入双阈值迟滞后，输入回到0时是否必须输出0？

**核对要点**：两者都为2；带内保留旧等级，不必为0，需按状态和阈值规则决定。

### 关联节点

- **无记忆非线性**（入边，关系：前置于）
- **无记忆非线性**（出边，关系：属于）
