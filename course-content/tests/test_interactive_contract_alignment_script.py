from __future__ import annotations

import subprocess
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]
SCRIPT_PATH = REPO_ROOT / '.agents' / 'skills' / 'interactive-lesson' / 'scripts' / 'check_contract_alignment.py'


def test_skill_contract_alignment_script_passes_for_2_1() -> None:
    subprocess.run(
        [
            'python3',
            str(SCRIPT_PATH),
            '--lesson',
            '2-1',
        ],
        cwd=str(REPO_ROOT),
        check=True,
    )


def test_skill_contract_alignment_script_passes_for_2_2() -> None:
    subprocess.run(
        [
            'python3',
            str(SCRIPT_PATH),
            '--lesson',
            '2-2',
        ],
        cwd=str(REPO_ROOT),
        check=True,
    )


def test_skill_contract_alignment_script_passes_for_3_2() -> None:
    subprocess.run(
        [
            'python3',
            str(SCRIPT_PATH),
            '--lesson',
            '3-2',
        ],
        cwd=str(REPO_ROOT),
        check=True,
    )


def test_skill_contract_alignment_script_passes_for_4_1() -> None:
    subprocess.run(
        [
            'python3',
            str(SCRIPT_PATH),
            '--lesson',
            '4-1',
        ],
        cwd=str(REPO_ROOT),
        check=True,
    )


def test_skill_contract_alignment_script_reports_extended_contract_drift(tmp_path: Path) -> None:
    contract_path = tmp_path / 'interactive-contract.yaml'
    implementation_path = tmp_path / 'demo-course.ts'

    contract_path.write_text(
        """
{
  "lesson_id": "demo-contract",
  "steps": {
    "step-01": {
      "title": "示例",
      "layout": {
        "template": "curve_board",
        "regions": [{"id": "main", "width": "full", "order": 1}],
        "reading_order": ["对象", "图像与曲线"]
      },
      "modules": [],
      "content_blocks": [],
      "interaction_spec": {
        "interaction_kind": "parameter_slider",
        "interaction_archetype": "parametric_sim"
      },
      "teacher_controls": [],
      "telemetry_spec": {"summary_fields": ["viewed"], "misconception_tags": ["tag-a"]},
      "teacher_insight_spec": {"widgets": ["view_count"]},
      "ai_context_spec": {"delivery_mode": "hidden_page_context"},
      "preview_contract": {"demo_path": "/demo?step=step-01"},
      "acceptance_checks": [],
      "interactive_figure_spec": {
        "layout_mirror": "2x2",
        "controls": {"placement": "below_figure", "collapsed_by_default": true}
      }
    }
  }
}
""".strip(),
        encoding='utf-8',
    )
    implementation_path.write_text(
        """
export const DEMO_PAGE_CONTRACTS = {
  'step-01': {
    layout: {
      template: 'other_board',
      regions: [{ id: 'main', width: 'full', order: 1 }],
      readingOrder: ['对象']
    },
    interactionKind: 'parameter_slider',
    interactionArchetype: 'wrong_archetype',
    teacherInsightWidgets: ['other_widget'],
    telemetrySummaryFields: ['other_field'],
    misconceptionTags: ['other_tag'],
    aiDeliveryMode: 'visible_panel',
    figureLayoutMirror: 'single',
    controlsPlacement: 'side_panel',
    controlsCollapsedByDefault: false,
    previewDemoPath: '/other?step=step-01',
  },
};

export const DEMO_LESSON_STEPS = [
  { id: 'step-01', title: '示例', pageType: 'parameter_slider', aiContext: { deliveryMode: 'visible_panel' } },
];
""".strip(),
        encoding='utf-8',
    )

    completed = subprocess.run(
        [
            'python3',
            str(SCRIPT_PATH),
            '--contract',
            str(contract_path),
            '--implementation',
            str(implementation_path),
            '--page-contract-const',
            'DEMO_PAGE_CONTRACTS',
            '--step-const',
            'DEMO_LESSON_STEPS',
        ],
        cwd=str(REPO_ROOT),
        text=True,
        capture_output=True,
        check=False,
    )

    assert completed.returncode != 0
    stderr = completed.stderr or completed.stdout
    assert 'layout.reading_order' in stderr
    assert 'interactionArchetype' in stderr
    assert 'aiDeliveryMode' in stderr
    assert 'figureLayoutMirror' in stderr
    assert 'controlsPlacement' in stderr
    assert 'controlsCollapsedByDefault' in stderr
