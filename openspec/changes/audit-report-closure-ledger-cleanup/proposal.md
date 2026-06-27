## Why

最新审计状态台账仍把课前包 P0 finding 132/133 留在未关闭集合中，但归档的 `audit-remediation-p0-stability` 已经覆盖并验证这些阻断。需要先清理报告映射，否则后续整改会重复开工。

## What Changes

- 复核审计报告关闭台账与归档 evidence 的映射。
- 将已由归档变更覆盖的 P0 课前包 finding 从未关闭集合移出，并记录证据路径。
- 补充报告维护规则，要求后续整改区分“实现未闭环”和“关闭映射漏标”。

## Capabilities

### New Capabilities
- `product-design-audit-ledger`: 维护全系统 Product Design 审计报告的 finding 状态、关闭依据和映射卫生。

### Modified Capabilities
- None.

## Impact

只影响审计报告和 OpenSpec 规格；不修改产品运行时。
