#!/usr/bin/env bash
# export-runtime.sh — 将 authoring/ 内容导出为 runtime/ 格式
# 本脚本为占位文件，内容待"系统接线"阶段补充实现
#
# 预期功能：
#   1. 读取 authoring/lessons/<unit>/manifest.json
#   2. 合并图谱基线 + 课次 overlay → runtime/lessons/<unit>/graph-overlay.json
#   3. 处理媒体素材（压缩/格式转换）→ runtime/lessons/<unit>/media/
#   4. 生成平台导入用的 lesson.json → runtime/lessons/<unit>/lesson.json
#   5. 更新全局索引 → runtime/indexes/
#
# 用法（待实现后）：
#   ./scripts/export-runtime.sh L-2a      # 导出单个课次
#   ./scripts/export-runtime.sh --all     # 导出所有课次

echo "[export-runtime.sh] 占位脚本，尚未实现。"
echo "请在'系统接线'阶段补充实现。"
exit 0
