---
node_id: ctkg_v3e-object-b0896b071da350e2cc6ca186
authority_entity_id: "ctkg:v3e-object-b0896b071da350e2cc6ca186"
name: "间隙特性"
name_en: "Backlash Characteristic"
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
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-8e06a9cbe38f7da0725ada8f61628f93895f1cb9ddf564e7073fd7ecd4f9fe71.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-8e06a9cbe38f7da0725ada8f61628f93895f1cb9ddf564e7073fd7ecd4f9fe71.json"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-core-27a/previous/ctkg_v3e-object-b0896b071da350e2cc6ca186.md"
asset_refs: []
---

## 首页
# 间隙特性 | Backlash Characteristic

一句话定义：机械间隙特性描述传动换向时输入先消耗空隙、输出可能暂时保持原位的历史相关非线性。

- 相同输入位置可对应不同输出位置。
- 换向后的空行程与接触分支有关。
- 理想间隙模型不自动包含碰撞、弹性或惯性动力学。

---
## 详情
### 完整解释

采用一个明确的准静态间隙模型。设输入位置为 $u$、输出位置为 $y$，半间隙为 $d>0$，允许相对位移满足 $|u-y|\le d$。当输入变化仍使旧输出留在允许区间内时，输出保持；当输入越过该区间时，输出沿相应接触边界移动。

对每一段单调输入的端点，可写成

$$
y_{new}=\operatorname{clip}(y_{old},u-d,u+d).
$$

这里的clip表示把旧输出限制到当前允许区间，而不是直接对输入限幅。初态也必须满足间隙约束。输入若在两个采样点之间先上升再下降，不能仅用端点更新替代完整历史，需保留中间转向点。

### 教学计算/推理例

取半间隙 $d=1$、初态 $u=0,y=0$。输入沿单调分段依次到达0、2、1、0、$-2$、0、2，输出依次为0、1、1、1、$-1$、$-1$、1。

从输入2、输出1开始反向，输入降到1再降到0时，旧输出1仍位于允许区间，因此输出不动；继续向负方向超过0后，另一侧边界开始推动输出。这次换向从2到0消耗了总间隙 $2d=2$。输入到 $-2$ 时，输出为 $-1$。

输入为0时，初始输出为0，从正侧返回时输出可为1，从负侧返回时输出可为 $-1$。因此不能把输出写成唯一的无记忆函数 $f(u)$。这也是间隙与对称死区的根本区别：理想死区内输出固定为0，本模型间隙内输出保留旧位置。

### 适用条件与边界

该模型用准静态接触约束表达理想传动空隙，不计算接触碰撞速度、弹性变形、惯性或摩擦。若输出端存在独立负载动力学，间隙中输出未必静止，应使用更完整的机械模型。本卡“保持”是所选理想模型的规则，不是所有真实传动装置的普遍运动结论。

半间隙和总间隙应注明单位。旋转传动可用角度，线性机构可用位移；传动比不为1时还需换算坐标。初始分支未知时，仅知道输入不能唯一恢复输出，必须补充初始接触或输出位置。

### 常见误区

1. 将半间隙1误当成一次完整换向空行程1。
2. 把间隙内保持旧输出写成输出为0，退化成死区模型。
3. 使用只有位置历史的准静态模型，却声称已经模拟碰撞和弹性。

### 自检

1. 本例从输入2、输出1反向到输入0，输出是多少？
2. 输入0是否总对应输出0？

**核对要点**：输出保持1，到另一侧接触边界；同一输入可因历史不同对应0、1或 $-1$ 等允许值。

### 关联节点

- **死区**（无向，关系：相关）
- **自振荡**（无向，关系：相关）
- **等效增益**（无向，关系：相关）
