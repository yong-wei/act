# AI-OBE船舶控制平台

智能海事教育平台 - AI驱动的船舶控制与PID参数优化系统

## 项目概述

本项目是第三次重构的AI-OBE船舶控制平台，采用Next.js 14构建，集成了先进的船舶控制教学功能，包括AI助教工坊、伦理决策沙盒和知识图谱系统。

## 核心功能

### 🏠 首页门户
- 动态轮播展示7种船舶场景（动力定位船、雪龙号破冰船、挖泥船等）
- 核心功能快速入口
- 响应式设计，适配多种设备

### 🤖 AI助教工坊
- 多模态交互（语音、文本、视觉）
- 认知矩阵3D导航
- 实时PID参数调优指导
- 虚实联动数字孪生平台

### ⚖️ 伦理决策沙盒
- 价值观权重调节器
- 海事伦理场景模拟
- 专家顾问团实时建议
- 决策后果可视化分析

### 🧠 知识图谱系统
- 3D知识节点可视化
- 智能学习路径生成
- 多类型资源整合
- 个性化推荐算法

## 技术栈

- **框架**: Next.js 14 (App Router)
- **语言**: TypeScript
- **样式**: Tailwind CSS
- **UI组件**: Radix UI + shadcn/ui
- **图标**: Lucide React
- **状态管理**: Zustand
- **数据验证**: Zod
- **3D渲染**: Three.js
- **图表**: Chart.js
- **容器化**: Docker + Docker Compose

## 项目结构

```
ai-obe-platform/
├── src/
│   ├── app/                 # Next.js App Router页面
│   │   ├── page.tsx         # 首页
│   │   ├── ai/              # AI助教工坊
│   │   ├── ethics/          # 伦理决策沙盒
│   │   └── knowledge/       # 知识图谱
│   ├── components/
│   │   └── ui/              # UI组件库
│   ├── lib/                 # 工具函数
│   └── types/               # TypeScript类型定义
├── public/                  # 静态资源
├── nginx/                   # Nginx配置
├── Dockerfile               # Docker构建文件
├── docker-compose.yml       # 容器编排
└── package.json             # 项目依赖
```

## 快速开始

### 开发环境

1. 克隆项目
```bash
git clone <repository-url>
cd ai-obe-platform
```

2. 安装依赖
```bash
npm install
```

3. 启动开发服务器
```bash
npm run dev
```

4. 访问 http://localhost:3000

### 生产部署

#### 使用Docker部署

1. 构建并启动容器
```bash
docker-compose up -d
```

2. 访问 http://localhost

#### 手动部署

1. 构建项目
```bash
npm run build
```

2. 启动生产服务器
```bash
npm run start
```

## 开发指南

### 代码规范

- 使用TypeScript进行类型安全开发
- 遵循ESLint和Prettier配置
- 组件采用函数式编程范式
- 使用Tailwind CSS进行样式开发

### 组件开发

- UI组件基于Radix UI构建
- 使用shadcn/ui设计系统
- 支持深色主题和高对比度模式
- 遵循无障碍访问标准

### 安全考虑

- 使用Zod进行输入验证
- 实施CSP安全策略
- 配置HTTPS和安全头
- 定期更新依赖包

## 性能优化

- Next.js自动代码分割
- 图片优化和懒加载
- 服务端渲染(SSR)
- 静态生成(SSG)
- Gzip压缩

## 浏览器支持

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## 贡献指南

1. Fork项目
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交变更 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 创建Pull Request

## 许可证

本项目采用MIT许可证 - 查看 [LICENSE](LICENSE) 文件了解详情

## 联系方式

- 项目维护者: AI-OBE团队
- 邮箱: contact@ai-obe.edu.cn
- 项目链接: https://github.com/ai-obe/ship-control-platform

## 更新日志

### v1.0.0 (2024-07-03)
- ✨ 初始版本发布
- 🚀 完整的三大核心功能实现
- 🐳 Docker容器化部署支持
- 📱 响应式设计适配