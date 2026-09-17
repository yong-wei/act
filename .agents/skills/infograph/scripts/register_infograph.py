#!/usr/bin/env python3
from __future__ import annotations

import argparse
from pathlib import Path

from infograph_utils import (
    canonical_node_id,
    copy_image,
    latest_codex_image,
    node_infograph_dir,
    node_infograph_path,
    now_iso,
    read_json,
    repo_path,
    selected_infograph_ref,
    write_json,
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description='Register a generated node infographic.')
    parser.add_argument('--lesson', required=True, help='Lesson id such as 3-8')
    parser.add_argument('--node', required=True, help='Knowledge node id')
    parser.add_argument('--image', help='Path to generated image')
    parser.add_argument('--latest-codex-image', action='store_true', help='Use newest image under ~/.codex/generated_images')
    parser.add_argument('--reported-model', help='Actual model from tool/API response; omit when not disclosed')
    parser.add_argument('--generation-path', choices=['codex-native-image-generation', 'openai-image-api'], default='codex-native-image-generation')
    parser.add_argument('--accept', action='store_true', help='Mark review.json as accepted after visual review')
    parser.add_argument('--note', default='', help='Review note')
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    requested_node_id = args.node
    node_id = canonical_node_id(requested_node_id)
    selected = selected_infograph_ref(node_id)
    if selected:
        selected_dir = node_infograph_dir(selected['lesson_id'], selected['node_id'])
        review_path = selected_dir / 'review.json'
        image_path = selected_dir / 'infograph.png'
        if image_path.exists() and review_path.exists():
            try:
                review = read_json(review_path)
            except Exception:
                review = {}
            if str(review.get('status') or '').strip().lower() == 'accepted':
                print(f'canonical infograph already accepted: {repo_path(image_path)}')
                print(f'requested node {requested_node_id} maps to canonical node {node_id}')
                return

    output_dir = node_infograph_dir(args.lesson, node_id)
    source_path = output_dir / 'source.json'
    prompt_path = output_dir / 'prompt.md'
    if not source_path.exists() or not prompt_path.exists():
        raise SystemExit('Run prepare_infograph_source.py before registering an image.')

    if args.latest_codex_image:
        image_path = latest_codex_image()
        if image_path is None:
            raise SystemExit('No Codex generated image found under ~/.codex/generated_images')
    elif args.image:
        image_path = Path(args.image).expanduser().resolve()
    else:
        raise SystemExit('Provide --image or --latest-codex-image')

    if not image_path.exists():
        raise SystemExit(f'Image not found: {image_path}')

    target = node_infograph_path(args.lesson, node_id)
    copy_image(image_path, target)
    source = read_json(source_path)

    write_json(output_dir / 'generation.json', {
        'schema_version': 1,
        'created_at': now_iso(),
        'lesson_id': args.lesson,
        'node_id': node_id,
        'requested_node_id': requested_node_id,
        'generation_path': args.generation_path,
        'requested_model': 'gpt-image-2.5',
        'model': args.reported_model or None,
        'model_evidence': 'operator-reported-response' if args.reported_model else 'not-disclosed',
        'tool_contract': 'Codex image_gen with optional reference images' if args.generation_path == 'codex-native-image-generation' else 'OpenAI Images API',
        'formal_parameters_available': {
            'prompt': True,
            'reference_images': True,
            'model': args.generation_path == 'openai-image-api',
            'quality': args.generation_path == 'openai-image-api',
            'size': args.generation_path == 'openai-image-api',
            'reasoning_effort': False,
            'output_format': args.generation_path == 'openai-image-api',
        },
        'source_image': image_path.as_posix(),
        'output_image': repo_path(target),
        'prompt_path': repo_path(prompt_path),
        'source_path': repo_path(source_path),
    })
    write_json(output_dir / 'review.json', {
        'schema_version': 1,
        'updated_at': now_iso(),
        'lesson_id': args.lesson,
        'node_id': node_id,
        'requested_node_id': requested_node_id,
        'node_name': source.get('node', {}).get('name'),
        'status': 'accepted' if args.accept else 'needs_review',
        'checks': {
            'source_json_exists': True,
            'prompt_md_exists': True,
            'image_exists': True,
            'no_obvious_text_corruption': args.accept,
            'no_unsupported_fact_observed': args.accept,
            'readable_at_entry_card_size': args.accept,
        },
        'note': args.note,
    })
    print(repo_path(target))
    print(repo_path(output_dir / 'generation.json'))
    print(repo_path(output_dir / 'review.json'))


if __name__ == '__main__':
    main()
