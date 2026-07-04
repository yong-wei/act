## Why

The platform currently has a shared `AppShell`, but route-level pages and feature wrappers still decide their own header actions, breadcrumb behavior, and sidebar mode. This is why Knowledge Graph, Interactive Learning, Learning Path, Arena, Virtual Simulation, Control Workbench, and Personal Center present different top-right actions and navigation behavior.

The design direction should be a single platform frame for every non-home application route: one left navigation model, one top bar, one breadcrumb convention, and one top-right action order.

## What Changes

- Define a universal AppShell frame contract for all non-home product routes.
- Require the canonical left navigation sequence everywhere: 首页, 知识资源, 互动学习, 学习路径, 竞技场, 虚拟仿真, 控制工作台, 个人中心.
- Require the top-right action area to render theme switch first and Personal Center second.
- Require non-home application routes to expose breadcrumbs through the unified shell.
- Define an exception inventory for routes that intentionally cannot use the full shell, such as auth, print, visual-review, or embed-only routes.
- Add static route inventory tests that fail when a non-exempt page bypasses the unified shell contract.

## Impact

- Establishes the contract that later migration changes must implement.
- Touches shell specs, route metadata, and route-governance tests.
- Does not migrate every page by itself; it creates the acceptance boundary for the migration series.
