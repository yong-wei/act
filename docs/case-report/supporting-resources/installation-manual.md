# 安装手册

## 1. 环境要求

- Node.js 18 或以上。
- PostgreSQL 数据库。
- npm。
- Rust 工具链与 wasm-pack，用于构建 Rust/WASM 数值内核。
- 可选：Podman 或 Docker，用于服务器部署。

## 2. 本地安装

1. 安装依赖：`npm install`。
2. 配置 `.env`：至少包含 `DATABASE_URL`、`NEXTAUTH_SECRET`、`NEXTAUTH_URL`、`SILICONFLOW_API_KEY`。
3. 初始化数据库：`npx prisma generate`，随后执行 Prisma 迁移。
4. 构建 WASM 内核：`npm run wasm:build:control-engine`。
5. 启动开发服务：`npm run dev` 或使用项目启动脚本。
6. 打开浏览器访问本地端口，登录教师、学生或管理员账号进行验证。

## 3. 服务器部署

1. 在本机完成镜像构建。
2. 将镜像、部署脚本和 `course-content/runtime` 同步到服务器。
3. 服务器启动容器时执行 Prisma 迁移。
4. 通过健康检查确认应用、数据库和 Redis 可用。
5. 使用 HTTPS 域名访问，避免在公开视频中展示服务器内部地址。

## 4. 验证清单

- 登录与权限正常。
- 教师可以创建课堂，学生可以加入课堂。
- 互动事件能够写入。
- 仿真页面能够加载 3D 场景和数值内核。
- AI 助手在配置 API Key 后可正常响应。
- 个人中心和教师看板能展示能力画像或降级提示。

