from __future__ import annotations

import csv
import hashlib
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parent / 'generated-data'
PROCESSED_DIR = Path(__file__).resolve().parent.parent / 'processed'
RUNTIME_MEDIA_DIR = Path(__file__).resolve().parents[5] / 'runtime' / 'lessons' / '3-9' / 'media'
VARIANTS = (
    'baseline',
    'zero_line',
    'pi_weak',
    'pi_strong',
    'pi_corrected',
    'lag',
)
MAX_JUMP_LIMIT = 0.25
PRESERVED_RUNTIME_ASSETS = (
    '3-9-cover-comic.png',
    '3-9-info.png',
)


def max_jump(path: Path) -> float:
    branches: dict[int, list[complex]] = {}
    with path.open(newline='', encoding='utf-8') as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            branches.setdefault(int(row['branch']), []).append(complex(float(row['re']), float(row['im'])))

    if not branches:
        raise AssertionError(f'{path.name} 中没有分支数据。')

    worst = 0.0
    for points in branches.values():
        for idx in range(len(points) - 1):
            worst = max(worst, abs(points[idx + 1] - points[idx]))
    return worst


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main() -> int:
    problems: list[str] = []

    for variant in VARIANTS:
        points_path = ROOT / f'{variant}_root_locus_points.csv'
        audit_path = ROOT / f'{variant}_root_locus_audit.json'

        if not points_path.exists():
            problems.append(f'{variant}: 缺少匹配后分支文件 {points_path.name}')
            continue
        if not audit_path.exists():
            problems.append(f'{variant}: 缺少审计文件 {audit_path.name}')
            continue

        report = json.loads(audit_path.read_text(encoding='utf-8'))
        if report['branch_count'] != report['expected_branch_count']:
            problems.append(
                f"{variant}: branch_count={report['branch_count']} 与 expected_branch_count={report['expected_branch_count']} 不一致"
            )
        if not report['finite_zero_coverage']['all_matched_within_tolerance']:
            problems.append(f'{variant}: 有限零点端点覆盖未通过')

        observed_max_jump = max_jump(points_path)
        if observed_max_jump > MAX_JUMP_LIMIT:
            problems.append(f'{variant}: 最大跳变 {observed_max_jump:.6f} 超过阈值 {MAX_JUMP_LIMIT:.6f}')

    for filename in PRESERVED_RUNTIME_ASSETS:
        processed_path = PROCESSED_DIR / filename
        runtime_path = RUNTIME_MEDIA_DIR / filename
        if not runtime_path.exists():
            problems.append(f'{filename}: 运行态原图缺失')
            continue
        if not processed_path.exists():
            problems.append(f'{filename}: 作者态图片缺失')
            continue
        if sha256(processed_path) != sha256(runtime_path):
            problems.append(f'{filename}: 作者态图片与运行态原图不一致，疑似被渲染图覆盖')

    if problems:
        raise SystemExit('根轨迹连续性检查失败：\n- ' + '\n- '.join(problems))

    print('根轨迹连续性检查通过。')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
