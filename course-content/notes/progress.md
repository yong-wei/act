# 课程创作进度笔记

> 本文件记录当前创作进度与每次会话的续接点。每次会话结束前更新。

---

## 当前进度快照

**更新时间**：2026-03-13
**技能版本**：lesson skill v2.2（含实践课支持，参考文件 references/practice-lesson.md）
**大纲版本**：SyllabusRefactor v3.0

### 已完成产出

| 单元 | 课型 | 讲义/实践任务书 | 教案 | 互动页面 | 多模态资源 | 知识图谱 |
|:----:|:----:|:--------------:|:----:|:--------:|:----------:|:--------:|
| L-2a | 理论 | ✅ | ✅ | ✅ | ✅ | ✅ |
| L-2b | 理论 | ✅ | ✅ | ✅ | ✅ | ✅ |
| L-2c | 理论 | ✅ | ✅ | ✅ | ✅（代码直出×5，AI图×1待生成） | ✅ |
| L-2d | 实践 | ✅（practice-guide.md + assessment-spec.md） | ✅ | ✅（14步骤，全前端绘制） | ✅（全前端绘制，无静态文件） | ✅ |

**L-2c 文件路径（全套）**：
- 讲义：`authoring/lessons/L-2c/design/handout.md`
- 教案：`authoring/lessons/L-2c/design/boppps.md`
- 互动页面：`authoring/lessons/L-2c/design/interactive-page.md`
- 多模态资源文档：`authoring/lessons/L-2c/design/multimedia.md`
- Python 脚本：`authoring/lessons/L-2c/media/raw/`（5个 .py + matplotlib_font.py）
- 知识图谱节点：`authoring/lessons/L-2c/graph/nodes.jsonl`（5个新节点）
- 知识图谱关系：`authoring/lessons/L-2c/graph/relations.jsonl`（12条关系）
- 知识卡片：`authoring/knowledge/cards/nodes/`（5张卡片）
- 设计决策备忘：`authoring/lessons/L-2c/notes/design-decisions.md`

**L-2d 文件路径（全套）**：
- 实践任务书：`authoring/lessons/L-2d/design/practice-guide.md`
- 评价量规：`authoring/lessons/L-2d/design/assessment-spec.md`
- 教案：`authoring/lessons/L-2d/design/boppps.md`
- 互动页面：`authoring/lessons/L-2d/design/interactive-page.md`
- 课次元数据：`authoring/lessons/L-2d/manifest.json`（含 practice_config，K_cr=42）
- 知识图谱节点：`authoring/lessons/L-2d/graph/nodes.jsonl`（2个新节点）
- 知识图谱关系：`authoring/lessons/L-2d/graph/relations.jsonl`（7条关系）
- 知识卡片：`authoring/knowledge/cards/nodes/三域联动操作体验_5_L2d001.md` + `临界增益体验_5_L2d002.md`
- 卡片排序：`authoring/knowledge/cards/lessons/L-2d/sequence.json`（4组，14步骤）

---

## L-2c 待办事项

| 项 | 说明 |
|----|------|
| `sh-00-equalizer-analogy.png` | AI 生图（Midjourney/DALL·E），提示词已在 multimedia.md 中，生成后放入 `media/raw/`，压缩版放入 `media/processed/`，interactive-page step-02 处引用路径已写入（待文件实际生成） |
| 执行 Python 脚本 | `cd authoring/lessons/L-2c/media/raw && python3 各脚本 --output ../processed/xxx.svg` |
| 下一单元 | L-2d（三域联动平台实操），本节多次提到"下节平台实操" |

---

## 当前会话工作记录（2026-03-13）

### L-2c 全套创作（7步完整流程）已完成

**关键设计决策**：

| 决策 | 结论 |
|------|------|
| ωc vs ωg 术语区分 | ωc=截止频率（幅频穿越0dB）用于γ；ωg=穿越频率（相频穿越-180°）用于Kg。贯穿所有文档5处强调 |
| 第一轮速通内容 | γ和Kg的直觉概念已在第一轮口头速通，L-2c用精确术语"接续"，不从零重建 |
| 互动页面知识密度 | 技能文件追加"知识传授与互动引导的平衡"——知识内容是主体，互动在知识完毕后出现 |
| 层0速通范围 | 不推导，但完整呈现直觉定义、类比、工程数值、跨域关系 |

### 续接下一会话：创作 L-∑（三域综合复习）

L-2d 已完整完成（收尾验证全部通过）。层0单元 L-2a/L-2b/L-2c/L-2d 均已完成。

下一单元：**L-∑**（三域综合复习，承接 L-2d 的对照表，正式提炼跨域约束边界）。

---

*上一进度快照（L-2a/L-2b 阶段）已归档于本文件历史版本*


**文件路径（L-2a 全套）**：
- 讲义：`notes/lessons/L-2a/handout.md`
- 教案：`notes/lessons/L-2a/boppps.md`
- 互动页面：`notes/lessons/L-2a/interactive-page.md`
- 多模态资源：`notes/lessons/L-2a/multimedia.md`（5项资源 + Python代码 + Midjourney提示词）
- 知识图谱节点：staging区（2个新节点 + 13条新关系）

---

## 当前会话工作记录（2026-03-10 晚间）

### 已完成

1. **Step 4：知识图谱节点（L-2a）**
   - 搜索确认：7个节点已存在（阻尼比、超调量、调节时间、上升时间、阶跃响应、自然频率、动态性能指标）
   - 新增节点 2 个：`四种响应家族`（[X]跨域型）、`二阶系统标准型`（[C]计算型）
   - 新增关系 13 条（leads_to × 6, contains × 6, related × 1）
   - 验证：staging区确认2节点+13关系，总图谱612节点不变

2. **知识卡片（L-2a 全节点）**
   - 创建 `data/cards/` 目录
   - 生成 7 张卡片（阶跃响应、阻尼比、自然频率、超调量、调节时间、上升时间、动态性能指标、四种响应家族、二阶系统标准型）
   - 每张卡片含：定义、直觉化解释、公式、工程实例、关联节点、常见误区

3. **Step 7：多模态资源设计（L-2a）**
   - 文件：`notes/lessons/L-2a/multimedia.md`
   - 5项资源：4幅 matplotlib 图（含完整Python代码草稿）+ 1幅 Midjourney 场景图
   - 制作优先级：P1（资源1,3,4）→ P2（资源2）→ P3（资源5）

4. **互动页面设计原则更新（技能文件 Step 6）**
   - 追加"页面布局原则——按需互动"
   - 新增：纵向布局优先（文本在上，互动在下）；无互动时显示纯文本/静态图片
   - 修改输出格式模板，废弃"左右分栏"描述，改为"纵向流式"说明

### 关键设计决策摘要（本会话追加）

| 决策 | 结论 |
|------|------|
| 知识图谱新节点 | 四种响应家族 + 二阶系统标准型（其余7个节点已存在）|
| 互动页面布局 | 纵向流式，文本在上，互动在下；无互动时全幅纯文本/图片 |
| 互动按需原则 | 不强制每页都有互动控件；静态知识展示页不加互动 |

---

## 下次会话续接点

**L-2a 全套已完成**，下次会话可选择：

**选项 A——推进 L-2b（根轨迹直觉速通）**：
- 开始创作 L-2b 讲义（根轨迹直觉层，前置：L-2a）

**选项 B——L-2c（频域直觉速通）**：
- 可跳过 L-2b 直接进入 L-2c，取决于教学顺序安排

**选项 C——批量处理资源**：
- 运行 `notes/lessons/L-2a/multimedia.md` 中的 Python 代码，生成实际图片文件

**阅读清单（续接时）**：
1. 本文件（progress.md）
2. `notes/lessons/L-2a/handout.md`（参考L-2a深度）
3. `docs/SyllabusRefactor.md`（查看 L-2b 单元设计）

---

---

## 2026-03-11 会话（下午）——方案 A：L-2a 知识数据迁移完成

### 已完成

**迁移操作**：将 L-2a 知识数据从分散的 staging 区重组为规范的"课次分包 + 规范卡片库"格式。

**新建文件（14个）**：

```
data/
  lessons/L-2a/
    manifest.json     ← 课次消费清单（9节点 + 13关系 + 叙事顺序）
    nodes.jsonl       ← 2个新节点（迁移自 staging）
    relations.jsonl   ← 13条关系（补写 source_id/target_id）
  cards/
    nodes/
      阶跃响应_10_47ad4df2.md
      四种响应家族_3_L2a.md
      动态性能指标_3_a10733c1.md
      超调量_3_fc3f5b17.md
      上升时间_3_6fa0ec00.md
      调节时间_10_fcbccf4e.md
      二阶系统标准型_3_L2a.md
      阻尼比_3_b849784e.md
      自然频率_10_51a8b7d0.md
    lessons/L-2a/
      sequence.json   ← 4组分组（引入/四族/三指标/两参数）
      overrides.json  ← 空对象（预留）
```

**修改文件（2个）**：
- `data/new_nodes.jsonl` → 已清空
- `data/new_relations.jsonl` → 已清空

**删除文件（9个）**：
- `data/cards/` 下 9 个中文命名 `.md` 文件（旧格式，无 frontmatter）

**卡片升级说明**：每张卡片新增 YAML frontmatter（含 node_id、name_en、lesson_units 等字段）+ 双页结构（首页浓缩精华 + 详情页完整内容）。

---

## ⚠️ 项目路径迁移提醒（下次会话必读）

**计划**：将本项目迁移到平台目录的下一级目录（路径待确认）。

**迁移后需检查的事项**：
1. CLAUDE.md 中的路径引用是否需要更新
2. 技能文件（`.claude/skills/lesson/`）是否随项目一起迁移
3. `notes/`、`data/`、`docs/` 等相对路径引用均在项目内，无需修改
4. 新路径对应新的记忆目录（旧记忆不会自动带过来，但本笔记文件会随项目迁移）

**状态**：待执行

---

## 下次会话续接点（更新）

**L-2a 数据迁移完成**，下次会话可选择：

**选项 A——推进 L-2b（根轨迹直觉速通）**：
- 开始创作 L-2b 讲义（根轨迹直觉层，前置：L-2a）

**选项 B——L-2c（频域直觉速通）**：
- 可跳过 L-2b 直接进入 L-2c

**选项 C——运行多模态资源脚本**：
- 运行 `notes/lessons/L-2a/multimedia.md` 中的 Python 代码，生成实际图片文件

---

---

## 2026-03-11 会话（下午）——方案 B：course-content 目录规范化迁移完成

### 已完成

**目标**：将分散在 `notes/`、`data/`、`docs/` 的内容迁移到 `course-content/`（即本项目根目录）的规范结构下，实现作者态（authoring/）与运行态（runtime/）分离。

**建立目录骨架**：
```
authoring/lessons/L-2a/{design,media/raw,media/processed,graph,cards/overrides,notes}/
authoring/knowledge/{base,overlays/L-2a,cards/{nodes,lessons/L-2a}}/
authoring/shared/{media-placeholders,templates,schema}/
runtime/{lessons/L-2a,knowledge,indexes}/
scripts/
```

**迁移文件（复制方式，原文件保留）**：
- 设计文档 4 份 → `authoring/lessons/L-2a/design/`
- 图谱数据 → `authoring/lessons/L-2a/graph/` 及 `authoring/knowledge/overlays/L-2a/`
- 9 张卡片 → `authoring/knowledge/cards/nodes/`
- sequence.json + overrides.json → `authoring/lessons/L-2a/cards/` 及 `authoring/knowledge/cards/lessons/L-2a/`
- 知识图谱基线 → `authoring/knowledge/base/`
- 大纲 + 图谱 schema → `authoring/shared/` 及 `authoring/shared/schema/`

**新建文件**：
- `authoring/lessons/L-2a/manifest.json`（课次元数据与路径索引）
- `authoring/lessons/L-2a/graph/card-refs.json`（9个节点ID的卡片引用列表）
- `authoring/knowledge/overlays/L-2a/nodes.jsonl` + `relations.jsonl`（图谱增量镜像）
- `README.md`（目录规范说明）
- `scripts/export-runtime.sh`（运行态导出占位脚本）

**技能文件更新**：`skills/control-lesson-creator.md` 升级至 **v1.5**
- Step 0：脚本路径改为 `.claude/skills/lesson/scripts/kg_query.py`；格式规范路径改为 `course-content/authoring/shared/schema/knowledge-graph-schema.md`；新增节点路径改为 `course-content/authoring/lessons/<unit>/graph/`
- Step 4：查询脚本改为 `.claude/skills/lesson/scripts/kg_query.py`；新节点/关系写入路径更新为 `course-content/authoring/lessons/<unit>/graph/`
- 文件保存规范：旧 `notes/lessons/` 树替换为新 `course-content/authoring/lessons/` 规范树

**保留（不删除）**：`notes/`、`data/`、`docs/` 原目录，作为历史备份。

**注意**：技能专用脚本 `scripts/kg_query.py` / `scripts/kg_add.py` 属于技能内置工具，不迁移、不修改路径。

---

## 下次会话续接点（更新）

**从 `course-content/authoring/lessons/` 开始工作**，下次会话可选择：

**选项 A——推进 L-2b（根轨迹直觉速通）**：
- 新建 `authoring/lessons/L-2b/` 目录
- 运行 `python3 course-content/scripts/kg_query.py unit L-2b` 查询相关节点
- 开始创作 L-2b 讲义

**选项 B——L-2c（频域直觉速通）**

**选项 C——运行多模态资源脚本**：
- 运行 `authoring/lessons/L-2a/design/multimedia.md` 中的 Python 代码，生成实际图片文件

---

## 历史会话进度

### 2026-03-09 会话
- 初始化项目结构
- 设计技能文件 v1.0
- 确认课程整体框架和单元划分讨论

### 2026-03-10 会话（上午）
- 更新技能文件至 v1.3
- 大纲重构至 v3.0
- 完成 L-2a 讲义（notes/lessons/L-2a/handout.md）
- 完成 L-2a 教案（notes/lessons/L-2a/boppps.md）

### 2026-03-10 会话（下午）
- 读取平台 cruise-classroom 代码，固化设计哲学到技能文件
- 更新技能文件至 v1.4（Step 6 重写）
- 完成 L-2a 互动页面（notes/lessons/L-2a/interactive-page.md）
- 18步骤，资源占位 R-1~R-7

### 2026-03-10 会话（晚间）
- 完成 L-2a 知识图谱节点（Step 4）：2新节点 + 13关系写入staging
- 生成 L-2a 知识卡片（data/cards/，7张）
- 完成 L-2a 多模态资源设计（Step 7）：5项资源，含Python代码草稿
- 更新 Step 6 参考：追加"按需互动"和"纵向布局"设计原则
- **L-2a 全套完成**：讲义 ✅ 教案 ✅ 互动页面 ✅ 多模态资源 ✅ 知识图谱 ✅

---

## 待办：零点专题（来自 L-2d 设计决策，2026-03-13）

**背景**：L-2d 选用三阶无零点系统，刻意回避零点影响，聚焦"极点↔三域"的纯净因果链。

**待设计专题**：在后续某课次（建议层2或层3的频域/根轨迹精化单元中）设计"零点的物理意义及其对系统的影响"小主题，包括：
- 零点对根轨迹形态的影响（分支吸引/排斥）
- 零点对频率特性的影响（相位超前网络的直觉来源）
- 非最小相位零点的特殊性

**建议插入单元**：3-2（超前校正）或 2-3（根轨迹精化）。届时可用 L-2d 的三阶系统为基础，加入零点后对比观察。
