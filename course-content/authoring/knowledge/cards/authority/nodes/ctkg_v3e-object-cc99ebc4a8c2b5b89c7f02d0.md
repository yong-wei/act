---
node_id: ctkg_v3e-object-cc99ebc4a8c2b5b89c7f02d0
authority_entity_id: "ctkg:v3e-object-cc99ebc4a8c2b5b89c7f02d0"
name: "饱和特性"
name_en: "Saturation Characteristic"
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
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-7ea03b7326258c9f8aa235d4070755cdcdebf29aeb1bdc44c498d64142c53e03.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-7ea03b7326258c9f8aa235d4070755cdcdebf29aeb1bdc44c498d64142c53e03.json"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-core-27a/previous/ctkg_v3e-object-cc99ebc4a8c2b5b89c7f02d0.md"
asset_refs: []
---

## 首页
# 饱和特性 | Saturation Characteristic

一句话定义：饱和特性是元件输入继续增大而输出受上限约束的输入输出关系，通常由线性区和两侧限幅区组成。

- 线性区增益与输出限值共同决定输入阈值。
- 幅值限幅与变化率限幅属于不同模型。
- 限幅后的实际执行量应与控制器指令分开记录。

---
## 详情
### 完整解释

对称静态饱和可写为 $y=\operatorname{clip}(ku,-M,M)$，其中 $k>0$ 为线性区斜率，$M>0$ 为输出最大幅值。输入满足 $|u|<M/k$ 时，输出为 $ku$；越过阈值后输出保持 $\pm M$。该函数连续，但在阈值处有折点。

若输入与输出单位不同，$k$ 带有相应单位。输出上限不能未经换算直接当成输入阈值。一般器件还可能有不对称上、下限，本卡使用对称形式说明概念，并不要求实际执行器必须对称。

### 教学计算/推理例

设 $k=2$、$M=1$。正向输入阈值为0.5。输入0.2、0.5、0.8时，输出依次为0.4、1、1；输入 $-0.8$ 时输出为 $-1$。输入从0.8降回0.2，输出为0.4，不保留先前的饱和输出。

在线性区内，输入增加0.1会使输出增加0.2；已处于正饱和区时，输入再增加0.1却不改变输出。因此不能用同一个常数增益在全范围预测增量。控制器若要求输出1.6，执行器实际只给1，二者差0.6并不是计算误差，而是模型明确规定的约束结果。

再考虑单位斜率限幅器和积分状态 $\dot z=1$、$z(0)=0$。3秒时 $z=3$，限幅后的实际量为1。这个规定误差持续存在的演算展示指令与执行量的差异；它没有给出完整闭环响应，也不能据此断言某一对象的超调大小。状态累积属于积分器，静态饱和曲线本身仍无记忆。

### 适用条件与边界

实际执行器的输出可能不能瞬时跟随静态曲线，还存在时间常数或变化率上限。比如“最大输出1”与“每秒最多改变1”是两个不同约束，前者限制幅值，后者限制速度。若任务需要两者，应分别建模。

饱和改变闭环中实际生效的控制关系。局部未饱和设计的稳定性结论不必自动延伸到大幅输入；是否出现慢恢复、振荡或积分累积，需要结合对象和控制器状态。采取抗饱和措施也应明确如何处理积分状态，而不是仅把输出clip一次就声称问题已解决。

### 常见误区

1. 输出上限为1就把输入阈值也写成1，忽略增益2。
2. 将静态限幅与限速混为一个约束。
3. 看控制指令而不看实际执行量，误以为线性控制始终实现。

### 自检

1. 本例输入0.8时，无限幅指令与实际输出分别是多少？
2. 输入从饱和区回到0.2时，该无记忆模型是否保留旧输出？

**核对要点**：指令1.6、实际1；回到线性区后输出0.4，不保留旧值。

### 关联节点

- **等效增益**（无向，关系：相关）
