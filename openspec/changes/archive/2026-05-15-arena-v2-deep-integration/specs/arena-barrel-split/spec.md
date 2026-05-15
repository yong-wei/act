## ADDED Requirements

### Req: create domain/client/server barrel files

必须新增：
- `src/features/arena/domain.ts` — types, seed selectors, capabilities, context, metric-mapping
- `src/features/arena/client.ts` — telemetry, client panels
- `src/features/arena/server.ts` — evaluator, persistence, prisma store, adapters

### Req: client files must not import from server barrel

`useMultiRepresentationLinkageModel`（client hook）和其他 `'use client'` 文件必须从 `@/features/arena/domain` 导入，不得从 `@/features/arena` 总入口导入 server 模块。

### Req: server routes must not import from client barrel

API route 文件（如 `/api/arena/evaluate`）必须从 `@/features/arena/server` 导入，不得导入 client 组件。

### Req: main index.ts kept for backward compatibility

`src/features/arena/index.ts` 保留为向后兼容入口，但添加注释标注导入方向（`// domain exports`、`// server exports`）。现有合法导入不应被破坏。

### Req: build verification

`npm run build` 必须通过，确保 barrel 拆分不引入循环依赖或模块解析错误。
