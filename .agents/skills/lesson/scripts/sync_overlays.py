#!/usr/bin/env python3
"""
sync_overlays.py — 将 authoring/lessons/<lesson>/graph/ 镜像到
                    authoring/knowledge/overlays/<lesson>/

用法：
  # 同步单个课次
  python3 sync_overlays.py L-2b

  # 同步所有课次
  python3 sync_overlays.py --all

  # 仅检查（不写入）
  python3 sync_overlays.py --all --check
"""

import argparse
import shutil
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[4]
COURSE_ROOT = REPO_ROOT / "course-content" if (REPO_ROOT / "course-content").exists() else REPO_ROOT
LESSONS_DIR = COURSE_ROOT / "authoring" / "lessons"
OVERLAYS_DIR = COURSE_ROOT / "authoring" / "knowledge" / "overlays"
GRAPH_FILES = ("nodes.jsonl", "relations.jsonl")


def sync_lesson(lesson_id: str, check_only: bool = False) -> bool:
    """同步单个课次的 graph/ → overlays/，返回是否存在差异。"""
    src_dir = LESSONS_DIR / lesson_id / "graph"
    dst_dir = OVERLAYS_DIR / lesson_id

    if not src_dir.exists():
        print(f"  [SKIP] {lesson_id}: graph/ 目录不存在，跳过")
        return False

    has_diff = False
    for fname in GRAPH_FILES:
        src = src_dir / fname
        dst = dst_dir / fname

        if not src.exists():
            continue  # 该文件在 graph/ 中不存在，跳过

        src_content = src.read_text(encoding="utf-8")

        if dst.exists():
            dst_content = dst.read_text(encoding="utf-8")
            if src_content == dst_content:
                print(f"  [OK]   {lesson_id}/{fname} — 已同步")
                continue
            else:
                has_diff = True
                print(f"  [DIFF] {lesson_id}/{fname} — 内容不一致")
        else:
            has_diff = True
            print(f"  [NEW]  {lesson_id}/{fname} — overlay 缺失")

        if not check_only:
            dst_dir.mkdir(parents=True, exist_ok=True)
            shutil.copy2(src, dst)
            print(f"         → 已写入 {dst.relative_to(COURSE_ROOT)}")

    return has_diff


def discover_lessons() -> list[str]:
    """返回 authoring/lessons/ 下所有含 graph/ 子目录的课次编号列表。"""
    lessons = []
    if not LESSONS_DIR.exists():
        return lessons
    for entry in sorted(LESSONS_DIR.iterdir()):
        if entry.is_dir() and (entry / "graph").exists():
            lessons.append(entry.name)
    return lessons


def main():
    parser = argparse.ArgumentParser(description="同步 graph/ 到 overlays/")
    parser.add_argument("lesson", nargs="?", help="课次编号，如 L-2b")
    parser.add_argument("--all", action="store_true", help="同步所有课次")
    parser.add_argument("--check", action="store_true", help="仅检查，不写入文件")
    args = parser.parse_args()

    if not args.lesson and not args.all:
        parser.print_help()
        sys.exit(1)

    mode = "检查模式（不写入）" if args.check else "同步模式"
    print(f"=== overlays 同步工具 [{mode}] ===")
    print(f"    源：{LESSONS_DIR.relative_to(COURSE_ROOT)}/*/graph/")
    print(f"    目标：{OVERLAYS_DIR.relative_to(COURSE_ROOT)}/*/")
    print()

    lessons = discover_lessons() if args.all else [args.lesson]
    any_diff = False

    for lesson_id in lessons:
        print(f"[{lesson_id}]")
        diff = sync_lesson(lesson_id, check_only=args.check)
        any_diff = any_diff or diff
        print()

    if args.check:
        if any_diff:
            print("❌ 存在不一致项，请运行不带 --check 参数的命令进行同步。")
            sys.exit(1)
        else:
            print("✅ 所有 overlays 与 graph/ 保持一致。")
    else:
        print("✅ 同步完成。")


if __name__ == "__main__":
    main()
