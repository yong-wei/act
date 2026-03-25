# Ten Drops Scroll Fix

## Goal
- 修复十滴水选关弹窗无法滚动的问题，并校正关卡信息显示

## Scope
- In-scope items
  - 扩展 Tailwind content 覆盖 resources/features 目录
  - 修正选关列表的“步数”显示为初始水滴
- Out-of-scope items
  - 玩法规则与动画逻辑改动
  - 关卡数据重构与新增

## Steps
1) 更新 `tailwind.config.ts` 的 content 路径，确保 Ten Drops 相关类名进入构建
2) 修正 `LevelSelector` 中关卡信息展示字段
3) 运行 lint/test/build（及必要的集成测试），并总结结果

## Tests
- npm run lint
- npm run test
- npm run build
- npm run test:integration

## Acceptance
- 选关弹窗在独立页面可正常滚动
- 关卡信息不再显示旧“步数限制”字段
- 代码通过 lint/test/build（及集成测试）
