# 项目总结

## 项目概览
该仓库同时包含静态页面与多个前端应用实现，主题集中在控制理论教学、船舶控制场景、AI助教、伦理决策与知识图谱等。多个技术栈并行存在，体现为同一主题的多版本探索，而非单一主线产品。

## 根目录静态站点
- 入口页面：`index.html`，以及多个历史版本（`*0316*`、`*0318*`）。
- 交互仿真：`pid-simulator.html`，由 `js/pid-simulator.js`（Chart.js）与 `css/pid-simulator.css` 驱动。
- 资源目录：`fig/` 存放图片，`css/` 与 `js/` 存放样式与脚本。

## 应用模块
- `ai-obe-platform/`
  - Next.js 14 + TypeScript + Tailwind + Radix/shadcn UI。
  - 核心页面位于 `src/app/`（首页、AI助教、伦理沙盒、知识图谱）。
  - 提供 Docker/Nginx 部署配置，`SETUP.md` 记录修复与安装说明。
- `my-next-app/`
  - Next.js + NextAuth + Prisma（SQLite）。
  - 页面位于 `src/app/(main)/`，数据库模型在 `prisma/schema.prisma`。
- `my-react-app/`
  - Vite + React + TypeScript + Tailwind。
  - 组件位于 `src/components/`，内容覆盖同一主题模块。

## 文档与规范
- `docs/ai-project-spec.md`：偏向 Next.js/Prisma/NextAuth/Tailwind 的严格开发规范。
- `docs/DevelopmentPlan.md`：偏向 React/Vite 的“控制理论图谱”SPA 规划。

## 运行方式（按子项目）
- Next.js 应用：在各自目录运行 `npm run dev`、`npm run build`、`npm run start`、`npm run lint`。
- Vite 应用：在 `my-react-app` 运行 `npm run dev`、`npm run build`、`npm run preview`。
- 静态页面：直接打开 `index.html`，或在根目录运行 `python -m http.server 8000`。

## 当前状态判断
仓库存在多套并行实现与规范文档，建议先确定一个主线方向（静态页 / Next.js / Vite），再归档或清理其他原型与重复说明，以降低维护成本并明确后续迭代目标。
