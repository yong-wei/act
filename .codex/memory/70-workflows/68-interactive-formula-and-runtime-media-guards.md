# 互动课公式渲染与 runtime 媒体护栏

状态: active
最后更新: 2026-04-19
摘要: 记录互动课实现中两类高频回归点：React + KaTeX 公式字符串误写，以及正式页面误回读 authoring 媒体路径。该文件回答“为什么公式会出现双反斜杠渲染错误”“为什么正式页图片会丢”“修复时应该检查哪些点”。
上游:
- [00-index.md](/Users/YW/Documents/Site/act.just.edu.cn/.codex/memory/70-workflows/00-index.md)
下游: []
相关:
- [../60-incidents/00-index.md](/Users/YW/Documents/Site/act.just.edu.cn/.codex/memory/60-incidents/00-index.md)
- [../40-domain/20-premium-courses.md](/Users/YW/Documents/Site/act.just.edu.cn/.codex/memory/40-domain/20-premium-courses.md)
- [../../notes/4-2.md](/Users/YW/Documents/Site/act.just.edu.cn/notes/4-2.md)

## 结论

- 在 React + `react-katex` 场景中，公式字符串必须直接写成普通 TypeScript 字符串中的 LaTeX 命令，例如 `\\frac`、`\\mathrm`；不要再使用 `String.raw` 叠加双反斜杠去“保真”。
- 互动课正式页面引用图片时，只允许读取 `course-content/runtime/lessons/<lesson>/media/...` 导出的 runtime 路径；不要直接回读 `course-content/authoring/lessons/<lesson>/media/processed/...`。

## 关键事实

### 1. 公式双反斜杠错误的真实根因

- 事故场景：`4-2` 的客船、平台与前馈页面曾多次出现公式不渲染或显示原始命令。
- 触发方式：在 JSX 中把公式写成 `String.raw` 模板字符串，再额外写 `\\frac`、`\\mathrm` 这类双反斜杠命令。
- 根因：`String.raw` 会保留反斜杠本身；再叠加双反斜杠后，传给 KaTeX 的就不再是期望的 `\frac`，而是字面量双反斜杠序列。
- 修复方式：直接使用普通字符串字面量，例如 `'P_h(s)=\\frac{...}{...}'`，让 JS 转义一次后再交给 KaTeX。

### 2. 正式页图片缺失的真实根因

- 事故场景：`4-2` 的输入前馈、扰动前馈页和案例入口页曾出现图片缺失或误读作者态资源。
- 触发方式：页面组件直接引用 `course-content/authoring/lessons/4-2/media/processed/...` 或沿用其他课次的静态 PNG 路径。
- 根因：正式页面运行于 runtime-first 入口，媒体实际应由 runtime 导出目录提供；authoring 路径既不稳定，也会绕开运行态资源索引与审查链。
- 修复方式：全部改为 `/course-runtime/lessons/4-2/media/...`，并确保 `review_lesson_content.py` 与 runtime 导出链已经生成目标文件。

## 实施检查清单

- 编写 KaTeX 公式时：
  - 使用普通字符串，不用 `String.raw`
  - 只保留 JS 级转义，不再做人为“加倍转义”
  - 修改后至少跑一次目标课次聚焦测试或构建，确认无类型/渲染回归
- 接图片或结构图时：
  - 先确认该资源已进入 runtime 目录
  - 页面中只写 `/course-runtime/lessons/<lesson>/media/...`
  - 不复用其他课次的旧静态 PNG 作为正式实现替代
- 收工前：
  - 搜索是否还残留 `String.raw` 形式的公式常量
  - 搜索是否还残留 `course-content/authoring/lessons/.../media/processed` 的正式页面引用

## 建议下一步

- 若再次出现“公式正常字符串看似没问题但页面仍渲染异常”，优先检查公式是否混入 Markdown/KaTeX 的双重转义链。
- 若再次出现“runtime 媒体引用正确但页面仍缺图”，优先检查 runtime 导出是否成功、文件名是否与媒体索引一致，以及页面是否误用了旧步骤编号。
