from __future__ import annotations

import json
import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
RAW_DIR = ROOT / 'course-content' / 'authoring' / 'lessons' / '3-8' / 'media' / 'raw'
DATA_DIR = RAW_DIR / 'generated-data'

ROOT_LOCUS_ARTIFACTS = [
    ('effects-gain-base', 3, True),
    ('effects-gain-new', 3, True),
    ('effects-zero-base', 3, True),
    ('effects-zero-new', 3, True),
    ('effects-pole-base', 3, True),
    ('effects-pole-new', 4, True),
    ('effects-rhp-zero-base', 3, True),
    ('effects-rhp-zero-new', 3, True),
    ('platform-baseline', 5, True),
]


def _run_generation_pipeline() -> None:
    subprocess.run(
        ['octave', '-qf', str(RAW_DIR / 'generate_design_data.m')],
        cwd=ROOT,
        check=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
    )
    subprocess.run(
        ['python3', str(RAW_DIR / 'render_figures.py')],
        cwd=ROOT,
        check=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
    )


def test_3_8_pipeline_emits_root_locus_branch_match_artifacts() -> None:
    _run_generation_pipeline()

    for stem, _, _ in ROOT_LOCUS_ARTIFACTS:
        matched_csv = DATA_DIR / f'{stem}-root-locus-points.csv'
        audit_json = DATA_DIR / f'{stem}-root-locus-audit.json'
        assert matched_csv.exists(), f'missing matched branches csv: {matched_csv}'
        assert audit_json.exists(), f'missing root-locus audit json: {audit_json}'


def test_3_8_root_locus_audits_cover_finite_zeros_and_branch_counts() -> None:
    _run_generation_pipeline()

    for stem, expected_branch_count, expect_zero_coverage in ROOT_LOCUS_ARTIFACTS:
        report = json.loads((DATA_DIR / f'{stem}-root-locus-audit.json').read_text(encoding='utf-8'))
        assert report['branch_count'] == expected_branch_count, stem
        assert report['expected_branch_count'] == expected_branch_count, stem
        assert report['finite_zero_coverage']['all_matched_within_tolerance'] is expect_zero_coverage, stem
