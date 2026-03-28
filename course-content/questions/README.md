# 自动控制题库

本目录保存《自动控制原理》项目内可检索、可精修的结构化题库。

## 目录结构

- `source/`
  - 原始题库 DOCX，只读主源
- `questions/`
  - 每题一份 Markdown 与一份 JSON
- `objective-bank/`
  - 面向自适应推荐的纯文本客观题题库制品（JSONL、索引、总览）
- `assets/`
  - 每题配图，按题号分目录归档
- `indexes/`
  - JSONL、SQLite、标签索引、章节索引
- `reports/`
  - 抽取与清洗异常报告
- `schemas/`
  - 单题与索引条目 schema
- `scripts/`
  - 抽取、建索引、查询脚本

## 单题文件约定

每道题使用同名的 `.md` 和 `.json`：

- `AC-Q-0001.md`
- `AC-Q-0001.json`

Markdown 文件固定包含以下结构：

1. frontmatter
2. `## 题面`
3. `## 答案解析`
4. `## 行内得分点`
5. `## 评分指南`
6. `## 元数据`

其中：

- `题面` 用于单独提取出题干
- `答案解析` 用于单独提取解析
- `行内得分点` 用于保留原题解中的逐步标分
- `评分指南` 用于给课程制作、作业制作、命题技能提供独立 rubric

常用状态字段：

- `figure_status`: `complete | source_missing | text_reference_only | none`
- `formula_status`: `clean | mixed`
- `usage_status`: `raw | cleaned | verified | publish_ready`

`reports/extraction-report.json` 会同时输出：

- `missing_figure_questions`: 缺图题总数
- `source_missing_questions`: 已识别到图题、但源 DOCX 无可导出图对象的题数
- `text_reference_only_questions`: 仅在题面文字中引用示意图、未形成独立图题的题数
- `figure_status_breakdown`: 全量图状态分布

兼容旧脚本时仍会保留 `title_only_figures` 字段，但应优先读取上述新字段。

## 客观题题库约定

`objective-bank/` 用于保存不依赖外挂图片、适合检索与自适应推荐的客观题制品。目前 `icourse-bank-bankType4.*` 为来自 `iCourse163` 的选择/填空题纯文本导出，固定包含：

- `*.jsonl`
  - 每行一题，保留 `question_kind`、`choice_mode`、`correct_answers`、`knowledge_tags`、`source_bundle`、`adaptive_metadata`
- `*.index.json`
  - 题量、题型分布、标签统计
- `*.overview.md`
  - 便于人工抽查的全量题目总览
- `*.errors.json`
  - 排除题与未解析项报告

这些客观题与 `questions/AC-Q-*.json` 解析题并列存在，前者优先服务自适应题库与推荐，后者优先服务课程设计、讲义和作业制作。

## 脚本

抽取：

```bash
python3 course-content/questions/scripts/extract_docx_question_bank.py
```

建索引：

```bash
python3 course-content/questions/scripts/build_question_indexes.py
```

客观题纯文本导出：

```bash
python3 course-content/questions/scripts/build_icourse_objective_bank.py \
  --repair-root tmp/icourse-question-bank-repair \
  --formula-map tmp/icourse-formula-map.complete.json \
  --output-root course-content/questions/objective-bank \
  --bank-slug icourse-bank-bankType4
```

查询：

```bash
python3 course-content/questions/scripts/query_question_bank.py --query "液位 方框图" --limit 5
```
