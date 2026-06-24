#!/usr/bin/env python3
from __future__ import annotations

import argparse
import csv
import json
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class PlotView:
    name: str
    xlim: tuple[float, float] | None = None
    ylim: tuple[float, float] | None = None
    role: str = 'standalone'


@dataclass
class MatchedRootLocus:
    gains: list[float]
    branches: list[list[complex]]


def _float(row: dict[str, str], *names: str, default: float = 0.0) -> float:
    for name in names:
        if name in row and row[name] != '':
            return float(row[name])
    return default


def load_samples_csv(path: Path) -> list[list[complex]]:
    with path.open(newline='', encoding='utf-8') as handle:
        reader = csv.DictReader(handle)
        rows = list(reader)
    if not rows:
        return []

    # Wide format: k, re1, im1, re2, im2 ...
    if any(name.startswith('re') for name in rows[0]):
        samples: list[list[complex]] = []
        re_names = sorted(
            [name for name in rows[0] if name.startswith('re')],
            key=lambda name: int(name[2:] or '1'),
        )
        for row in rows:
            points = []
            for re_name in re_names:
                suffix = re_name[2:]
                im_name = f'im{suffix}'
                if re_name in row and im_name in row:
                    points.append(complex(float(row[re_name]), float(row[im_name])))
            samples.append(points)
        return samples

    # Long format: k, branch, real/re, imag/im.
    grouped: dict[float, list[tuple[int, complex]]] = {}
    for row in rows:
        gain = _float(row, 'k', 'gain')
        branch = int(_float(row, 'branch', 'branch_id', default=0))
        point = complex(_float(row, 'real', 're'), _float(row, 'imag', 'im'))
        grouped.setdefault(gain, []).append((branch, point))
    return [[point for _, point in sorted(points)] for _, points in sorted(grouped.items())]


def load_complex_points_csv(path: Path) -> list[complex]:
    if not path.exists():
        return []
    with path.open(newline='', encoding='utf-8') as handle:
        reader = csv.DictReader(handle)
        return [complex(_float(row, 'real', 're'), _float(row, 'imag', 'im')) for row in reader]


def load_views_json(path: Path) -> list[PlotView]:
    if not path.exists():
        return []
    payload = json.loads(path.read_text(encoding='utf-8'))
    if isinstance(payload, dict):
        payload = payload.get('views', [])
    views = []
    for item in payload:
        views.append(
            PlotView(
                name=item['name'],
                xlim=tuple(item['xlim']) if item.get('xlim') else None,
                ylim=tuple(item['ylim']) if item.get('ylim') else None,
                role=item.get('role', 'standalone'),
            )
        )
    return views


def match_root_locus_branches(samples: list[list[complex]]) -> MatchedRootLocus:
    if not samples:
        return MatchedRootLocus(gains=[], branches=[])
    branch_count = len(samples[0])
    branches = [[point] for point in samples[0]]

    for points in samples[1:]:
        remaining = list(points)
        assigned: list[complex] = []
        for branch in branches:
            previous = branch[-1]
            if not remaining:
                assigned.append(previous)
                continue
            best_index = min(range(len(remaining)), key=lambda idx: abs(remaining[idx] - previous))
            assigned.append(remaining.pop(best_index))
        for branch, point in zip(branches, assigned):
            branch.append(point)

    return MatchedRootLocus(gains=list(range(len(samples))), branches=branches[:branch_count])


def write_matched_csv(path: Path, matched: MatchedRootLocus) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open('w', newline='', encoding='utf-8') as handle:
        writer = csv.writer(handle)
        writer.writerow(['branch', 'index', 're', 'im'])
        for branch_index, branch in enumerate(matched.branches, start=1):
            for point_index, point in enumerate(branch):
                writer.writerow([branch_index, point_index, f'{point.real:.12g}', f'{point.imag:.12g}'])


def audit_root_locus(
    *,
    matched: MatchedRootLocus,
    open_loop_poles: list[complex],
    open_loop_zeros: list[complex],
    endpoint_tol: float = 1e-3,
    views: list[PlotView] | None = None,
) -> dict:
    starts = [branch[0] for branch in matched.branches if branch]
    start_distances = [
        min((abs(start - pole) for pole in open_loop_poles), default=None)
        for start in starts
    ]
    max_start_error = max((d for d in start_distances if d is not None), default=None)
    return {
        'branchCount': len(matched.branches),
        'sampleCount': max((len(branch) for branch in matched.branches), default=0),
        'openLoopPoleCount': len(open_loop_poles),
        'openLoopZeroCount': len(open_loop_zeros),
        'maxStartError': max_start_error,
        'endpointTolerance': endpoint_tol,
        'startsNearOpenLoopPoles': max_start_error is None or max_start_error <= endpoint_tol,
        'views': [
            {'name': view.name, 'xlim': view.xlim, 'ylim': view.ylim, 'role': view.role}
            for view in (views or [])
        ],
    }


def main() -> None:
    parser = argparse.ArgumentParser(description='Match Octave rlocus samples into continuous branches.')
    parser.add_argument('--samples', required=True, type=Path)
    parser.add_argument('--out-branches', required=True, type=Path)
    parser.add_argument('--out-report', required=True, type=Path)
    parser.add_argument('--poles', type=Path)
    parser.add_argument('--zeros', type=Path)
    args = parser.parse_args()

    matched = match_root_locus_branches(load_samples_csv(args.samples))
    write_matched_csv(args.out_branches, matched)
    report = audit_root_locus(
        matched=matched,
        open_loop_poles=load_complex_points_csv(args.poles) if args.poles else [],
        open_loop_zeros=load_complex_points_csv(args.zeros) if args.zeros else [],
    )
    args.out_report.parent.mkdir(parents=True, exist_ok=True)
    args.out_report.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')


if __name__ == '__main__':
    main()
