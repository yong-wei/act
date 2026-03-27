# 自动控制题库

本目录保存《自动控制原理》项目内可检索、可精修的结构化题库。

## 目录结构

- `source/`
  - 原始题库 DOCX，只读主源
- `questions/`
  - 每题一份 Markdown 与一份 JSON
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

## 脚本

抽取：

```bash
python3 course-content/questions/scripts/extract_docx_question_bank.py
```

建索引：

```bash
python3 course-content/questions/scripts/build_question_indexes.py
```

查询：

```bash
python3 course-content/questions/scripts/query_question_bank.py --query "液位 方框图" --limit 5
```
