# audit-remediation-action-status-contract Evidence

日期：2026-06-21
OpenSpec change：`audit-remediation-action-status-contract`
关联 issue：#611

## 覆盖范围

本变更建立跨角色动作状态基础合同，不关闭具体业务页面的垂直缺陷。后续学生、教师、管理员、AI、移动端整改必须消费该合同后，才能把报告中的具体 status/live 问题标记为已修复。

## 代表性审计证据

- `chapters/54-function-state-flows-batch46.md`：课堂码错误、模板下载、配置保存、治理加载均缺少 `alert/live`；第 297 项记录 23 个动作状态 `alerts=0`。
- `chapters/64-function-state-flows-batch56.md`：治理导出、配置 provider 测试和方法边界缺少可恢复状态；第 419 项记录 27 个状态缺少 `alert/live`。
- `chapters/65-function-state-flows-batch57.md`：教师报告导出、治理 resolve/export、配置 model test 缺少下载事件和状态；第 431 项记录 32 个状态缺少 `alert/live`。
- `chapters/66-function-state-flows-batch58.md`：报告反馈写回、下载/发送、评分审批、治理分派、模型测试无状态闭环；第 442 项记录 33 个动作缺少 `alert/live`。
- `chapters/67-function-state-flows-batch59.md`：教师移动长报告导出、评分审批、管理员导出/治理/配置测试仍无完成或失败状态。

## 代码证据

- `src/lib/action-status-contract.ts`：定义 `AuditedActionState`、动作类别、状态生命周期、route query action 解析、API 400/403/404/405/500 映射和下载文件状态。
- `src/components/platform/action-status.tsx`：提供 `ActionStatusPanel`，保留 `role=status` / `role=alert`、`aria-live`、动作类别/status 数据属性、恢复动作和下一步。
- `docs/audit-remediation-action-status-contract.md`：规定后续垂直整改如何消费基础合同，以及关闭审计项前必须补 DOM 或浏览器证据。

## 验证记录

```bash
rtk npm run test:unit -- src/lib/__tests__/action-status-contract.test.ts src/app/__tests__/action-status-panel.test.ts
```

结果：2 个测试文件、9 个用例通过，覆盖 pending、success、failure、blocked、unsupported、download 状态，以及 `action=test` 映射、下载缺失文件名保护、`role=status` / `role=alert` 和 `aria-live` 渲染。

```bash
rtk npm run lint
```

结果：通过，0 warning。

## 未关闭项

本证据不关闭各章节中具体页面的 P1/P2 缺陷。报告反馈、教师报告导出、评分审批、治理导出/处置、配置模型测试、移动页面状态等需要后续垂直变更逐项接入并补验收。
