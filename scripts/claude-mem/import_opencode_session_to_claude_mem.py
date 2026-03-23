#!/usr/bin/env python3

import argparse
import json
import os
import sqlite3
import sys
import urllib.error
import urllib.request
from pathlib import Path


DEFAULT_OPENCODE_DB = Path.home() / ".local/share/opencode/opencode.db"
DEFAULT_CLAUDE_MEM_DB = Path.home() / ".claude-mem/claude-mem.db"
DEFAULT_WORKER_URL = "http://127.0.0.1:37777"


def load_json(text: str) -> dict:
    return json.loads(text)


def should_skip_prompt(text: str) -> bool:
    stripped = text.strip()
    if not stripped:
        return True
    return stripped.startswith("<system-reminder>") or stripped.startswith(
        "[SYSTEM DIRECTIVE:"
    )


def get_session_prompts(opencode_db: Path, session_id: str) -> tuple[list[str], str]:
    conn = sqlite3.connect(opencode_db)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()

    query = """
    SELECT m.id AS message_id, m.time_created, m.data AS message_data, p.data AS part_data
    FROM message m
    JOIN part p ON p.message_id = m.id
    WHERE m.session_id = ?
    ORDER BY m.time_created ASC, p.time_created ASC
    """

    prompts: list[str] = []
    cwd = ""
    seen_messages: set[str] = set()

    for row in cur.execute(query, (session_id,)):
        message = load_json(row["message_data"])
        if message.get("role") != "user":
            continue

        path_info = message.get("path") or {}
        cwd = cwd or path_info.get("cwd") or path_info.get("root") or ""

        part = load_json(row["part_data"])
        if part.get("type") != "text":
            continue

        message_id = row["message_id"]
        if message_id in seen_messages:
            continue

        text = part.get("text", "")
        if should_skip_prompt(text):
            seen_messages.add(message_id)
            continue

        prompts.append(text)
        seen_messages.add(message_id)

    if not cwd:
        row = cur.execute(
            "SELECT directory FROM session WHERE id = ?", (session_id,)
        ).fetchone()
        if row and row[0]:
            cwd = row[0]

    conn.close()
    return prompts, cwd


def get_existing_prompts(claude_mem_db: Path, content_session_id: str) -> list[str]:
    conn = sqlite3.connect(claude_mem_db)
    cur = conn.cursor()
    rows = cur.execute(
        "SELECT prompt_text FROM user_prompts WHERE content_session_id = ? ORDER BY prompt_number ASC",
        (content_session_id,),
    ).fetchall()
    conn.close()
    return [row[0] for row in rows]


def post_session_init(
    worker_url: str, session_id: str, project: str, prompt: str
) -> dict:
    data = json.dumps(
        {
            "contentSessionId": session_id,
            "project": project,
            "prompt": prompt,
        }
    ).encode("utf-8")
    req = urllib.request.Request(
        f"{worker_url}/api/sessions/init",
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        body = resp.read().decode("utf-8")
        return json.loads(body)


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Import OpenCode session prompts into claude-mem."
    )
    parser.add_argument("session_id", help="OpenCode session id, e.g. ses_xxx")
    parser.add_argument("--opencode-db", default=str(DEFAULT_OPENCODE_DB))
    parser.add_argument("--claude-mem-db", default=str(DEFAULT_CLAUDE_MEM_DB))
    parser.add_argument("--worker-url", default=DEFAULT_WORKER_URL)
    args = parser.parse_args()

    opencode_db = Path(args.opencode_db).expanduser()
    claude_mem_db = Path(args.claude_mem_db).expanduser()

    if not opencode_db.exists():
        print(f"OpenCode DB not found: {opencode_db}", file=sys.stderr)
        return 1
    if not claude_mem_db.exists():
        print(f"claude-mem DB not found: {claude_mem_db}", file=sys.stderr)
        return 1

    prompts, cwd = get_session_prompts(opencode_db, args.session_id)
    if not prompts:
        print("No importable user prompts found for session.")
        return 0

    project = os.path.basename(cwd.rstrip("/")) if cwd else "unknown-project"
    existing = get_existing_prompts(claude_mem_db, args.session_id)
    pending = prompts[len(existing) :]

    print(f"Session: {args.session_id}")
    print(f"Project: {project}")
    print(f"Prompts in OpenCode: {len(prompts)}")
    print(f"Prompts already in claude-mem: {len(existing)}")
    print(f"Prompts to import now: {len(pending)}")

    for index, prompt in enumerate(pending, start=len(existing) + 1):
        try:
            result = post_session_init(
                args.worker_url, args.session_id, project, prompt
            )
        except urllib.error.URLError as exc:
            print(f"Failed to import prompt #{index}: {exc}", file=sys.stderr)
            return 1
        print(
            f"Imported prompt #{index}: promptNumber={result.get('promptNumber')}, sessionDbId={result.get('sessionDbId')}"
        )

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
