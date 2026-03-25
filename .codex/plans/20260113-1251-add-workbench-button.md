# 添加教室工作台返回按钮

## Goal
- 在预置教案、新建教案、教学资源管理相关页面加入“返回教室工作台”按钮并统一跳转到指定地址。

## Scope
- In-scope items
  - 预置教案相关页面及其子页
  - 新建教案相关页面及其子页
  - 教学资源管理相关页面及其子页
  - 更新 `docs/ProjectDescription.md`
- Out-of-scope items
  - 其他功能性改动与视觉重构

## Steps
1) 定位相关页面/布局组件并确定可复用的按钮放置位置。
2) 在上述页面加入“返回教室工作台”按钮并指向 `http://localhost:3001/teacher`。
3) 更新项目说明文档并运行 lint/test/build/integration。

## Tests
- npm run lint
- npm run test
- npm run build
- npm run test:integration

## Acceptance
- 相关页面均出现“返回教室工作台”按钮且可正常跳转。
- 文档与测试状态已更新并可复现。
