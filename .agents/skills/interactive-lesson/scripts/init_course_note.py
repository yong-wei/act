#!/usr/bin/env python3
from __future__ import annotations

import argparse
from pathlib import Path


def main() -> int:
    parser = argparse.ArgumentParser(description='Initialize a lesson implementation note.')
    parser.add_argument('--lesson', required=True, help='Lesson folder name, e.g. L-2a')
    parser.add_argument('--title', default='', help='Lesson title')
    args = parser.parse_args()

    # Skill directory is the parent of scripts directory
    skill_dir = Path(__file__).resolve().parent.parent
    notes_dir = skill_dir / 'notes'
    notes_dir.mkdir(parents=True, exist_ok=True)

    note_path = notes_dir / f'{args.lesson}.md'
    if note_path.exists():
      print(str(note_path))
      return 0

    title = args.title.strip() or args.lesson
    content = f"""# {args.lesson} 课程实现笔记

## 课程信息
- 课次：{args.lesson}
- 标题：{title}
- 外部文档目录：`/Users/YW/JianguoYun/1教学/教学材料-课程/@自动控制原理/@新体系/notes/lessons/{args.lesson}`
- 当前实现入口：

## 当前状态
- 未开始

## 本次实现内容
- 待填写

## 与设计稿差异
- 已消除差异：
- 仍存在差异：
- 有意偏离：

## 媒体资源状态
- 已具备：
- 缺失：
- 占位路径：

## 验证记录
- 设计稿核对：
- 页面验证：
- 测试命令：
- 结果：

## 下次优化建议
- 待填写
"""
    note_path.write_text(content, encoding='utf-8')
    print(str(note_path))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
