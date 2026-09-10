## 1. 实色按钮与选中态

- [ ] 1.1 将 `btn-disposition` 系列改为默认态可见的不透明边框与背景；新增备课用 `btn-disposition-primary`；覆盖 hover / active / focus-visible / disabled，并同时适配浅色与 `dark`。
- [ ] 1.2 `DispositionButton` 根据当前处置设置 `aria-pressed` 与非颜色选中提示；备课入口使用主色按钮；结论区与底部报告处置共用同一套类。
- [ ] 1.3 处置提交、幂等、审计与打印排除保持不变。

## 2. 测试与浏览器验收

- [ ] 2.1 更新 `diagnosis-report-delivery-view` 单元测试：断言实色类、`aria-pressed`、不渲染补练空态。
- [ ] 2.2 增加 Playwright：在真实浏览器中断言处置按钮 computed style（非透明背景、可见边框、可见焦点），并保存浅色主题截图。
- [ ] 2.3 `rtk npm run typecheck` 与 `openspec validate strengthen-teacher-diagnosis-disposition-buttons --type change --strict` 通过。
