# Objective Bank

本目录保存面向自适应推荐的纯文本客观题题库制品，不与 `questions/AC-Q-*.json` 解析题混用。

## 当前题库

- `icourse-bank-bankType4.*`
  - 来源：`iCourse163 bankType=4`
  - 题量：`226`
  - 题型分布：单选 `96`、多选 `129`、填空 `1`

## 文件说明

- `*.jsonl`
  - 每行一题，作为正式导入与检索主文件
- `*.index.json`
  - 题量、题型分布、标签统计
- `*.overview.md`
  - 便于人工抽查的全量总览
- `*.errors.json`
  - 排除题、未纳入题与异常记录

## 字段约定

- `question_kind`
  - `single | multiple | fill_blank`
- `choice_mode`
  - 仅对选择题存在
  - `single` 表示单选，`multiple` 表示多选
- `correct_answers`
  - 正确选项键数组，例如 `["B"]` 或 `["A", "D"]`
- `correct_answer_count`
  - `correct_answers` 的数量
- `options`
  - 选择题选项数组，元素固定为 `{ key, text, is_correct }`
- `knowledge_tags`
  - 供检索、推荐和后续数据库标签映射使用
- `source_bundle`
  - 来源平台、来源题号、题库类型等追溯信息
- `adaptive_metadata`
  - 面向后续自适应引擎接入保留的元数据
- `search_text`
  - 拼接后的检索文本

## 与解析题题库的边界

- `questions/AC-Q-*.json` 主要服务课程设计、讲义、作业与命题。
- `objective-bank/*.jsonl` 主要服务自适应推荐、快速检索与后续数据库入库。
- 同一来源题若被整理为客观题，不要求同时生成解析题单题文件。

## Schema

- 单题契约：[`../schemas/objective-question.schema.json`](/Users/YW/Documents/Site/act.just.edu.cn/course-content/questions/schemas/objective-question.schema.json)
- 索引契约：[`../schemas/objective-index.schema.json`](/Users/YW/Documents/Site/act.just.edu.cn/course-content/questions/schemas/objective-index.schema.json)

## 重建命令

```bash
python3 course-content/questions/scripts/build_icourse_objective_bank.py \
  --repair-root tmp/icourse-question-bank-repair \
  --formula-map tmp/icourse-formula-map.complete.json \
  --output-root course-content/questions/objective-bank \
  --bank-slug icourse-bank-bankType4
```
