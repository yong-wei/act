# 系列作业汇编工作流

## 触发条件

用户明确说某系列全部题目已完成，例如：
- "T1系列完成了"
- "汇总T2系列作业"
- "生成T3作业文档"
- "把T1-1到T1-4整理成作业"

## 前提检查

在开始汇编前，确认以下条件满足：

1. 确认题号范围：从 `course-content/syllabus-refactor/homework-framework.md` 读取该系列包含的所有题号（如 T1 系列含 T1-1、T1-2、T1-3、T1-4）。
2. 确认各题最终产物存在：检查 `.tmp/homework-problem-authoring/<QUESTION_ID>/final/final-package.md` 均存在。
3. 如有缺失，告知用户哪些题号尚未完成，不继续汇编。

## 汇编步骤

### Step 1：提取各题题面

从每道题的 `final/final-package.md` 中提取：
- 题面文本（含图片引用）
- 该题所有图片：`.tmp/homework-problem-authoring/<QUESTION_ID>/selected/assets/`

从 `homework-framework.md` 读取该系列的作业标题（如"作业 1：系统认知与项目选题"）。

### Step 2：生成图片目录

在 `course-content/authoring/shared/homework-problems/assets/T{n}/` 下创建系列图片目录，将各题 `selected/assets/` 中的图片复制到该目录。

建议命名规范：`T{n}-{题序号}-{原文件名}`（如 `T1-2-bode-plot.png`），避免不同题目图片同名冲突。

### Step 3：生成学生版 `T{n}.md`

**内容：只含题面，不含答案、评分标准、参考作答。**

格式：

```markdown
# 作业 N：{从 homework-framework.md 读取的作业标题}

## 第 1 题（T{n}-1）

{题面内容，图片引用改为相对路径 assets/T{n}/...}

---

## 第 2 题（T{n}-2）

{题面内容}

---
...
```

图片引用路径需更新为相对 `homework-problems/` 目录的路径（`assets/T{n}/T{n}-{题序号}-{文件名}.png`）。

存储位置：`course-content/authoring/shared/homework-problems/T{n}.md`

### Step 4：生成教师版 `T{n}S.md`

**内容：完整题面 + 标准答案 + 分步评分标准 + 参考作答。**

从每道题的 `final/final-package.md` 提取全部内容。格式同学生版，但每道题后附完整解析：

```markdown
## 第 N 题（T{n}-m）

### 题面

{题面内容，含图片}

### 标准答案

{标准答案}

### 评分标准

{分步评分标准}

### 参考作答

{参考作答}

---
```

存储位置：`course-content/authoring/shared/homework-problems/T{n}S.md`

### Step 5：转换为 docx

使用 pandoc 将两个 Markdown 文件转换为 docx：

```bash
# 学生版
pandoc course-content/authoring/shared/homework-problems/T{n}.md \
  --resource-path=course-content/authoring/shared/homework-problems/ \
  -o course-content/authoring/shared/homework-problems/T{n}.docx

# 教师版
pandoc course-content/authoring/shared/homework-problems/T{n}S.md \
  --resource-path=course-content/authoring/shared/homework-problems/ \
  -o course-content/authoring/shared/homework-problems/T{n}S.docx
```

转换后使用 PDF 预览或 LibreOffice 验证：
- 图片是否正确嵌入
- 公式是否正确渲染（pandoc 默认处理 `$...$`，如有问题加 `--mathml` 或 `--webtex` 参数）
- 排版是否整洁可读

### Step 6：完成报告

向用户汇报：
- 生成了哪些文件（路径）
- 图片数量和来源
- docx 转换结果（是否有渲染问题）

## 输出文件清单

```
course-content/authoring/shared/homework-problems/
├── T{n}.md          ← 学生版（Markdown）
├── T{n}.docx        ← 学生版（Word）
├── T{n}S.md         ← 教师版（Markdown）
├── T{n}S.docx       ← 教师版（Word）
└── assets/
    └── T{n}/
        ├── T{n}-1-{image}.png
        ├── T{n}-2-{image}.png
        └── ...
```
