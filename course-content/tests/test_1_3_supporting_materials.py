from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
LESSON_DIR = ROOT / 'authoring' / 'lessons' / '1-3'
DESIGN_DIR = LESSON_DIR / 'design'
MEDIA_DIR = LESSON_DIR / 'media' / 'processed'


def read(name: str) -> str:
    return (DESIGN_DIR / name).read_text(encoding='utf-8')


def test_teacher_handout_uses_correct_stability_and_parameter_stage_language():
    teacher = read('1-3-teacher-handout.md')

    assert 'BIBO 稳定' in teacher
    assert '加速与振荡的同步' not in teacher
    assert '加速和振荡是一对孪生效果' not in teacher
    assert '69秒' not in teacher
    assert '52.44' not in teacher


def test_boppps_contains_real_student_participation_and_three_item_post_test():
    boppps = read('1-3-boppps.md')

    assert '个人判断' in boppps
    assert '同伴核对' in boppps
    assert '参数滑块' in boppps
    assert 'P₃｜Post-assessment 后测（6min）' in boppps
    assert boppps.count('后测题 ') == 3
    assert '加速与振荡同步' not in boppps


def test_interactive_human_read_design_uses_native_diagram_and_curve_panels():
    design = read('1-3-interactive-page.md')

    assert '`visual.blockDiagram`' in design
    assert 'control-linked-comparison' in design
    assert 'control-root-locus-design-map' in design
    assert '近 70s' not in design
    assert '一对孪生效果' not in design
    assert '静态图仅作为加载失败时的后备证据' in design


def test_multimedia_spec_matches_real_generation_outputs():
    spec = read('1-3-multimedia.md')

    assert 'Octave control 包计算并直接成图' in spec
    assert 'Python复绘：如需要' not in spec
    assert (MEDIA_DIR / '1-3-media.md').exists()
    for stem in (
        '1-3-fig-01-open-loop-scaling',
        '1-3-fig-02-open-closed-loop',
        '1-3-fig-03-closed-loop-responses',
        '1-3-fig-04-root-locus',
    ):
        assert (MEDIA_DIR / f'{stem}.png').exists()
