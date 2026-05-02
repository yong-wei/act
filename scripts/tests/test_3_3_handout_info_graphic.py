from __future__ import annotations

from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
HANDOUT_PATH = ROOT / 'course-content/authoring/lessons/3-3/design/3-3-handout.md'


def main() -> None:
    text = HANDOUT_PATH.read_text(encoding='utf-8')

    summary_heading = '## 六、本讲小结与前后衔接'
    appendix_heading = '## 附录 A 伊万斯与根轨迹法的提出'
    infographic = '![本讲信息图总结](../media/processed/3-3-info.png){fig-pos="H"}'

    assert summary_heading in text, '缺少本讲小结标题'
    assert appendix_heading in text, '缺少附录标题'
    assert infographic in text, '缺少 3-3 文末信息图'

    summary_index = text.index(summary_heading)
    appendix_index = text.index(appendix_heading)
    infographic_index = text.index(infographic)

    assert summary_index < infographic_index < appendix_index, '信息图未位于本讲小结与附录之间'

    print('test_3_3_handout_info_graphic passed')


if __name__ == '__main__':
    main()
