# iCourse 题库 Repair Pack Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 为 `tmp/icourse-question-bank-bankType4.json` 生成独立的 repair pack，下载题干/选项公式图片，输出待人工修复的 Markdown 草稿与 manifest。

**Architecture:** 读取接口导出的结构化 JSON，以题目为单位解析 `titleHtml` 与 `options[*].contentHtml` 里的公式图片；图片按题目目录落盘，文本中替换为稳定占位符，再生成题目级 manifest 与总 manifest。整个流程只写入独立输出目录，不覆盖现有 `course-content/questions/questions/AC-Q-*` 题库。

**Tech Stack:** Python 3、标准库（`json`/`html.parser`/`urllib`/`pathlib`）、`pytest`

### Task 1: 实现最小 repair pack 生成器

**Files:**
- Create: `course-content/questions/scripts/prepare_icourse_question_bank_repair.py`
- Test: `course-content/tests/test_prepare_icourse_question_bank_repair.py`

**Step 1: 使用现有测试作为 failing test**

Run:

```bash
python3 -m pytest course-content/tests/test_prepare_icourse_question_bank_repair.py -q
```

Expected:

- 因缺少脚本文件而失败

**Step 2: 实现最小生产代码**

要求：

- 暴露 `build_repair_pack(input_path, output_root, image_fetcher=None)`
- 去重下载重复 URL
- 生成 `drafts/`、`images/`、`question-manifests/`、`manifest.json`
- 题干占位符命名 `stem-01`
- 选项占位符命名 `option-A-01`
- `choice_mode` 基于 `typeLabel` 或正确答案数量推导

**Step 3: 回跑单测**

Run:

```bash
python3 -m pytest course-content/tests/test_prepare_icourse_question_bank_repair.py -q
```

Expected:

- 测试通过

### Task 2: 对真实接口导出生成 repair pack

**Files:**
- Input: `tmp/icourse-question-bank-bankType4.json`
- Output: `tmp/icourse-question-bank-repair/`

**Step 1: 运行脚本处理真实数据**

Run:

```bash
python3 course-content/questions/scripts/prepare_icourse_question_bank_repair.py \
  --input tmp/icourse-question-bank-bankType4.json \
  --output-root tmp/icourse-question-bank-repair
```

Expected:

- 生成独立 repair pack
- 所有公式图片下载完成
- 总 manifest 给出题量、下载图片量和含公式题量

**Step 2: 抽检产物**

检查：

- Markdown 中是否存在稳定占位符
- 图片目录命名是否与 manifest 一致
- 正确答案与单选/多选标注是否可读

### Task 3: 启动首批人工修复

**Files:**
- Review: `tmp/icourse-question-bank-repair/drafts/*.md`
- Review: `tmp/icourse-question-bank-repair/question-manifests/*.json`

**Step 1: 选择首批高公式密度题**

优先：

- 题干与选项都含公式图的题
- 多选题
- 典型控制理论公式题

**Step 2: 在草稿中逐题把占位符替换为 LaTeX**

要求：

- 保留原始占位符索引，便于追溯原图
- 如公式含歧义，以图片视觉为准，并在 manifest/备注中记录

**Step 3: 记录阶段性结果**

输出：

- 已修复题目数
- 未决疑难样式
- 是否需要补充 OCR/视觉识别辅助
