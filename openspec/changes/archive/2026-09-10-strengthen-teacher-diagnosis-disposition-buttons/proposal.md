## Why

#2074 的补练资源移除已随 #2075 合入，但教师交付版处置按钮仍用半透明 `btn-disposition-*`（`bg-*/10`、`border-*/40`）。在默认深色主题和浅色主题下，按钮轮廓与背景接近普通文字，不满足重开后的视觉验收。

## What Changes

- 把处置按钮改成默认态即可辨认的实色按钮：可见边框 + 非透明背景，不再依赖半透明叠色。
- 「待处理」用警示色，「已完成处置」用成功色，「已查看」用中性实色，「进入备课工作台」用主色导航按钮。
- 当前已记录处置除文案外，在对应按钮上提供 `aria-pressed` 与非颜色单一依赖的选中提示。
- 覆盖 hover / active / focus-visible / disabled / 记录中；浅色与夜间主题都保持轮廓。
- 增加浏览器级验收：断言 computed style 的非透明背景、可见边框和可见焦点，并保存浅色主题截图。
- 不改处置提交、幂等、审计、补练资源已移除的合同，也不重做整页。

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `teacher-diagnosis-report-delivery`：强化既有「处置按钮视觉层级」需求，明确实色按钮、选中态与浏览器级验收。

## Impact

- `src/app/globals.css`（`btn-disposition` 系列改为不透明）
- `src/features/teacher/diagnosis-report-delivery-view.tsx`（选中态 / `aria-pressed` / 备课主色）
- `src/features/teacher/__tests__/diagnosis-report-delivery-view.test.tsx`
- 新增或扩展 Playwright 浏览器断言与浅色截图
- 不改 `diagnosis-report-delivery.ts`、处置事件模型、PDF 打印排除合同
