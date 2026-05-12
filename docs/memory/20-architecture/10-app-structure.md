# 应用结构

状态: active
最后更新: 2026-03-19
摘要: 说明主要目录的职责边界，帮助快速判断代码应该放在哪里。
上游:
- [00-index.md](00-index.md)
下游: []
相关:
- [AGENTS.md](../../../AGENTS.md)

## 目录职责

- `src/app/`: Next.js 路由与页面入口
- `src/features/`: 平台功能域和课堂功能实现
- `src/resources/`: 教学资源、互动组件、虚拟仿真及其配套逻辑
- `src/components/`: 平台级共享 UI/Provider
- `src/lib/`: 平台通用工具、服务封装、课程运行时帮助函数
- `src/types/`: 平台通用类型

## 边界规则

- 平台框架代码优先放 `src/features`
- 教学资源实现优先放 `src/resources`
- 避免把资源实现细节塞进 `src/components`
- 管理员后台入口统一收口在 `src/app/admin`，其中 `/admin` 为总入口，具体能力页继续拆到下一级子路由，避免把后台能力散落到教师页或统计页侧边入口
