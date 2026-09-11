# Tasks: issue-2082-link-path-resource-evidence

## 1. 启动上下文透传

- [x] 1.1 在 `useResourceInteractionTracking`（或资源页载荷组装处）增加路径启动上下文通道：pathId/goalId/nodeId/resourceType 随事件载荷流动。
- [x] 1.2 资源页（`resources/[id]/page.tsx`）将已解析的 `resolveAdaptivePathLaunchReturnContext` 结果注入追踪载荷与完成请求。
- [x] 1.3 control-workbench 页解析路径启动参数（对齐资源页模式）。

## 2. 服务端写路

- [x] 2.1 execute 路由为 quiz 类型增加 governed resolver（对齐 lesson_step 模式），产出最小 evidenceRefs（sourceLogId/clientEventId + completionResult）。
- [x] 2.2 完成写路绑定 evidenceRefs 前校验节点成员与 resourceType（复用 `route.ts:108-122` 既有校验），伪造归属拒绝且不写证据。
- [x] 2.3 simulation/control_workbench 节点接通既有 governed resolver 写路，禁止自报完成；幂等键沿用既有机制。
- [x] 2.4 事件物化链透传路径归属字段；独立打开资源保持 standalone_resource 且无归属字段。

## 3. 回归测试

- [x] 3.1 路径内 quiz 100 分完成 → LearningPathExecution.evidenceRefs 非空、含路径归属、路径中心可追溯。
- [x] 3.2 路径内仿真完成 → governed SimulationRun 校验通过并写入 typed outcome ref；写路缺失场景不再客户端抛错。
- [x] 3.3 独立打开资源完成 → 保持 standalone_resource，无路径归属。
- [x] 3.4 页面浏览/视频停留/未评分完成 → 不生成 evidenceRefs、不提升为能力证据。
- [x] 3.5 伪造 pathId/nodeId 的完成请求 → 服务端拒绝且不落证据。

## 4. 验证

- [x] 4.1 `rtk npm run test:unit`（learning-paths 与 interactive 相关文件）与 `rtk npm run typecheck` 通过。
- [x] 4.2 `openspec validate issue-2082-link-path-resource-evidence --type change --strict` 通过。
