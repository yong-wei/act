# 知识图谱 JSON 格式规范

> **状态**：✅ 已基于现有数据确认格式
> **更新日期**：2026-03-09
> **数据文件**：`data/knowledge_graph.json`（612节点）+ `data/relations.jsonl`（16219条关系）
> **新增暂存**：`data/new_nodes.jsonl` + `data/new_relations.jsonl`（每课新增写此处）

---

## 数据架构说明

现有图谱采用**节点与关系分离**的设计：
- **节点**：存储在 `knowledge_graph.json` 的 `nodes` 字典中，key 为节点ID
- **关系**：存储在 `relations.jsonl`，每行一条关系，关系使用节点 **name**（非ID）作为 source/target 引用
- **注意**：节点中的 `prerequisites` 和 `related_concepts` 字段在现有数据中均为空列表，关系信息完全依赖 `relations.jsonl`

---

## 节点格式（增强版）

```json
{
  "id": "传递函数_2_a3f8c921",
  "name": "传递函数",
  "name_en": "Transfer Function",
  "category": "概念性",
  "knowledge_type": "C",
  "bloom_level": "理解",
  "chapter": 2,
  "chapter_name": "系统模型",
  "module": "1",
  "unit": "1-1",
  "definition": "在零初始条件下，线性时不变系统输出量的拉氏变换与输入量的拉氏变换之比。",
  "examples": [
    "弹簧-质量-阻尼系统的传递函数 G(s) = 1/(ms²+cs+k)",
    "RC电路的传递函数 G(s) = 1/(RCs+1)"
  ],
  "formulas": [
    "G(s) = Y(s)/X(s)|_{零初始条件}",
    "G(s) = C(sI-A)^{-1}B + D（状态空间形式）"
  ],
  "prerequisites": ["拉氏变换", "线性时不变系统"],
  "related_concepts": ["零极点", "特征方程", "频率特性"],
  "difficulty": 3,
  "importance": 5,
  "keywords": ["拉氏变换", "零初始条件", "零极点", "复频域"],
  "tags": ["建模基础", "复频域方法"],
  "created_at": "2026-03-09T14:00:00+08:00",
  "updated_at": "2026-03-09T14:00:00+08:00"
}
```

### 字段说明

| 字段 | 类型 | 必填 | 说明 |
|------|------|:----:|------|
| `id` | string | ✅ | 格式：`{name}_{chapter}_{md5前8位}`，如 `传递函数_2_a3f8c921` |
| `name` | string | ✅ | 中文节点名称，关系文件中以此为引用键 |
| `name_en` | string | — | 英文名称（新增字段，旧节点无此项） |
| `category` | enum | ✅ | `概念性` / `程序性` / `事实性` |
| `knowledge_type` | enum | — | `C`（计算型）/ `X`（跨域型）/ `D`（设计型）/ `框架` / `前沿`（新增字段） |
| `bloom_level` | enum | ✅ | `记忆` / `理解` / `应用` / `分析` / `评价` / `创造` |
| `chapter` | int | ✅ | 传统教材章节编号（1-10），保持向后兼容 |
| `chapter_name` | string | ✅ | 传统章节名称（见章节映射表） |
| `module` | string | — | 重构大纲模块（`0`/`1`/`2`/`3`/`4`/`复习`）（新增字段） |
| `unit` | string | — | 重构大纲单元编号，如 `1-1`、`P-3`（新增字段） |
| `definition` | string | ✅ | 简明定义（1-3句话） |
| `examples` | list | — | 工程实例列表 |
| `formulas` | list | — | LaTeX 公式列表 |
| `prerequisites` | list | — | 前置概念名称列表（与关系文件 `prerequisite` 类型冗余，建议填写） |
| `related_concepts` | list | — | 相关概念名称列表 |
| `difficulty` | int | — | 难度 1-5（1最简单） |
| `importance` | int | — | 重要度 1-5（5最重要） |
| `keywords` | list | — | 关键词列表 |
| `tags` | list | — | 标签列表，用于检索分类（新增字段） |
| `created_at` | string | — | ISO 8601 时间戳 |
| `updated_at` | string | — | ISO 8601 时间戳 |

---

## 关系格式

```json
{
  "relation_id": "传递函数|拉氏变换|2",
  "source": "传递函数",
  "target": "拉氏变换",
  "source_chapter": 2,
  "target_chapter": 2,
  "relation_type": "prerequisite",
  "strength": 0.9,
  "label": "传递函数基于拉氏变换定义",
  "run_id": "manual"
}
```

### 关系类型枚举

| 类型 | 含义 | 示例 |
|------|------|------|
| `related` | 弱关联（相关但关系不明确） | 传递函数 → 状态空间 |
| `applies_to` | A 应用于 B | 劳斯判据 → 稳定性分析 |
| `contains` | A 包含 B（组成关系） | PID控制器 → 比例环节 |
| `leads_to` | A 引出/导致 B | 极点位置 → 系统稳定性 |
| `prerequisite` | A 是 B 的前置知识 | 拉氏变换 → 传递函数 |
| `opposite` | A 与 B 相对/相反 | 开环控制 → 闭环控制 |
| **`cross_domain`** | **A 与 B 跨域映射**（[X]类关键关系） | 阻尼比 → 相位裕度 |
| **`generalizes`** | **A 泛化 B**（A比B更通用） | 频域分析 → Bode图 |
| **`instance_of`** | **A 是 B 的实例** | 船舶航向控制 → PID控制 |

> **粗体**为新增关系类型，对重构大纲的[X]类跨域型知识尤为重要。

---

## 传统章节与大纲模块映射

| 章节 | 章节名 | 节点数 | 对应大纲模块 |
|:----:|--------|:------:|------------|
| Ch1 | 基本概念 | 61 | 模块0 |
| Ch2 | 系统模型 | 63 | 模块1 |
| Ch3 | 时域分析 | 72 | 模块1-2 |
| Ch4 | 根轨迹分析 | 49 | 模块2 |
| Ch5 | 频域分析 | 60 | 模块2 |
| Ch6 | 系统校正 | 44 | 模块3 |
| Ch7 | 离散系统 | 70 | （重构大纲未涵盖） |
| Ch8 | 非线性系统 | 61 | 模块4 |
| Ch9 | 状态空间 | 79 | （重构大纲精简涉及） |
| Ch10 | 状态空间（最优控制） | 53 | 模块4（MPC部分） |

---

## 欠缺节点（需在创作中补充）

以下主题在现有612节点中**完全缺失**，创作相关单元时需新增：

| 主题 | 相关单元 | 建议节点数 |
|------|----------|:----------:|
| 船舶航向控制（工程场景） | 全课程贯穿 | 3-5个 |
| 卡尔曼滤波/状态估计 | 4-2 | 2-3个 |
| MASS控制链路 | 4-2 | 4-6个 |
| 数据驱动MPC | 4-4 | 3-4个 |
| NeuralODE | 4-4 | 2个 |
| Pareto前沿/多目标优化 | 4-3 | 2-3个 |
| 三域联动（跨域映射综合节点） | 2-5, P-7 | 3-4个 |

---

## 查询工具使用

```bash
# 快速统计
python3 scripts/kg_query.py stats

# 按章节查看节点
python3 scripts/kg_query.py chapter 2
python3 scripts/kg_query.py chapter "系统模型"

# 搜索节点
python3 scripts/kg_query.py search 传递函数

# 查看某节点的完整信息+关系
python3 scripts/kg_query.py node 传递函数

# 查看某大纲单元相关的现有节点
python3 scripts/kg_query.py unit 1-1

# 检查特定概念是否已有节点
python3 scripts/kg_query.py missing 船舶 MASS 卡尔曼滤波
```

## 新增节点工具使用

```bash
# 新增单个节点（JSON参数）
python3 scripts/kg_add.py node '{"name":"船舶航向控制","category":"概念性","knowledge_type":"D","bloom_level":"应用","chapter":1,"chapter_name":"基本概念","module":"0","unit":"0-1","definition":"...","keywords":["船舶","工程场景"]}'

# 批量新增
python3 scripts/kg_add.py batch_nodes '[{...},{...}]'

# 新增关系
python3 scripts/kg_add.py relation '{"source":"船舶航向控制","target":"PID控制器","relation_type":"instance_of","strength":0.9}'

# 查看已新增内容
python3 scripts/kg_query.py new
```
