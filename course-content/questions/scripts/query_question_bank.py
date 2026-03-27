#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import sqlite3
from pathlib import Path


def parse_args() -> argparse.Namespace:
    root = Path(__file__).resolve().parents[1]
    parser = argparse.ArgumentParser(description='Query structured question bank.')
    parser.add_argument('--root', default=str(root), help='Question bank root directory.')
    parser.add_argument('--query', required=True, help='Full-text query.')
    parser.add_argument('--limit', type=int, default=5, help='Maximum number of results.')
    return parser.parse_args()


def query_sqlite(sqlite_path: Path, query: str, limit: int) -> list[tuple[str, str, str, str]]:
    conn = sqlite3.connect(sqlite_path)
    try:
        rows = conn.execute(
            '''
            SELECT q.question_id, q.source_ref, COALESCE(q.section, ''), q.markdown_path
            FROM question_fts f
            JOIN questions q ON q.question_id = f.question_id
            WHERE question_fts MATCH ?
            LIMIT ?
            ''',
            (query, limit),
        ).fetchall()
    finally:
        conn.close()
    return rows


def query_jsonl(jsonl_path: Path, query: str, limit: int) -> list[dict[str, str]]:
    tokens = [token for token in query.split() if token]
    results: list[dict[str, str]] = []
    for line in jsonl_path.read_text(encoding='utf-8').splitlines():
        if not line.strip():
            continue
        payload = json.loads(line)
        search_text = payload.get('search_text', '')
        if all(token in search_text for token in tokens):
            results.append({
                'question_id': payload['question_id'],
                'source_ref': payload['source_ref'],
                'section': payload.get('section') or '',
                'markdown_path': payload['markdown_path'],
            })
        if len(results) >= limit:
            break
    return results


def main() -> None:
    args = parse_args()
    root = Path(args.root)
    sqlite_path = root / 'indexes' / 'questions.sqlite'
    jsonl_path = root / 'indexes' / 'questions.jsonl'
    rows = query_sqlite(sqlite_path, args.query, args.limit)
    if rows:
        payload = [
            {
                'question_id': row[0],
                'source_ref': row[1],
                'section': row[2],
                'markdown_path': row[3],
            }
            for row in rows
        ]
    else:
        payload = query_jsonl(jsonl_path, args.query, args.limit)
    print(json.dumps(payload, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
