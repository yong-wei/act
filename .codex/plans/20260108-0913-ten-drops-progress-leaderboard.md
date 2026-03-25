# Ten Drops 进度与榜单

## Goal
- 修复十滴水飞行方向问题，记录并恢复用户关卡进度，展示关卡排行榜，新增“趣味探索”分类并收录十滴水

## Scope
- In-scope items
  - 修复水滴飞行方向（逻辑或动画）
  - 关卡进度：登录用户存库 + 访客 localStorage
  - 进入页面自动加载“最新未完成关卡”
  - 当前关卡全站用户排行榜（左侧面板，移动端折叠/置底）
  - 互动学习页面新增“趣味探索”分类并放入十滴水
  - 更新 docs/ProjectDescription.md
- Out-of-scope items
  - 玩法数值与关卡设计大改
  - AI 面板能力扩展

## Steps
1) 分析并修复水滴飞行方向问题（逻辑/动画）
2) 设计并实现进度与排行榜数据流（API/存储/客户端呈现），接入 Ten Drops 组件
3) 更新互动学习页面分类与文档，完成测试与验收

## Tests
- npm run lint
- npm run test
- npm run build
- npm run test:integration

## Acceptance
- 十滴水飞行方向符合规则与视觉
- 进入页面自动定位到最新未完成关卡
- 当前关卡左侧榜单可展示全站用户得分
- “趣味探索”分类可见且含十滴水
- 测试按要求完成（或说明失败原因）
