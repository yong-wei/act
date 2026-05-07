#!/usr/bin/env python3
from __future__ import annotations

import argparse

from infograph_utils import (
    canonical_sequence,
    node_card_path,
    node_group_map,
    node_infograph_dir,
    node_infograph_path,
    load_all_authoring_nodes,
    load_sequence,
    read_json,
    repo_path,
    selected_infograph_ref,
)
from canonical_nodes import load_canonical_index


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description='List lesson knowledge nodes without accepted infographics.')
    parser.add_argument('--lesson', required=True, help='Lesson id such as 3-8')
    parser.add_argument('--all', action='store_true', help='Show generated nodes as well as missing nodes')
    return parser.parse_args()


def status_for_node(lesson_id: str, node_id: str) -> str:
    selected = selected_infograph_ref(node_id)
    source_lesson_id = selected['lesson_id'] if selected else lesson_id
    source_node_id = selected['node_id'] if selected else node_id
    if not selected:
        canonical_entry = load_canonical_index().entry_for(node_id) or {}
        owner_lesson = str(canonical_entry.get('owner_lesson') or '').strip()
        if owner_lesson and owner_lesson != lesson_id:
            owner_review_path = node_infograph_dir(owner_lesson, node_id) / 'review.json'
            owner_image_path = node_infograph_path(owner_lesson, node_id)
            if owner_image_path.exists() and owner_review_path.exists():
                try:
                    owner_review = read_json(owner_review_path)
                except Exception:
                    owner_review = {}
                if str(owner_review.get('status') or '').strip().lower() == 'accepted':
                    return 'accepted'
    image_path = node_infograph_path(source_lesson_id, source_node_id)
    review_path = node_infograph_dir(source_lesson_id, source_node_id) / 'review.json'
    if not image_path.exists():
        return 'missing'
    if not review_path.exists():
        return 'image_without_review'
    try:
        review = read_json(review_path)
    except Exception:
        return 'review_broken'
    status = str(review.get('status') or '').strip().lower()
    if status == 'accepted':
        return 'accepted'
    return status or 'review_pending'


def main() -> None:
    args = parse_args()
    sequence = canonical_sequence(load_sequence(args.lesson))
    nodes = load_all_authoring_nodes(args.lesson)
    groups_by_node = node_group_map(sequence)

    print(f'lesson: {args.lesson}')
    print('index\tstatus\tnode_id\tname\tgroups\tcard')
    for index, node_id in enumerate(sequence.get('card_order', []), start=1):
        node_id = str(node_id)
        status = status_for_node(args.lesson, node_id)
        if status == 'accepted' and not args.all:
            continue
        node = nodes.get(node_id, {})
        card_path = node_card_path(node_id)
        print(
            f'{index}\t{status}\t{node_id}\t{node.get("name", node_id)}\t'
            f'{", ".join(groups_by_node.get(node_id, [])) or "-"}\t'
            f'{repo_path(card_path) if card_path.exists() else "missing"}'
        )


if __name__ == '__main__':
    main()
