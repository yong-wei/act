# Step 4：知识图谱节点设计规格

> 目标：从讲义内容中提取新知识节点，调用脚本写入课次分包，并生成配套知识卡片。

---

## 脚本位置

本技能的脚本位于 `scripts/` 目录（相对于技能文件夹）：
- `scripts/kg_query.py`：查询现有节点
- `scripts/kg_add.py`：写入新节点和关系

**注意**：运行脚本时需在项目根目录执行：
```bash
python3 .claude/skills/lesson/scripts/kg_query.py stats
python3 .claude/skills/lesson/scripts/kg_add.py batch_nodes '[...]'
```

---

## 目录结构规范

```
data/
  knowledge_graph.json          ← 全局底座，只读，不直接修改
  relations.jsonl               ← 全局底座，只读，不直接修改
  lessons/
    <lesson_id>/                ← 每课一个独立目录（如 L-2a/）
      manifest.json             ← 课次消费清单（平台直接读取）
      nodes.jsonl               ← 本课新增节点（仅新节点，不含已存在节点）
      relations.jsonl           ← 本课新增关系（双写 node_id + name）
  cards/
    nodes/
      <node_id>.md              ← 全局节点卡片库，文件名 = node_id
    lessons/
      <lesson_id>/
        sequence.json           ← 本课卡片出现顺序与分组
        overrides.json          ← 本课专属改写（无改写时为空对象 {}）
```

> **关于 new_nodes.jsonl / new_relations.jsonl**：这两个文件是 kg_add.py 的 staging
> 输出，仅供脚本暂存，**不是课程消费的数据源**。每课完成后，将其内容迁移到
> `data/lessons/<lesson_id>/` 对应文件，再清空 staging。

---

## Step 4 工作流

### 1. 查询本单元现有节点

```bash
python3 .claude/skills/lesson/scripts/kg_query.py search <关键词>
python3 .claude/skills/lesson/scripts/kg_query.py node <节点名>   # 获取精确 node_id
```

对讲义中每个拟建节点逐一搜索，区分：
- **已存在**：记录精确 `node_id`，仅设计关系
- **不存在**：插入新节点

### 2. 输出节点 JSON 草稿，与用户确认

输出完整 JSON（见格式规范），与用户确认后再写入。

### 3. 写入 staging（通过脚本）

```bash
python3 .claude/skills/lesson/scripts/kg_add.py batch_nodes '[{...}]'
python3 .claude/skills/lesson/scripts/kg_add.py batch_relations '[{...}]'
python3 .claude/skills/lesson/scripts/kg_query.py new   # 验证
```

### 4. 建立课次分包（`data/lessons/<lesson_id>/`）

将 staging 内容整理为课次分包文件（含双写 ID 的 relations.jsonl，见格式规范），
同时生成 `manifest.json`。

### 5. 生成知识卡片

为本课所有节点（新增 + 引用已有节点）生成 Markdown 卡片，存入 `data/cards/nodes/`，
再建 `data/cards/lessons/<lesson_id>/sequence.json`。

---

## 节点 JSON 格式

```json
[
  {
    "id": "<name>_<chapter>_<hash8>",
    "name": "节点名称",
    "name_en": "English Name",
    "category": "概念性|程序性|事实性",
    "knowledge_type": "C|X|D|框架|前沿",
    "bloom_level": "记忆|理解|应用|分析|评价|创造",
    "chapter": 3,
    "chapter_name": "时域分析",
    "module": "L",
    "unit": "L-2a",
    "definition": "简明定义（1-3句话）",
    "examples": ["工程实例1"],
    "formulas": ["LaTeX公式"],
    "prerequisites": ["前置概念名称"],
    "related_concepts": ["相关概念名称"],
    "difficulty": 3,
    "importance": 5,
    "keywords": ["关键词1"],
    "tags": ["层0速通"]
  }
]
```

## 关系 JSON 格式（双写规范）

**所有关系必须同时写 `source_id` / `target_id` 和 `source` / `target` 中文名**：

```json
[
  {
    "source_id": "阻尼比_3_b849784e",
    "source": "阻尼比",
    "target_id": "超调量_3_fc3f5b17",
    "target": "超调量",
    "relation_type": "leads_to",
    "strength": 0.95,
    "label": "ζ决定Mₚ，ζ越大Mₚ越小"
  }
]
```

> **原因**：`source`/`target` 名称日后可能改写；ID 是稳定锚点。
> 平台实现时按 ID 绑定图谱高亮，按名称提供可读展示。

### 有效关系类型

| 类型 | 含义 | 典型用途 |
|------|------|----------|
| `prerequisite` | 前置知识 | A 是学习 B 的前提 |
| `leads_to` | 导向 | A 引出 B（因果/递进）|
| `cross_domain` | 跨域映射 | [X] 类知识的核心关系 |
| `contains` | 包含 | A 是 B 的上位概念 |
| `generalizes` | 泛化 | A 是 B 的一般化形式 |
| `instance_of` | 实例化 | A 是 B 的具体实例 |
| `related` | 弱关联 | 相关但无明确方向 |

---

## manifest.json 规范

```json
{
  "lesson_id": "L-2a",
  "title": "单元标题",
  "graph_version": "612+2",
  "focus_node_ids": [
    "本课主讲节点的 node_id 列表（新增 + 深度引用的已有节点）"
  ],
  "reuse_node_ids": [
    "本课引用但不深讲的已有节点 node_id 列表"
  ],
  "focus_relation_ids": [
    "本课要在图谱中展示的关系 relation_id 列表"
  ],
  "entry_nodes": ["知识图谱页入口高亮节点 id（通常为本课核心概念）"],
  "summary_nodes": ["总结页收束节点 id"],
  "card_order": ["按课程步骤顺序排列的 node_id 列表"]
}
```

---

## 知识卡片规范

### 文件命名与存储

- 路径：`data/cards/nodes/<node_id>.md`（如 `阻尼比_3_b849784e.md`）
- 文件名 = `node_id`，不使用纯中文名
- 同一节点只有一份全局卡片；课次差异通过 `overrides.json` 处理

### Frontmatter 标准（必须包含）

```yaml
---
node_id: 阻尼比_3_b849784e
name: 阻尼比
name_en: Damping Ratio
lesson_units:
  - L-2a
category: 概念性
knowledge_type: C
chapter: 3
tags:
  - 层0速通
  - 时域分析
card_version: 1
source_docs:
  - authoring/lessons/legacy/L-2a/design/L-2a-handout.md
asset_refs: []
---
```

### 卡片正文结构（双页设计）

每张卡片分为**首页**和**详情页**两部分，以 `---` 分隔：

**首页（`## 首页`）**：不超过 PPT 一页的内容量
- 节点标题（中英文）
- 核心定义：一句话
- 最关键直觉：优先用图像（见下方"卡片图像规范"），无合适图像时用 2-3 行文字要点
- 关键公式：仅最核心的 1 条（若有）
- 关联节点速查：仅列出名称，不展开说明

> 设计约束：首页应能在课堂上独立传达该概念的精髓，学生扫一眼即可抓住要点。
> 不放表格、不放多条公式、不放详细说明。
> **禁止使用 ASCII 字符图形**——字符图形精度不足，容易产生歧义（如坐标方向错误），必须使用实际图像。

**详情页（`## 详情`）**：完整参考内容
- 完整直觉化解释（含图像引用，禁止 ASCII 字符图形）
- 完整公式推导路径（标注精化单元）
- 工程实例（船舶场景，含数值）
- 关联节点完整表（前置/后续/跨域）
- 常见误区（2 条）

### 卡片图像规范

卡片中的图像与讲义/互动课媒体**共享同一媒体库**，引用路径格式：

```markdown
![图注](../../lessons/<unit>/media/processed/<文件名>)
```

**图像分类与占位符写法**：

| 图像类型 | 判断标准 | 占位符写法 |
|----------|----------|-----------|
| 代码直出图 | 曲线、根轨迹、Bode图、几何图等可矢量化图形 | `![图注](../../lessons/<unit>/media/processed/<filename>.svg)` + 注释 `<!-- 待生成：代码直出 -->` |
| 位图（AI生成）| 示意图、场景图等无法代码直出的图 | `![图注](../../lessons/<unit>/media/processed/<filename>.png)` + 注释 `<!-- 待生成：AI位图 -->` |

**制作流程衔接**：
- Step 4 完成时，在卡片中写入带注释的图像占位符，并将图像需求登记到 `media/card-media-plan.md`（见下方格式）
- Step 7 媒体制作时，卡片图像需求与讲义/互动课图像需求统一处理，统一回写路径
- 若与讲义或互动课中已规划的图像相同，**直接复用**，不另起文件

**`media/card-media-plan.md` 格式**：

```markdown
# 卡片媒体需求清单

| 文件名 | 类型 | 图像描述 | 引用卡片 | 可复用自 |
|--------|------|----------|---------|---------|
| sh-01-xxx.svg | 代码直出 | ... | 节点名卡片首页 | handout §2.1（若已有） |
```

### 卡片模板

```markdown
---
node_id: <node_id>
name: <中文名>
name_en: <English Name>
lesson_units:
  - <lesson_id>
category: <概念性|程序性|事实性>
knowledge_type: <C|X|D|框架|前沿>
chapter: <数字>
tags:
  - <标签>
card_version: 1
source_docs:
  - <来源讲义路径>
asset_refs: []
---

## 首页

# <中文名> | <English Name>

**一句话定义**：<不超过30字的核心定义>

**直觉图**：
![图注](../../lessons/<unit>/media/processed/<filename>.svg)
<!-- 待生成：代码直出 / AI位图 -->

**关键公式**（若有）：
$$<最核心公式>$$

**关联**：前置 → <A> · 后续 → <B> · 跨域 → <C>

---

## 详情

### 完整解释

<详细直觉化解释，含 ASCII 示意>

### 公式与推导路径

<公式列表，标注精化单元>

### 工程实例（船舶航向控制）

<含数值的具体场景>

### 关联节点

| 方向 | 节点 | 关系说明 |
|------|------|---------|
| 前置 | ... | ... |
| 后续 | ... | ... |
| 跨域 | ... | ... |

### 常见误区

1. **误区**：... **纠正**：...
2. **误区**：... **纠正**：...
```

---

## sequence.json 规范

```json
{
  "lesson_id": "L-2a",
  "groups": [
    {
      "group_name": "引入",
      "step_ids": ["step-01", "step-02"],
      "node_ids": ["阶跃响应_10_47ad4df2"]
    },
    {
      "group_name": "核心概念",
      "step_ids": ["step-05", "step-06", "step-07"],
      "node_ids": [
        "四种响应家族_3_L2a",
        "阻尼比_3_b849784e",
        "自然频率_10_51a8b7d0"
      ]
    }
  ],
  "card_order": ["按步骤顺序排列的 node_id 列表"]
}
```

---

## 节点粒度判断依据

- 该概念有独立的定义（能用 1-3 句话清晰描述）
- 该概念能与其他概念建立有意义的关系
- 该概念在多个单元中复用，需要统一表述

---

## 结束提示

> "以上是本节课的知识图谱节点和卡片。请确认：节点粒度是否合适？关系双写 ID 是否准确？
> 卡片首页内容量是否合适（≤ PPT 一页）？确认后进入 BOPPPS 课案设计（Step 5）。"
