## Context

#2075 已删除补练资源匹配，并把 ghost 按钮换成 `btn-disposition`。现样式使用 `bg-primary/10`、`border-primary/40` 这类半透明 token。默认 `:root` 是深色卡片，叠色后边框和背景几乎看不见，浏览器里看起来仍像普通文字。

## Goals / Non-Goals

**Goals:**

- 处置按钮默认态同时具备清晰边框和非透明背景。
- 主要结论卡片与底部「报告处置」使用同一套色义。
- 已记录状态用 `aria-pressed` 加图标或实心态，不单靠颜色。
- 用真实页面 computed style 证明，不只靠 className。

**Non-Goals:**

- 不再改补练资源、remediation 契约或处置 API。
- 不重做整页布局。
- 不改打印排除规则。

## Decisions

1. **继续复用 `btn-disposition` 类，只改成不透明色。** 不新增组件库或按钮 primitive。
2. **备课入口单独用 `btn-disposition-primary`。** 它是导航，不是处置记录。
3. **选中态写在 `DispositionButton`。** 用当前 `latestByTarget` 对照 action，设置 `aria-pressed` 并加勾选图标。
4. **浏览器验收复用既有诊断交付 Playwright 夹具路由。** 不接真实班级 ID，不依赖 capture-gated 证据套件。

## Risks / Trade-offs

- 实色按钮比半透明更抢眼；用克制的状态色和统一高度，避免整页变彩条。
- Playwright 走夹具 API，证明的是样式计算，不是该复现 URL 的库内数据。合入前仍用真实报告页做一次人工核对。
