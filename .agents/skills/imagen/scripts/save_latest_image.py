#!/usr/bin/env python3
from __future__ import annotations

import argparse
import re
import shutil
from pathlib import Path


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description='Save latest Codex-generated image and matching prompt.')
    parser.add_argument('--summary', required=True, help='Content summary used as the filename stem.')
    prompt_group = parser.add_mutually_exclusive_group(required=True)
    prompt_group.add_argument('--prompt-text', help='Exact prompt used for generation.')
    prompt_group.add_argument('--prompt-file', help='Path to a file containing the exact prompt used for generation.')
    parser.add_argument('--output-dir', default='generated-images', help='Output directory. Defaults to project generated-images/.')
    parser.add_argument('--language', choices=['zh', 'en'], help='Optional language hint for filename normalization.')
    parser.add_argument('--generated-root', default=str(Path.home() / '.codex' / 'generated_images'))
    parser.add_argument('--image', help='Exact image returned by this generation/edit; preferred over newest-image discovery.')
    return parser.parse_args()


def newest_image(root: Path) -> Path:
    candidates = [
        path
        for path in root.rglob('*')
        if path.is_file() and path.suffix.lower() in {'.png', '.jpg', '.jpeg', '.webp'}
    ]
    if not candidates:
        raise SystemExit(f'No generated images found under {root}')
    return max(candidates, key=lambda path: path.stat().st_mtime)


def safe_stem(summary: str, language: str | None) -> str:
    text = summary.strip()
    text = re.sub(r'[\s/\\:＊*?"<>|]+', '-' if language == 'en' else '', text)
    text = re.sub(r'[\x00-\x1f\x7f]', '', text)
    if language == 'en':
        text = re.sub(r'[^A-Za-z0-9._-]+', '-', text).strip('-._')
        text = re.sub(r'-{2,}', '-', text)
        return (text or 'generated-image').lower()
    text = re.sub(r'[.。]+$', '', text)
    return text[:48] or '生成图片'


def available_path(directory: Path, stem: str, suffix: str) -> Path:
    path = directory / f'{stem}{suffix}'
    if not path.exists():
        return path
    index = 2
    while True:
        candidate = directory / f'{stem}-{index}{suffix}'
        if not candidate.exists():
            return candidate
        index += 1


def main() -> None:
    args = parse_args()
    generated = Path(args.image).expanduser().resolve() if args.image else newest_image(Path(args.generated_root).expanduser())
    if not generated.is_file():
        raise SystemExit(f'Image not found: {generated}')
    output_dir = Path(args.output_dir).expanduser()
    output_dir.mkdir(parents=True, exist_ok=True)
    prompt_text = (
        Path(args.prompt_file).expanduser().read_text(encoding='utf-8')
        if args.prompt_file
        else str(args.prompt_text)
    )

    stem = safe_stem(args.summary, args.language)
    image_path = available_path(output_dir, stem, '.png')
    prompt_path = image_path.with_suffix('.prompt.md')

    shutil.copy2(generated, image_path)
    prompt_path.write_text(prompt_text.rstrip() + '\n', encoding='utf-8')

    print(image_path)
    print(prompt_path)
    print(generated)


if __name__ == '__main__':
    main()
