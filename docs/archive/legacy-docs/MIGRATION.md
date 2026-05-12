# AI-OBE船舶控制平台 - 迁移指南

## 🚨 当前问题
同步软件（如坚果云）可能干扰了Next.js的文件索引，导致引用错误的路径。

## 🛠️ 解决方案：迁移到非同步目录

### 步骤1：选择目标目录
建议迁移到以下目录之一：
- `~/Desktop/act.just.edu.cn` (桌面)
- `~/Projects/act.just.edu.cn` (项目目录)
- `/tmp/act.just.edu.cn` (临时目录，用于测试)

### 步骤2：迁移命令
```bash
# 1. 停止当前开发服务器 (Ctrl+C)

# 2. 创建目标目录并复制项目
mkdir -p ~/Desktop/act.just.edu.cn
cp -r /Users/YW/JianguoYun/Codes/Site/act.just.edu.cn/act.just.edu.cn/* ~/Desktop/act.just.edu.cn/

# 3. 进入新目录
cd ~/Desktop/act.just.edu.cn

# 4. 清理可能的缓存
rm -rf .next node_modules package-lock.json

# 5. 重新安装依赖
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
npm install --legacy-peer-deps

# 6. 启动开发服务器
npm run dev
```

### 步骤3：验证迁移
访问 http://localhost:3000，确认：
- ✅ 页面正常加载
- ✅ 中文字符显示正确
- ✅ 所有4个页面可访问（/, /ai, /ethics, /knowledge）
- ✅ 无编译错误

## 🔄 快速迁移脚本

创建并运行以下脚本：

```bash
#!/bin/bash
echo "🚀 开始迁移AI-OBE平台..."

# 设置目标目录
TARGET_DIR="$HOME/Desktop/act.just.edu.cn"

# 创建目标目录
mkdir -p "$TARGET_DIR"

# 复制文件
echo "📂 复制项目文件..."
cp -r . "$TARGET_DIR/"

# 进入目标目录
cd "$TARGET_DIR"

# 清理缓存
echo "🧹 清理缓存..."
rm -rf .next node_modules package-lock.json .DS_Store

# 设置Node环境
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# 安装依赖
echo "📦 安装依赖..."
npm install --legacy-peer-deps

echo "✅ 迁移完成！"
echo "📍 新项目位置: $TARGET_DIR"
echo "🚀 运行命令: cd $TARGET_DIR && npm run dev"
```

## 🐳 Docker部署（推荐）
如果迁移后仍有问题，使用Docker是最可靠的解决方案：

```bash
# 在项目根目录运行
docker-compose up -d

# 访问 http://localhost
```

## 📋 迁移后检查清单
- [ ] 项目位置不在同步文件夹
- [ ] 依赖安装成功（440个包）
- [ ] 开发服务器正常启动
- [ ] 所有页面编译成功
- [ ] 中文字符正确显示
- [ ] TypeScript类型检查通过

## 🔍 故障排除
如果迁移后仍有问题：

1. **检查Node版本**：`node --version` (应该是v24.x)
2. **检查文件编码**：`file src/app/page.tsx` (应该显示UTF-8)
3. **查看错误日志**：完整的npm run dev输出
4. **清理浏览器缓存**：Ctrl+Shift+R 强制刷新

迁移完成后，新的项目将完全独立于同步软件，避免文件索引冲突。