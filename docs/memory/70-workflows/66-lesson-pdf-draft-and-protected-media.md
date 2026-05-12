# 讲义草稿 PDF 与保留媒体流程

状态: active
最后更新: 2026-04-14
摘要: 记录 lesson 技能下“正文先成文、封面漫画与信息图后回写”的稳定流程，重点约束草稿 PDF 导出、最终 PDF 导出，以及 `cover-comic.png` / `info.png` 这类保留媒体文件名不得被代码直出脚本覆盖。
上游:
- [00-index.md](00-index.md)
- [30-content-update-flow.md](30-content-update-flow.md)
下游: []
相关:
- [/.codex/skills/lesson/SKILL.md](../../../.codex/skills/lesson/SKILL.md)
- [/.codex/skills/lesson/references/step3-handout.md](../../../.codex/skills/lesson/references/step3-handout.md)
- [/.codex/skills/lesson/references/step7-multimedia.md](../../../.codex/skills/lesson/references/step7-multimedia.md)
- [/.codex/skills/lesson/scripts/export_handout_pdf.py](../../../.codex/skills/lesson/scripts/export_handout_pdf.py)

## 结论

- 讲义正文先成文、封面漫画与信息图后回写，是 lesson 技能的正常流程，不应再通过“伪造正式图片文件”来让第一次 PDF 导出通过。
- 第一次给 NotebookLM、封面提示词或信息图制作使用的 PDF，必须导出为草稿 PDF，而不是覆盖正式 `handout.pdf`。
- `[单元编号]-cover-comic.png` 与 `[单元编号]-info.png` 属于保留媒体文件名；任何 `Octave`、`Python/matplotlib` 或批量复绘脚本都不得把它们作为输出目标。

## 标准顺序

1. 讲义正文先按正式结构写完，并保留：
   - `![封面漫画：单元导入](../media/processed/<unit>-cover-comic.png)`
   - `![本讲信息图总结](../media/processed/<unit>-info.png)`
2. 若封面漫画和信息图尚未完成，但需要先导出一版 PDF 给 NotebookLM 或后续提示词制作，执行：

```bash
python3 .codex/skills/lesson/scripts/export_handout_pdf.py \
  --draft-mode \
  course-content/authoring/lessons/<unit>/design/handout.md
```

3. `--draft-mode` 只允许在临时目录生成占位图，并输出 `handout-draft.pdf`；不得向 `media/processed/` 回写假的 `cover-comic.png` 或 `info.png`。
4. 用户或外部生成流程完成 `cover-comic.png` 与 `info.png` 后，再执行不带 `--draft-mode` 的正式导出，生成 `handout.pdf`。
5. 最终验收前确认：
   - `handout.pdf` 不是草稿文件名
   - `media/processed/<unit>-cover-comic.png`
   - `media/processed/<unit>-info.png`
   均为真实成品，而不是脚本占位图

## 强约束

- 代码直出脚本必须显式列出允许写入的数值图文件名；允许写入列表中不得包含：
  - `cover-comic.png`
  - `info.png`
  - `intro-video.mp4`
  - `slides.pdf`
  - `audio.m4a`
- 若脚本需要批量复绘，只能复绘数值图、结构图等代码直出媒体；课程级 AI 成品名和待审查成品名默认全部视为只读。
- 若需要检查“作者态图片是否被渲染脚本误覆盖”，优先增加哈希校验，而不是靠人工目测文件大小或视觉猜测。
