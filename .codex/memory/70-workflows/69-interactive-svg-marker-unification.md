# 互动课程 SVG Marker 统一

状态: active
最后更新: 2026-05-03
摘要: 记录互动课程图像标记统一的共享类、已确认的箭头形状参数、临时验收页和下一步迁移计划，避免后续继续在各单元 `step-panels.tsx` 中手写分散 marker。
上游:
- [00-index.md](/Users/YW/Documents/Site/act.just.edu.cn/.codex/memory/70-workflows/00-index.md)
下游: []
相关:
- [68-interactive-formula-and-runtime-media-guards.md](/Users/YW/Documents/Site/act.just.edu.cn/.codex/memory/70-workflows/68-interactive-formula-and-runtime-media-guards.md)
- [../40-domain/30-interactive-resources.md](/Users/YW/Documents/Site/act.just.edu.cn/.codex/memory/40-domain/30-interactive-resources.md)

## 结论

互动课程中的 SVG 箭头、圆点、菱形和极点叉应统一从共享 marker 类消费，不再在各单元内重复手写 `<marker>`。共享实现位置是：

- `src/features/interactive/shared/interactive-svg-markers.tsx`
- 临时验收页：`src/app/review/unit-5-2-arrow-markers/page.tsx`
- 浏览器地址：`/review/unit-5-2-arrow-markers`

## 已确认的共享能力

共享类当前提供：

- `InteractiveSvgMarkerRegistry`
- `InteractiveSvgMarkerDefs`
- `InteractiveSvgPointMarker`
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

## 下一步迁移计划

下一阶段应把互动课程中分散定义的 SVG marker 迁移到共享类。优先范围：

- `src/features/interactive/unit-5-2-nonlinear-analysis-entry/step-panels.tsx`
- `src/features/interactive/unit-3-6-zero-design-workshop/step-panels.tsx`
- `src/features/interactive/shared/lesson-entry-knowledge-map.tsx`
- `src/resources/interactive-learning/control-odyssey/components/TuningPanel.tsx`

迁移原则：

- 先保留当前视觉语义，再替换实现来源。
- 每个 SVG 内放置 `InteractiveSvgMarkerDefs`，用 `InteractiveSvgMarkerRegistry.markerUrl(...)` 引用。
- 对曲线和箭头，传入实际 `lineStrokeWidth`，不要硬编码 marker 大小。
- 对起点、极点、交点等点标，优先使用 `InteractiveSvgPointMarker`。
- 先迁移 review/课程图形相关 SVG，不把 Canvas 和 Three.js 的箭头强行纳入同一轮。
