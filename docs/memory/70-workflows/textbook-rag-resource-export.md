# Textbook RAG Resource Export

状态: active
最后更新: 2026-06-19
摘要: 记录外部教材 Markdown 与图片作为 ACT RAG 真源进入 `course-content/authoring/resources/textbooks/` 的稳定目录结构、命名约定和验证要求。当前已导入 Dorf/Bishop《Modern Control Systems》前三章，且教材数据目录只作为主工作树本地数据使用，不进入 Git 跟踪。
上游:
- [00-index.md](00-index.md)
下游:
- []
相关:
- [55-resource-library-integration.md](55-resource-library-integration.md)

## 结论

教材级 RAG 真源放在主工作树本地目录：

```text
course-content/authoring/resources/textbooks/<book-id>/
```

该目录用于本地 RAG 数据，不作为仓库跟踪内容。当前主工作树通过 `.git/info/exclude` 本地排除：

```text
/course-content/authoring/resources/textbooks/
```

不要把教材正文和图片放在 `act-resource` 等隔离工作树中作为可提交资源；隔离工作树无法和主工作树共享这类本地数据目录。

对于已经按章节转换的教材，采用章节二级目录：

```text
course-content/authoring/resources/textbooks/
  dorf-modern-control-systems/
    manifest.json
    textbook.md
    chapter-01/
      manifest.json
      textbook.md
      assets/
        fig-01-01.png
        fig-01-02.png
    chapter-02/
      manifest.json
      textbook.md
      assets/
        fig-02-01.png
        img-chapter-02-001.png
    chapter-03/
      manifest.json
      textbook.md
      assets/
        fig-03-01.png
```

根 `textbook.md` 是章节索引，不承载整本正文。章节正文在各自 `chapter-XX/textbook.md` 中，章节图片全部在同级 `assets/` 中。

## 当前已导入教材

```text
book_id: dorf-modern-control-systems
title: Modern Control Systems
authors: Richard C. Dorf; Robert H. Bishop
edition: 14th Global Edition
target_root: course-content/authoring/resources/textbooks/dorf-modern-control-systems/
```

当前章节：

| Chapter | Source pipeline | Markdown | Images |
|---|---|---:|---:|
| 1 Introduction to Control Systems | PyMuPDF4LLM + Gemma postprocess | `chapter-01/textbook.md` | 56 |
| 2 Mathematical Models of Systems | MathpixPlus | `chapter-02/textbook.md` | 214 |
| 3 State Variable Models | MathpixPlus | `chapter-03/textbook.md` | 90 |

## 导出规则

- 复制最终 RAG Markdown，不复制中间 OCR Markdown。
- 重写所有图片链接为章节内相对路径：`assets/<file>`。
- 图片文件名优先使用 Figure 编号：
  - `Figure 2.3` -> `fig-02-03.png`
  - `Figure E2.7` -> `fig-e02-07.png`
  - `Figure AP1.1` -> `fig-ap01-01.png`
- 同一 Figure 多张图时追加序号，如 `fig-02-03-02.png`。
- 无法从邻近 caption 解析 Figure 编号时使用顺序 fallback：`img-chapter-02-001.png`。
- `manifest.json` 记录章节路径、图片路径、图片 SHA-256、源转换目录、QA 摘要和导出计数。
- 不在 ACT 仓库 manifest 中写入本机绝对 DocProcess 路径；来源路径使用 `20260617-Control-textbooks/...` 这类 DocProcess 相对路径。

## 验证要求

导入后至少验证：

1. 每个 `chapter-XX/textbook.md` 的图片链接都是相对路径。
2. Markdown 中没有 `cdn.mathpix.com`、`http://`、`https://` 或本机绝对图片链接。
3. 每个图片链接对应的文件存在于同章 `assets/`。
4. 根 `manifest.json` 的章节计数与实际章节目录一致。
5. 章节 manifest 的 `imageCount` 与 Markdown 图片链接数一致。
6. `git status --short` 不显示 `course-content/authoring/resources/textbooks/`。

当前前三章验证结果：

```text
chapter-01: 56 image links, 56 assets
chapter-02: 214 image links, 214 assets
chapter-03: 90 image links, 90 assets
total: 360 images
```

## 后续章节追加

继续导入后续章节时，不要新建第二套教材目录；追加到同一 `dorf-modern-control-systems/` 根目录下：

```text
chapter-04/
  manifest.json
  textbook.md
  assets/
```

然后更新根 `manifest.json`、根 `textbook.md` 和本记忆文件中的当前章节表。
