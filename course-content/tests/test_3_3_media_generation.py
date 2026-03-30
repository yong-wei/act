import re
from pathlib import Path


SVG_FILES = [
    'course-content/authoring/lessons/3-3/media/processed/3-3-pp-01-root-locus-roadmap.svg',
    'course-content/authoring/lessons/3-3/media/processed/3-3-pp-02-generalized-root-locus-map.svg',
    'course-content/authoring/lessons/3-3/media/processed/3-3-pp-03-angle-and-magnitude-geometry.svg',
    'course-content/authoring/lessons/3-3/media/processed/3-3-pp-04-complete-rules-example.svg',
    'course-content/authoring/lessons/3-3/media/processed/3-3-pp-05-real-axis-parity.svg',
    'course-content/authoring/lessons/3-3/media/processed/3-3-pp-06-departure-arrival-angle.svg',
    'course-content/authoring/lessons/3-3/media/processed/3-3-pp-07-generalized-time-constant-example.svg',
    'course-content/authoring/lessons/3-3/media/processed/3-3-pp-08-dynamics-translation.svg',
]


def test_3_3_svg_assets_do_not_contain_raw_latex_delimiters() -> None:
    for rel_path in SVG_FILES:
        text = Path(rel_path).read_text(encoding='utf-8')
        text = re.sub(r'<!--.*?-->', '', text, flags=re.DOTALL)
        assert '$' not in text, f'{rel_path} still contains raw LaTeX delimiters'


def test_3_3_layout_regressions_are_fixed() -> None:
    pp04 = Path('course-content/authoring/lessons/3-3/media/processed/3-3-pp-04-complete-rules-example.svg').read_text(encoding='utf-8')
    assert '先看起点终点与实轴区段，再用渐近线搭骨架，最后用分离点和虚轴交点修正关键节点。' not in pp04
    assert '先看起点终点与实轴区段，再用渐近线搭骨架，' in pp04
    assert '最后用分离点和虚轴交点修正关键节点。' in pp04

    pp06 = Path('course-content/authoring/lessons/3-3/media/processed/3-3-pp-06-departure-arrival-angle.svg').read_text(encoding='utf-8')
    assert '起始角和终止角承担的是局部修正任务。先用整图法则确定骨架，再用切线方向修正复极点和复零点附近的局部形状。' not in pp06
    assert '起始角和终止角负责局部修正。' in pp06
    assert '先用整图法则确定骨架，' in pp06
    assert '再用切线方向修正复极点和复零点附近的形状。' in pp06

    pp07 = Path('course-content/authoring/lessons/3-3/media/processed/3-3-pp-07-generalized-time-constant-example.svg').read_text(encoding='utf-8')
    assert 'id="axes_3"' not in pp07
