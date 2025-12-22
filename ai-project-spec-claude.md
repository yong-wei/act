# AI 编程助手项目规范：在线学习平台 AI 辅助构建指南

## 前言

**致 Claude Code AI 编程助手：**

本规范专为在线学习平台的 AI 辅助构建而设计，基于现有的 ai-project-spec.md 规范，结合项目实际情况和常见开发挑战。在进行任何代码生成、重构或问题解决时，**必须严格遵循**本规范。

## 1. 项目架构概述

### 1.1 双栈架构说明
- **主要应用：** `my-next-app/` - Next.js 14 + App Router 现代化平台
- **遗留应用：** `my-react-app/` - React + Vite 原型应用
- **静态资源：** 根目录 HTML 文件 - 早期原型文件

### 1.2 优先级原则
1. **优先使用 Next.js 应用**进行新功能开发
2. React 应用仅用于原型验证和特定场景
3. 逐步迁移 React 应用功能到 Next.js 应用

---

## 2. 核心技术栈与版本管理

### 2.1 技术栈锁定
#### Next.js 应用 (my-next-app/)
- **Next.js:** 14.2.3 (App Router)
- **React:** 18.2.0
- **TypeScript:** 5.x
- **Tailwind CSS:** 3.4.x
- **Prisma:** 6.11.0
- **NextAuth.js:** 4.24.11
- **Shadcn/ui:** 最新版本
- **Zustand:** 5.0.6
- **Zod:** 3.25.67

#### React 应用 (my-react-app/)
- **React:** 18.2.0
- **Vite:** 5.2.0
- **TypeScript:** 5.2.2
- **Tailwind CSS:** 3.4.3
- **React Router:** 6.30.1
- **Chart.js:** 4.5.0
- **Three.js:** 0.178.0

### 2.2 版本依赖管理策略
```bash
# 安装依赖前检查
npm audit
npm list --depth=0

# 版本锁定
npm ci  # 生产环境使用，确保版本一致性
npm install --package-lock-only  # 更新 package-lock.json

# 依赖更新策略
npm outdated  # 检查过时依赖
npm update --save  # 谨慎更新依赖
```

### 2.3 常见版本冲突解决
1. **React 18 与旧版本插件冲突**
   ```bash
   npm install --legacy-peer-deps  # 临时解决方案
   # 或升级插件到兼容版本
   ```

2. **TypeScript 版本冲突**
   ```bash
   npm install --save-dev @types/react@^18.2.0
   npm install --save-dev @types/react-dom@^18.2.0
   ```

3. **ESLint 配置冲突**
   ```bash
   npm install --save-dev eslint@^8.57.0
   npm install --save-dev @typescript-eslint/eslint-plugin@^7.2.0
   ```

---

## 3. 项目结构规范

### 3.1 Next.js 应用结构 (my-next-app/)
```
my-next-app/
├── src/
│   ├── app/
│   │   ├── (auth)/              # 认证路由组
│   │   │   └── login/
│   │   │       └── page.tsx
│   │   ├── (main)/              # 主功能路由组
│   │   │   ├── dashboard/
│   │   │   ├── ai/              # AI 助教模块
│   │   │   ├── ethics/          # 伦理模块
│   │   │   ├── knowledge/       # 知识库模块
│   │   │   ├── pid-simulator/   # PID 仿真器
│   │   │   ├── argument-principle/ # 幅角原理
│   │   │   ├── background/      # 后台管理
│   │   │   ├── personal/        # 个人中心
│   │   │   └── layout.tsx
│   │   ├── api/                 # API 路由
│   │   │   ├── auth/
│   │   │   └── [各业务模块 API]
│   │   ├── layout.tsx           # 根布局
│   │   └── page.tsx             # 首页
│   ├── components/
│   │   ├── shared/              # 业务组件
│   │   │   ├── auth-provider.tsx
│   │   │   ├── navigation/
│   │   │   ├── forms/
│   │   │   └── charts/
│   │   └── ui/                  # Shadcn/ui 组件
│   ├── lib/
│   │   ├── prisma.ts
│   │   ├── auth.ts
│   │   ├── utils.ts
│   │   └── validations.ts       # Zod 验证 schemas
│   ├── hooks/                   # 自定义 React hooks
│   ├── stores/                  # Zustand 状态管理
│   ├── types/                   # TypeScript 类型定义
│   └── styles/
│       └── globals.css
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── public/
├── .env.local.example
├── .gitignore
├── docker-compose.yml
├── Dockerfile
├── next.config.js
├── tailwind.config.ts
└── tsconfig.json
```

### 3.2 React 应用结构 (my-react-app/)
```
my-react-app/
├── src/
│   ├── components/
│   │   ├── Layout.tsx
│   │   ├── Home.tsx
│   │   ├── [功能模块组件]
│   │   └── shared/
│   ├── hooks/
│   ├── types/
│   ├── utils/
│   └── assets/
├── public/
├── Dockerfile
├── docker-compose.yml
├── vite.config.ts
└── package.json
```

---

## 4. 开发规范与最佳实践

### 4.1 代码规范
```typescript
// 组件命名与导出规范
// 文件名：user-profile.tsx
export function UserProfile({ userId }: { userId: string }) {
  // 组件逻辑
}

// 类型定义规范
interface UserProfileProps {
  userId: string;
  isEditable?: boolean;
}

// API 路由规范
// 文件：app/api/users/[id]/route.ts
import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';

const updateUserSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
});

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const validation = updateUserSchema.safeParse(body);
    
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.formErrors },
        { status: 400 }
      );
    }
    
    // 业务逻辑
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

### 4.2 状态管理规范
```typescript
// Zustand store 示例
import { create } from 'zustand';

interface UserStore {
  user: User | null;
  setUser: (user: User | null) => void;
  clearUser: () => void;
}

export const useUserStore = create<UserStore>()((set) => ({
  user: null,
  setUser: (user) => set({ user }),
  clearUser: () => set({ user: null }),
}));

// 使用示例
function UserComponent() {
  const { user, setUser } = useUserStore();
  // 组件逻辑
}
```

### 4.3 数据库操作规范
```typescript
// lib/prisma.ts
import { PrismaClient } from '@prisma/client';

declare global {
  var prisma: PrismaClient | undefined;
}

export const prisma = globalThis.prisma || new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalThis.prisma = prisma;
}

// 使用示例
import { prisma } from '@/lib/prisma';

export async function getUserById(id: string) {
  return await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
    },
  });
}
```

---

## 5. 安全强化规范

### 5.1 输入验证 (必须使用 Zod)
```typescript
// lib/validations.ts
import { z } from 'zod';

export const createCourseSchema = z.object({
  title: z.string().min(3, '标题至少3个字符').max(100, '标题最多100个字符'),
  description: z.string().optional(),
  categoryId: z.string().uuid('无效的分类ID'),
  isPublished: z.boolean().default(false),
});

export const updateUserSchema = z.object({
  name: z.string().min(1).max(50),
  email: z.string().email(),
  bio: z.string().max(500).optional(),
});

// API 中使用
export async function POST(request: NextRequest) {
  const body = await request.json();
  const validation = createCourseSchema.safeParse(body);
  
  if (!validation.success) {
    return NextResponse.json(
      { 
        error: '输入验证失败',
        details: validation.error.flatten()
      },
      { status: 400 }
    );
  }
  
  const { title, description, categoryId, isPublished } = validation.data;
  // 安全地使用验证后的数据
}
```

### 5.2 身份验证与授权
```typescript
// lib/auth.ts
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

export async function getAuthenticatedUser() {
  const session = await getServerSession(authOptions);
  
  if (!session || !session.user) {
    throw new Error('未授权访问');
  }
  
  return session.user;
}

// 权限检查示例
export async function checkCourseOwnership(courseId: string, userId: string) {
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { authorId: true },
  });
  
  if (!course || course.authorId !== userId) {
    throw new Error('无权限访问该课程');
  }
  
  return course;
}
```

### 5.3 Content Security Policy
```javascript
// next.config.js
const cspHeader = `
  default-src 'self';
  script-src 'self' 'unsafe-eval' 'unsafe-inline' https://cdn.jsdelivr.net;
  style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
  img-src 'self' blob: data: https:;
  font-src 'self' https://fonts.gstatic.com;
  connect-src 'self' https://api.github.com;
  object-src 'none';
  base-uri 'self';
  form-action 'self';
  frame-ancestors 'none';
  upgrade-insecure-requests;
`;

/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: cspHeader.replace(/\s{2,}/g, ' ').trim(),
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin',
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
```

---

## 6. 容器化部署规范

### 6.1 Next.js 应用 Dockerfile
```dockerfile
# my-next-app/Dockerfile
FROM node:18-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build the app
RUN npm run build

# Production image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy built application
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Copy Prisma schema and migrations
COPY --from=builder /app/prisma ./prisma

USER nextjs

EXPOSE 3000

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

CMD ["node", "server.js"]
```

### 6.2 React 应用 Dockerfile
```dockerfile
# my-react-app/Dockerfile
FROM node:18-alpine AS build

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy source code and build
COPY . .
RUN npm run build

# Production stage
FROM nginx:stable-alpine AS production

# Copy built app to nginx
COPY --from=build /app/dist /usr/share/nginx/html

# Copy nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

# Expose port
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
```

### 6.3 Docker Compose 配置
```yaml
# docker-compose.yml
version: '3.8'

services:
  # Next.js 应用
  nextjs-app:
    build: ./my-next-app
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=file:./dev.db
      - NEXTAUTH_URL=http://localhost:3000
      - NEXTAUTH_SECRET=${NEXTAUTH_SECRET}
      - GITHUB_ID=${GITHUB_ID}
      - GITHUB_SECRET=${GITHUB_SECRET}
    volumes:
      - ./my-next-app/prisma:/app/prisma
    depends_on:
      - database
    restart: unless-stopped

  # React 应用
  react-app:
    build: ./my-react-app
    ports:
      - "8080:80"
    restart: unless-stopped

  # 数据库 (可选，如果使用 PostgreSQL)
  database:
    image: postgres:15-alpine
    environment:
      - POSTGRES_DB=learning_platform
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    restart: unless-stopped

  # Nginx 反向代理
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf
      - ./nginx/ssl:/etc/ssl
    depends_on:
      - nextjs-app
      - react-app
    restart: unless-stopped

volumes:
  postgres_data:
```

### 6.4 Nginx 配置
```nginx
# nginx/nginx.conf
events {
    worker_connections 1024;
}

http {
    upstream nextjs {
        server nextjs-app:3000;
    }

    upstream react {
        server react-app:80;
    }

    server {
        listen 80;
        server_name localhost;

        # Next.js 应用路由
        location / {
            proxy_pass http://nextjs;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        # React 应用路由 (可选)
        location /legacy {
            proxy_pass http://react;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
        }

        # 静态资源缓存
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }

        # 安全头
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header X-XSS-Protection "1; mode=block" always;
        add_header Referrer-Policy "no-referrer-when-downgrade" always;
    }
}
```

---

## 7. 错误处理与调试

### 7.1 常见错误解决方案
```typescript
// 错误边界组件
'use client';

import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-red-600 mb-4">
              出现错误
            </h2>
            <p className="text-gray-600 mb-4">
              {this.state.error?.message || '发生了未知错误'}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              重新加载页面
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
```

### 7.2 API 错误处理
```typescript
// lib/api-utils.ts
export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public code?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function handleApiError(error: unknown) {
  if (error instanceof ApiError) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: error.statusCode }
    );
  }

  console.error('Unexpected error:', error);
  
  return NextResponse.json(
    { error: '内部服务器错误' },
    { status: 500 }
  );
}

// 使用示例
export async function GET(request: NextRequest) {
  try {
    // 业务逻辑
  } catch (error) {
    return handleApiError(error);
  }
}
```

---

## 8. 性能优化指南

### 8.1 Next.js 性能优化
```typescript
// 动态导入
import dynamic from 'next/dynamic';

const PidSimulator = dynamic(
  () => import('@/components/shared/pid-simulator'),
  { 
    ssr: false,
    loading: () => <div>加载中...</div>
  }
);

// 图片优化
import Image from 'next/image';

export function CourseCard({ course }: { course: Course }) {
  return (
    <div className="card">
      <Image
        src={course.thumbnail}
        alt={course.title}
        width={300}
        height={200}
        className="rounded-lg"
        priority={false}
      />
      <h3>{course.title}</h3>
    </div>
  );
}
```

### 8.2 React 性能优化
```typescript
import { memo, useMemo, useCallback } from 'react';

// 组件记忆化
export const CourseList = memo(function CourseList({ 
  courses, 
  onCourseClick 
}: {
  courses: Course[];
  onCourseClick: (id: string) => void;
}) {
  const sortedCourses = useMemo(() => {
    return courses.sort((a, b) => a.title.localeCompare(b.title));
  }, [courses]);

  const handleClick = useCallback((id: string) => {
    onCourseClick(id);
  }, [onCourseClick]);

  return (
    <div>
      {sortedCourses.map(course => (
        <CourseCard
          key={course.id}
          course={course}
          onClick={() => handleClick(course.id)}
        />
      ))}
    </div>
  );
});
```

---

## 9. 测试规范

### 9.1 单元测试
```typescript
// __tests__/components/course-card.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { CourseCard } from '@/components/shared/course-card';

const mockCourse = {
  id: '1',
  title: '测试课程',
  description: '这是一个测试课程',
  thumbnail: '/test-image.jpg',
};

describe('CourseCard', () => {
  it('renders course information correctly', () => {
    render(<CourseCard course={mockCourse} />);
    
    expect(screen.getByText('测试课程')).toBeInTheDocument();
    expect(screen.getByText('这是一个测试课程')).toBeInTheDocument();
  });

  it('calls onClick when clicked', () => {
    const handleClick = jest.fn();
    render(<CourseCard course={mockCourse} onClick={handleClick} />);
    
    fireEvent.click(screen.getByRole('button'));
    expect(handleClick).toHaveBeenCalledWith(mockCourse.id);
  });
});
```

### 9.2 API 测试
```typescript
// __tests__/api/courses.test.ts
import { NextRequest } from 'next/server';
import { GET, POST } from '@/app/api/courses/route';

describe('/api/courses', () => {
  it('GET returns courses list', async () => {
    const request = new NextRequest('http://localhost:3000/api/courses');
    const response = await GET(request);
    
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(Array.isArray(data)).toBe(true);
  });

  it('POST creates new course', async () => {
    const courseData = {
      title: '新课程',
      description: '课程描述',
    };
    
    const request = new NextRequest('http://localhost:3000/api/courses', {
      method: 'POST',
      body: JSON.stringify(courseData),
    });
    
    const response = await POST(request);
    expect(response.status).toBe(201);
  });
});
```

---

## 10. 部署与监控

### 10.1 环境变量配置
```bash
# .env.local.example
# 数据库
DATABASE_URL="file:./dev.db"

# NextAuth.js
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-key"

# GitHub OAuth
GITHUB_ID="your-github-client-id"
GITHUB_SECRET="your-github-client-secret"

# 应用配置
NODE_ENV="development"
```

### 10.2 健康检查
```typescript
// app/api/health/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    // 检查数据库连接
    await prisma.$ping();
    
    return NextResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        database: 'connected',
        app: 'running',
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: 'Database connection failed',
      },
      { status: 503 }
    );
  }
}
```

### 10.3 监控与日志
```typescript
// lib/logger.ts
type LogLevel = 'info' | 'warn' | 'error' | 'debug';

export function log(level: LogLevel, message: string, meta?: any) {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    level,
    message,
    meta,
  };

  if (process.env.NODE_ENV === 'production') {
    // 生产环境发送到日志服务
    console.log(JSON.stringify(logEntry));
  } else {
    // 开发环境控制台输出
    console[level](message, meta);
  }
}
```

---

## 11. AI 辅助开发指令

### 11.1 标准化请求格式
```
遵照 ai-project-spec-claude.md 规范，请帮我：

1. 在 my-next-app/src/app/(main)/courses/page.tsx 中创建课程列表页面
2. 使用 Server Components 从数据库获取课程数据
3. 使用 Shadcn/ui 的 Card 组件展示课程信息
4. 添加必要的 TypeScript 类型定义
5. 实现响应式布局使用 Tailwind CSS
6. 添加错误处理和加载状态
```

### 11.2 代码审查清单
- [ ] 使用正确的技术栈
- [ ] 遵循文件命名规范
- [ ] 包含 TypeScript 类型定义
- [ ] 使用 Zod 进行输入验证
- [ ] 实现适当的错误处理
- [ ] 添加必要的安全检查
- [ ] 遵循 Tailwind CSS 样式规范
- [ ] 使用 Shadcn/ui 组件
- [ ] 包含适当的测试用例

### 11.3 性能优化检查
- [ ] 使用 Next.js Image 组件
- [ ] 实现适当的缓存策略
- [ ] 使用动态导入减少包大小
- [ ] 避免客户端组件中的重复渲染
- [ ] 使用 React.memo 优化组件

---

## 12. 故障排除指南

### 12.1 常见构建错误
```bash
# TypeScript 错误
npx tsc --noEmit

# ESLint 错误
npm run lint -- --fix

# 依赖冲突
rm -rf node_modules package-lock.json
npm install

# Prisma 错误
npx prisma generate
npx prisma db push
```

### 12.2 Docker 问题
```bash
# 清理 Docker 缓存
docker system prune -a

# 重新构建镜像
docker-compose build --no-cache

# 查看容器日志
docker-compose logs -f nextjs-app
```

### 12.3 生产环境调试
```bash
# 检查健康状态
curl http://localhost:3000/api/health

# 查看应用日志
docker-compose logs -f --tail=100 nextjs-app

# 数据库连接测试
docker-compose exec database psql -U postgres -d learning_platform
```

---

## 结语

本规范涵盖了在线学习平台 AI 辅助开发的所有关键方面，从技术选型到部署运维。在使用 Claude Code 进行开发时，请始终参考本规范，确保代码质量和项目的长期可维护性。

**记住：安全第一，性能优化，用户体验至上！**