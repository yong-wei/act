# 互动课程 SVG Marker 统一

状态: active
最后更新: 2026-05-04
摘要: 记录互动课程图像标记统一的共享类、已确认的箭头形状参数、首轮生产迁移结果、守护测试与继续迁移入口，避免后续继续在各单元 `step-panels.tsx` 中手写分散 marker。
上游:
- [00-index.md](/Users/YW/Documents/Site/act.just.edu.cn/.codex/memory/70-workflows/00-index.md)
下游: []
相关:
- [68-interactive-formula-and-runtime-media-guards.md](/Users/YW/Documents/Site/act.just.edu.cn/.codex/memory/70-workflows/68-interactive-formula-and-runtime-media-guards.md)
- [../40-domain/30-interactive-resources.md](/Users/YW/Documents/Site/act.just.edu.cn/.codex/memory/40-domain/30-interactive-resources.md)

## 结论

互动课程中的 SVG 箭头、圆点、菱形和极点叉应统一从共享 marker 类消费，不再在各单元内重复手写 `<marker>`。生产页方向箭头统一使用 `arrow-slim-concave`；`arrow-open-wide-concave` 只保留给共享 registry 和评审页展示，不再作为生产课程默认箭头。

共享实现位置是：

- `src/features/interactive/shared/interactive-svg-markers.tsx`
- 临时验收页：`src/app/review/unit-5-2-arrow-markers/page.tsx`
- 浏览器地址：`/review/unit-5-2-arrow-markers`

## 已确认的共享能力

共享类当前提供：

- `InteractiveSvgMarkerRegistry`
- `InteractiveSvgMarkerDefs`
- `InteractiveSvgPointMarker`
- `INTERACTIVE_SVG_PRODUCTION_ARROW_KIND`
- `INTERACTIVE_SVG_LEGACY_REVIEW_ARROW_KIND`
- `getInteractiveSvgEChartsPointMarker`
- `getInteractiveSvgMarkerSize`
- `getInteractiveSvgMarkerStrokeWidth`

统一管理的 marker kind：

- `arrow-slim-concave`
- `arrow-open-wide-concave`
- `dot-filled`
- `dot-hollow`
- `diamond-filled`
- `diamond-hollow`
- `start-dot-filled`
- `start-dot-hollow`
- `pole-cross`

## 已确认的尺寸规则

默认尺寸与曲线线宽绑定：

- 细长收腰实心箭头：线宽 `7px` 对应 marker `32px`
- 宽开口箭头：线宽 `7px` 对应 marker 标称宽 `24px`
- 其他圆点、菱形、起始点和极点叉：线宽 `7px` 对应 marker `30px`

宽开口箭头因为形状很高，marker 视窗需要额外内边距，避免粗线宽时圆角被裁切：

- `viewBox="-7 -24 38 64"`
- `refX="11.4"`
- `refY="7.5"`
- `markerWidth = size * 1.58`
- `markerHeight = size * 2.67`

## 已确认的宽开口箭头形状

用户确认效果较好的宽开口箭头不是传统尖头箭头，而是弯钩式开口箭头。当前 path 为：

```svg
<path d="M1.2 -12.5 C6.15 5 20 7 22.2 7.5" />
<path d="M1.2 27.5 C6.15 10 20 8 22.2 7.5" />
```

该形状已在临时页中通过三种线宽接入曲线预览：

- 线宽 `5px`
- 线宽 `7px`
- 线宽 `9px`

确认过的问题与处理：

- 粗线宽时圆角看似消失，原因是 marker 视窗裁切，不是 `strokeLinecap="round"` 失效。
- 解决方式是放大 `viewBox` 和 marker 视窗，而不是改变箭头 path。

## 2026-05-04 首轮生产迁移结果

已完成首轮迁移，并通过测试、构建和浏览器抽查。当前已迁移范围：

- 4-1 入口知识图谱：`src/features/interactive/shared/lesson-entry-knowledge-map.tsx` 已去掉私有 `<marker>`，按 active/muted 两套 prefix 注入共享 `arrow-slim-concave`。
- 4-1 曲线共享层：`src/resources/control-system/charts/control-analysis-panels.tsx` 与 `control-bode-options.ts` 已用 `getInteractiveSvgEChartsPointMarker` 管理闭环极点、开环极点、开环零点、Nyquist `-1+j0` 与裕度交越点；`renderInteractiveHandle` 已改为 `InteractiveSvgPointMarker`，不再用私有 `div/span` 画圆点或叉号。
- 3-6 测速反馈结构图：`src/features/interactive/unit-3-6-zero-design-workshop/step-panels.tsx` 已改用共享细长箭头。
- 5-2 相平面与扰动边界：`src/features/interactive/unit-5-2-nonlinear-analysis-entry/step-panels.tsx` 已改用共享细长箭头和 `InteractiveSvgPointMarker`。实际浏览器验收页是 `step-06` 相平面与 `step-11` 微小扰动法，不是早期计划里的 `step-04 / step-07`。
- Control Odyssey 方框图：`src/resources/interactive-learning/control-odyssey/components/TuningPanel.tsx` 已用 active/muted 两套共享细长箭头。浏览器验收必须先进入星域选择，再点“配置并开始”进入实际控制界面；首屏导入页不会出现方框图。
- 评审页：`src/app/review/unit-5-2-arrow-markers/page.tsx` 保留宽开口箭头展示，并因 `InteractiveSvgPointMarker` 类型收窄为点标 kind 做了类型修正。
- 守护测试：新增 `src/features/interactive/__tests__/interactive-svg-markers.test.ts`，扫描生产路径，禁止私有 `<marker>`、禁止生产引用 `arrow-open-wide-concave`，并检查已迁移点标继续来自共享 helper。

## 已通过的验证

- `npm run test:unit -- src/features/interactive/__tests__/interactive-svg-markers.test.ts src/features/interactive/__tests__/control-analysis-core.test.ts src/features/interactive/__tests__/control-charts.test.tsx src/features/interactive/__tests__/unit-4-1-course.test.ts src/features/interactive/__tests__/unit-3-3-course.test.ts`
- `npm run test:unit -- src/features/interactive/__tests__/unit-3-6-course.test.ts src/features/interactive/__tests__/unit-5-2-course.test.ts src/features/interactive/__tests__/lesson-entry-knowledge-map.test.ts`
- `python3 course-content/scripts/review_lesson_content.py --lesson 4-1 --skip-export --strict-implementation-contract`
- `npm run lint`
- `npm run build`
- 静态审计：`rg -n "<marker" src/features/interactive src/resources --glob '!src/features/interactive/__tests__/**'` 只剩共享 registry；`arrow-open-wide-concave` 在生产路径中只剩共享文件。
- 浏览器抽查：4-1 入口知识图谱、4-1 `student/demo?step=step-04`、4-1 `step-05`、3-6 `step-08`、5-2 `step-06`、5-2 `step-11`、Control Odyssey 实际控制界面均通过；抽查同时确认页面内没有私有 marker。

## 当前工作树边界

本次 marker 迁移涉及的主要路径：

- `src/features/interactive/shared/interactive-svg-markers.tsx`
- `src/app/review/unit-5-2-arrow-markers/page.tsx`
- `src/features/interactive/shared/lesson-entry-knowledge-map.tsx`
- `src/features/interactive/unit-3-6-zero-design-workshop/step-panels.tsx`
- `src/features/interactive/unit-5-2-nonlinear-analysis-entry/step-panels.tsx`
- `src/resources/control-system/charts/control-analysis-panels.tsx`
- `src/resources/control-system/charts/control-bode-options.ts`
- `src/resources/interactive-learning/control-odyssey/components/TuningPanel.tsx`
- `src/features/interactive/__tests__/interactive-svg-markers.test.ts`
- `src/features/interactive/__tests__/unit-3-3-course.test.ts`
- `course-content/runtime/lessons/4-1/review/interactive-page-check.json`
- `course-content/runtime/lessons/4-1/review/interactive-manifest-audit.json`
- `course-content/runtime/lessons/4-1/review/source-manifest.json`

仓库仍有大量本轮之外的脏改动，例如 `5-4`、`5-5`、Rust nonlinear analysis、manifest runtime 和若干测试文件。继续处理或提交时必须先用 path-limited `git diff` / `git status --short -- <path>` 确认边界，不要把这些无关改动混入 marker 迁移提交。

## 后续迁移入口

首轮静态守护已经覆盖 `src/features/interactive` 与 `src/resources` 下的生产 TS/TSX 路径。后续若继续扩展：

- 先跑 `rg -n "<marker|markerEnd=|arrow-open-wide-concave|ROOT_LOCUS_POLE_SYMBOL" src/features/interactive src/resources`，确认新增残留。
- 审计 `2-2`、`4-4` 与 `src/resources/interactive-learning/lesson-*` 中的可见教学点标；只迁移语义点标，不动求和节点圆圈、透明点击热区、Canvas/Three.js 图形、lucide 图标、PNG/JPEG 媒体或文本箭头。
- 对 ECharts scatter 点标，优先使用 `getInteractiveSvgEChartsPointMarker`；对 SVG overlay 或真实坐标点，优先使用 `InteractiveSvgPointMarker`。
- 对每个 SVG 内的方向箭头，继续使用 `InteractiveSvgMarkerDefs` + `InteractiveSvgMarkerRegistry.markerUrl(INTERACTIVE_SVG_PRODUCTION_ARROW_KIND, prefix)`。

## 迁移原则

- 先保留当前视觉语义，再替换实现来源。
- 每个 SVG 内放置 `InteractiveSvgMarkerDefs`，用 `InteractiveSvgMarkerRegistry.markerUrl(...)` 引用。
- 对曲线和箭头，传入实际 `lineStrokeWidth`，不要硬编码 marker 大小。
- 对起点、极点、交点等点标，优先使用 `InteractiveSvgPointMarker`。
- 先迁移 review/课程图形相关 SVG，不把 Canvas 和 Three.js 的箭头强行纳入同一轮。
