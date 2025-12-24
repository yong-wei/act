# AI 编程助手项目完整设计规范：现代化在线学习平台

## 前言

**致 AI 编程助手：**

本规范定义了“现代化在线学习平台”项目的所有技术标准、代码约定和开发模式。在为该项目生成任何代码、组件或功能时，**你必须严格遵守**以下所有规定。本规范的目标是确保代码风格统一、技术栈纯粹、项目结构清晰、安全可靠且长期可维护。

---

## 1. 核心技术栈 (Core Technology Stack)

所有开发工作必须基于以下技术栈。除非明确指示，严禁引入或使用此列表之外的同类技术。

- **主框架 (Framework):** **Next.js** (版本: 最新稳定版, 使用 **App Router**)
  - **职责:** 项目的整体结构、路由、服务端渲染 (SSR)、静态站点生成 (SSG) 和 API 接口。
- **UI 库 (UI Library):** **React** (版本: 最新稳定版)
  - **职责:** 构建用户界面的核心库，所有前端组件必须是 React 组件。
- **编程语言 (Language):** **TypeScript**
  - **职责:** 所有代码文件 (`.ts`, `.tsx`) 必须使用 TypeScript。必须为所有函数参数、返回值和复杂对象定义明确的类型。
- **样式方案 (Styling):** **Tailwind CSS**
  - **职责:** 唯一的 CSS 解决方案。所有样式必须通过 Tailwind 的功能类 (utility classes) 在 JSX 中实现。
- **UI 组件体系 (UI Component System):** **Shadcn/ui**
  - **职责:** 作为基础 UI 组件（如按钮、表单、卡片等）的来源。**必须**通过其 CLI (`npx shadcn-ui@latest add ...`) 添加组件，而不是从其他库复制或自行编写。
- **后端 API (Backend API):** **Next.js API Routes**
  - **职责:** 所有后端逻辑，如处理表单提交、数据库操作、调用外部服务等，都必须在 `app/api/` 目录下实现。
- **数据库 ORM (Database ORM):** **Prisma**
  - **职责:** 唯一的数据库交互工具。所有数据库查询和修改都必须通过 Prisma Client 完成。数据库 schema 在 `prisma/schema.prisma` 文件中定义。
- **认证与授权 (Authentication):** **NextAuth.js**
  - **职责:** 处理所有用户认证（登录、注册、会话管理、第三方登录）的唯一方案。
- **状态管理 (State Management):** **Zustand**
  - **职责:** 用于管理复杂的、跨组件共享的全局状态。对于简单的、组件内部的状态，应使用 React 的 `useState`。
- **代码质量 (Code Quality):**
  - **ESLint:** 用于代码规范检查。
  - **Prettier:** 用于代码格式化。所有提交的代码必须通过格式化。

---

## 2. 项目结构与代码约定

项目必须遵循以下目录结构和命名规范。

### 2.1. 目录结构
/
├── app/                      # Next.js App Router 核心目录
│   ├── (auth)/               # 路由组：认证相关页面（如登录、注册）
│   │   └── login/
│   │       └── page.tsx
│   ├── (main)/               # 路由组：需要用户登录后访问的主功能页面
│   │   ├── dashboard/        # 示例：仪表盘
│   │   │   └── page.tsx
│   │   └── layout.tsx        # 主功能页面的共享布局
│   ├── api/                  # 后端 API 路由
│   │   └── auth/             # NextAuth.js 路由
│   │   └── ...               # 其他业务 API
│   ├── layout.tsx            # 全局根布局
│   └── page.tsx              # 网站首页
├── components/               # 全局共享组件目录
│   ├── shared/               # 自定义的可复用业务组件（如 CourseCard, UserProfile）
│   └── ui/                   # 由 Shadcn/ui CLI 生成的 UI 基础组件
├── lib/                      # 辅助函数、工具函数、Prisma 客户端实例
│   ├── prisma.ts
│   └── utils.ts
├── prisma/                   # Prisma 配置文件
│   ├── schema.prisma         # 数据库模型定义
│   └── migrations/           # 数据库迁移记录
├── public/                   # 静态资源（图片、字体等）
├── styles/                   # 全局样式
│   └── globals.css           # 主要用于 Tailwind CSS 的基础指令
└── types/                    # 全局 TypeScript 类型定义
└── index.d.ts
### 2.2. 命名规范

- **文件和文件夹:** 全部使用 `kebab-case` (小写字母，单词间用 `-` 分隔)。例如: `user-profile`, `learning-path`。
- **React 组件:** 文件名使用 `kebab-case.tsx`，组件函数名使用 `PascalCase`。例如: 文件 `user-profile.tsx` 中定义 `export function UserProfile() {}`。
- **变量和函数:** 使用 `camelCase`。例如: `const userCount = 10;`。
- **类型和接口:** 使用 `PascalCase`。例如: `type UserProfile = { ... }`。

### 2.3. 组件设计原则

- **单一职责:** 每个组件只做一件事。
- **原子化:** 优先创建小而可复用的组件。
- **明确的 Props:** 所有组件的 Props 都必须有明确的 TypeScript 类型定义。
- **禁止默认导出:** 使用命名导出 `export function MyComponent() {}` 而不是 `export default MyComponent`，以保持一致性。
- **客户端/服务端组件:** 明确使用 `'use client'` 和 `'use server'` 指令，合理划分组件的运行环境。

---

## 3. 具体功能实现指南

### 3.1. 样式与 UI

- **严禁使用内联样式 (`style={{}}`) 或单独的 `.css`/`.scss` 文件进行组件样式设计。** 所有样式必须通过 **Tailwind CSS 类名**实现。
- 需要通用 UI 元素时（如 Button, Input, Card, Dialog），**必须**执行 `npx shadcn-ui@latest add [component-name]` 命令来添加，然后在 `components/ui` 目录中找到并使用它。

### 3.2. 数据与状态

- **本地状态:** 组件内部的简单状态（如表单输入、开关状态），使用 `React.useState`。
- **全局状态:** 跨页面、跨组件共享的复杂状态（如当前登录用户信息、全局学习进度），**必须**使用 **Zustand** 创建一个 store 来管理。
- **数据获取:** 服务端数据获取优先使用 Next.js 的 Server Components。客户端数据获取推荐使用 `SWR` 或 `React Query` (TanStack Query)。

### 3.3. 数据库操作

1.  **定义模型:** 在 `prisma/schema.prisma` 中定义数据模型。
2.  **生成迁移:** 运行 `npx prisma migrate dev --name <migration-name>`。
3.  **查询数据:** 在 `app/api/**/*.ts` 或 Server Components 中，从 `lib/prisma.ts` 导入 Prisma Client 实例进行数据库操作。**严禁**在客户端组件 (`'use client'`) 中直接导入和使用 Prisma Client。

---

## 4. AI 交互指令示例

为了让 AI 更好地理解你的意图并遵循本规范，请使用以下格式提问：

- **反面示例 (不要这样问):**
  - "帮我做个个人信息页。"
  - "写一个按钮。"

- **正面示例 (请这样提问):**
  - "**遵照设计规范**，创建一个用户信息展示页面，路径为 `app/(main)/profile/page.tsx`。该页面应为服务端组件，用于获取并展示当前登录用户的姓名和邮箱。用户信息通过 NextAuth.js 的 `getServerSession` 获取。"
  - "**遵照设计规范**，使用 **Shadcn/ui** 创建一个 `Dialog` 组件，用于确认删除课程。在 `components/shared/` 目录下创建一个名为 `delete-course-dialog.tsx` 的新组件，其中包含一个由 Shadcn/ui 生成的红色 `Button` 用于触发确认操作。"
  - "**遵照设计规范**，在 `app/api/courses/route.ts` 中创建一个 `POST` 方法，用于创建新课程。它应接收 `title` 和 `description` 字段，并使用 **Prisma Client** 将数据存入数据库。"

---

## 5. 安全强化规范 (Security Hardening)

**致 AI 编程助手：** 除了上述规范，所有开发工作还必须遵循以下安全准则，构建“纵深防御”体系。

### 5.1. 严格的输入验证 (Input Validation)

- **原则:** **永不信任任何来自客户端的输入。**
- **实施:** 所有 API Route 在执行核心逻辑前，**必须**使用 **Zod** 库对请求的 `body`、`query` 和 `params` 进行严格的结构和类型验证。
- **指令:**
  - 为每个接收输入的 API 端点定义一个 Zod schema。
  - 如果验证失败，必须立即返回 `400 Bad Request` 错误，并附带清晰的错误信息，**严禁**将未经验证的数据传递给后续的业务逻辑或数据库。
  - **示例代码（AI 需遵循此模式）:**
    ```typescript
    // in app/api/courses/route.ts
    import { z } from 'zod';

    const createCourseSchema = z.object({
      title: z.string().min(3).max(100),
      description: z.string().optional(),
    });

    export async function POST(request: Request) {
      const json = await request.json();
      const validation = createCourseSchema.safeParse(json);

      if (!validation.success) {
        return Response.json({ error: validation.error.formErrors }, { status: 400 });
      }

      // ...只有验证通过后，才能继续执行这里的逻辑
      // const { title, description } = validation.data;
      // ...
    }
    ```

### 5.2. 精细的授权与访问控制 (Authorization)

- **原则:** 认证（Authentication，你是谁）之后，必须进行授权（Authorization，你能做什么）。
- **实施:** 每个需要权限的 API 操作（特别是创建、修改、删除操作），**必须**在执行前检查当前登录用户是否有权执行该操作。
- **指令:**
  - 在处理请求时，首先通过 `NextAuth.js` 的 `getServerSession` 获取当前用户信息。
  - 然后，根据业务逻辑进行权限检查。例如：用户只能修改自己的个人信息，老师才能发布课程等。
  - 如果权限不足，必须返回 `403 Forbidden` 错误。
  - **示例逻辑:**
    ```typescript
    // 伪代码: 删除课程的 API
    // 1. 获取 session，确认用户已登录
    // 2. 从请求中获取 courseId
    // 3. 从数据库查询该课程信息，特别是课程的创建者 ID (authorId)
    // 4. if (session.user.id !== course.authorId) { return 403 Forbidden; }
    // 5. 执行删除操作
    ```

### 5.3. 输出编码与内容安全

- **原则:** 防御 XSS 的第二道防线是正确处理用户生成内容（UGC）的输出。
- **实施:**
  - **严禁使用 `dangerouslySetInnerHTML`**。如果确实需要渲染用户输入的富文本内容，**必须**使用 **DOMPurify** 等库对 HTML 进行严格的清理和消毒。
  - **配置内容安全策略 (CSP):** 在 `next.config.js` 中设置严格的 HTTP `Content-Security-Policy` 头部，限制浏览器只能从可信的来源加载资源（脚本、样式、图片等），这是防御 XSS 和数据注入攻击的强大武器。
- **指令:** 在 `next.config.js` 中添加类似以下的 CSP 配置：
    ```javascript
    const cspHeader = `
        default-src 'self';
        script-src 'self' 'unsafe-eval' 'unsafe-inline';
        style-src 'self' 'unsafe-inline';
        img-src 'self' blob: data:;
        font-src 'self';
        object-src 'none';
        base-uri 'self';
        form-action 'self';
        frame-ancestors 'none';
    `;

    module.exports = {
      async headers() {
        return [
          {
            source: '/(.*)',
            headers: [
              { key: 'Content-Security-Policy', value: cspHeader.replace(/\s{2,}/g, ' ').trim() },
              { key: 'X-Content-Type-Options', value: 'nosniff' },
              { key: 'Referrer-Policy', value: 'origin-when-cross-origin' },
            ],
          },
        ];
      },
    };
    ```

### 5.4. 依赖项与秘密管理

- **依赖项安全:**
  - **指令:** 定期运行 `npm audit` 或使用 GitHub 的 **Dependabot** 服务来扫描项目依赖，并及时修复已知的安全漏洞。
- **秘密管理 (Secrets Management):**
  - **指令:** **任何敏感信息**（数据库连接字符串、API 密钥、JWT 密钥等）**严禁**硬编码在代码中或提交到 Git 仓库。
  - **必须**使用环境变量。将敏感信息存储在 `.env.local` 文件中（此文件已在 `.gitignore` 中被忽略），并通过 `process.env` 在服务端代码中访问。
  - **必须**区分服务端和客户端变量。只有以 `NEXT_PUBLIC_` 为前缀的环境变量才会暴露给客户端浏览器。
