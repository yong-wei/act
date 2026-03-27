#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import sqlite3
from pathlib import Path


def parse_args() -> argparse.Namespace:
    root = Path(__file__).resolve().parents[1]
    parser = argparse.ArgumentParser(description='Build JSONL and SQLite indexes for structured questions.')
    parser.add_argument('--root', default=str(root), help='Question bank root directory.')
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    root = Path(args.root)
    questions_dir = root / 'questions'
    indexes_dir = root / 'indexes'
    indexes_dir.mkdir(parents=True, exist_ok=True)

    payloads: list[dict[str, object]] = []
    tag_counts: dict[str, int] = {}
    chapter_map: dict[str, list[str]] = {}

    for path in sorted(questions_dir.glob('AC-Q-*.json')):
        payload = json.loads(path.read_text(encoding='utf-8'))
        tags = list(payload.get('knowledge_tags', []))
        entry = {
            'question_id': payload['question_id'],
            'source_ref': payload['source_ref'],
            'chapter': payload['chapter'],
            'section': payload.get('section'),
            'tags': tags,
            'figure_status': payload['figure_status'],
            'formula_status': payload['formula_status'],
            'usage_status': payload['usage_status'],
            'search_text': '\n'.join([
                str(payload['source_ref']),
                str(payload.get('section') or ''),
                payload['stem_md'],
                payload['solution_md'],
                ' '.join(tags),
            ]),
            'markdown_path': f"questions/{payload['question_id']}.md",
            'json_path': f"questions/{payload['question_id']}.json",
        }
        payloads.append(entry)
        for tag in tags:
            tag_counts[tag] = tag_counts.get(tag, 0) + 1
        chapter_map.setdefault(str(payload['chapter']), []).append(payload['question_id'])

    jsonl_path = indexes_dir / 'questions.jsonl'
    jsonl_path.write_text(
        ''.join(json.dumps(item, ensure_ascii=False) + '\n' for item in payloads),
        encoding='utf-8',
    )
    (indexes_dir / 'tags.json').write_text(json.dumps(tag_counts, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    (indexes_dir / 'chapter-map.json').write_text(json.dumps(chapter_map, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

    sqlite_path = indexes_dir / 'questions.sqlite'
    if sqlite_path.exists():
        sqlite_path.unlink()
    conn = sqlite3.connect(sqlite_path)
    try:
        conn.execute(
            '''
            CREATE TABLE questions (
                question_id TEXT PRIMARY KEY,
                source_ref TEXT NOT NULL,
                chapter INTEGER NOT NULL,
                section TEXT,
                tags_json TEXT NOT NULL,
                figure_status TEXT NOT NULL,
                formula_status TEXT NOT NULL,
                usage_status TEXT NOT NULL,
                search_text TEXT NOT NULL,
                markdown_path TEXT NOT NULL,
                json_path TEXT NOT NULL
            )
            '''
        )
        conn.execute(
            '''
            CREATE VIRTUAL TABLE question_fts USING fts5(
                question_id,
                source_ref,
                section,
                tags,
                search_text
            )
            '''
        )
        for item in payloads:
            conn.execute(
                '''
                INSERT INTO questions (
                    question_id, source_ref, chapter, section, tags_json,
                    figure_status, formula_status, usage_status, search_text,
                    markdown_path, json_path
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''',
                (
                    item['question_id'],
                    item['source_ref'],
                    item['chapter'],
                    item['section'],
                    json.dumps(item['tags'], ensure_ascii=False),
                    item['figure_status'],
                    item['formula_status'],
                    item['usage_status'],
                    item['search_text'],
                    item['markdown_path'],
                    item['json_path'],
                ),
            )
            conn.execute(
                '''
                INSERT INTO question_fts (
                    question_id, source_ref, section, tags, search_text
                ) VALUES (?, ?, ?, ?, ?)
                ''',
                (
                    item['question_id'],
                    item['source_ref'],
                    item['section'] or '',
                    ' '.join(item['tags']),
                    item['search_text'],
                ),
            )
        conn.commit()
    finally:
        conn.close()

    print(json.dumps({'indexed': len(payloads)}, ensure_ascii=False))


if __name__ == '__main__':
    main()
