#!/bin/bash

echo "🚀 开始迁移AI-OBE船舶控制平台..."

# 设置目标目录
TARGET_DIR="$HOME/Desktop/ai-obe-platform"

# 检查目标目录是否存在
if [ -d "$TARGET_DIR" ]; then
    echo "⚠️  目标目录已存在，将备份为 ${TARGET_DIR}_backup_$(date +%Y%m%d_%H%M%S)"
    mv "$TARGET_DIR" "${TARGET_DIR}_backup_$(date +%Y%m%d_%H%M%S)"
fi

# 创建目标目录
mkdir -p "$TARGET_DIR"

# 复制文件（排除不需要的文件）
echo "📂 复制项目文件..."
rsync -av --exclude='node_modules' --exclude='.next' --exclude='package-lock.json' --exclude='.DS_Store' . "$TARGET_DIR/"

# 进入目标目录
cd "$TARGET_DIR"

# 清理任何残留的缓存文件
echo "🧹 清理缓存文件..."
rm -rf .next node_modules package-lock.json .DS_Store

# 设置Node环境
echo "🔧 设置Node.js环境..."
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# 安装依赖
echo "📦 安装项目依赖..."
npm install --legacy-peer-deps

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ 迁移完成！"
    echo "📍 新项目位置: $TARGET_DIR"
    echo ""
    echo "🚀 下一步操作："
    echo "   cd $TARGET_DIR"
    echo "   npm run dev"
    echo ""
    echo "🌐 然后访问: http://localhost:3000"
else
    echo "❌ 依赖安装失败，请手动检查"
fi