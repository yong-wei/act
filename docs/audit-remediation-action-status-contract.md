# Audit Remediation Action Status Contract

本合同用于后续 Product Design 审计整改中的动作状态闭环。它不替代具体业务流程，只规定跨角色页面在执行保存、提交、筛选、导出、下载、发送、审批、写回、模型测试、治理处置和治理分派时必须暴露的状态形态。

## 使用边界

- 页面动作先用 `AuditedActionIdentity` 描述动作、来源路由和目标对象。
- URL 参数触发的动作使用 `parseRouteActionQuery`，不支持的 `action` 必须显示 `unsupported` 状态。
- API 返回使用 `mapApiActionResult` 或 `mapHttpStatusToActionFailure` 映射，400/403/404/405/500 不得静默吞掉。
- UI 使用 `ActionStatusPanel` 或等价组件展示，必须保留 `role=status` / `role=alert` 和 `aria-live`。
- 下载/导出动作必须记录浏览器 download 事件；若不能下载，则显示 blocked/failed/unsupported 状态和恢复动作。

## 后续垂直整改要求

每个后续业务整改在关闭审计报告中的 status/live 缺陷前，需要补充：

- 具体页面或 API 的动作状态适配。
- DOM 或浏览器证据，证明可见状态和 `aria-live`/`role` 行为存在。
- 审计报告对应章节的整改标注，链接到证据文件。

本基础合同仅关闭共享能力缺口；报告中已经记录的具体页面缺陷仍保持未关闭，直到对应业务变更消费本合同并完成验收。
