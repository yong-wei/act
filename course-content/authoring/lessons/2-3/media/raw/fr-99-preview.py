import argparse
from pathlib import Path

import matplotlib.pyplot as plt
import matplotlib.image as mpimg

from matplotlib_font import configure_matplotlib_for_cjk


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description='Generate 2-3 illustration preview PNG.')
    parser.add_argument(
        '--output',
        type=Path,
        default=Path(__file__).resolve().parent.parent / 'processed' / 'fr-99-illustrations-preview.png',
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    args.output.parent.mkdir(parents=True, exist_ok=True)
    configure_matplotlib_for_cjk()
    processed = Path(__file__).resolve().parent.parent / 'processed'

    cover = mpimg.imread(processed / 'cover-comic.png')

    fig = plt.figure(figsize=(13, 7.6), dpi=180)
    fig.patch.set_facecolor('#f8fafc')
    ax = fig.add_subplot(111)
    ax.axis('off')
    ax.imshow(cover)
    ax.set_title('2-3 配图预览：封面漫画（其余 3 张为 SVG 文件，请直接打开查看）', fontsize=16, fontweight='bold', pad=16)

    plt.tight_layout()
    plt.savefig(args.output, dpi=180, bbox_inches='tight')
    print(f'已生成：{args.output}')


if __name__ == '__main__':
    main()
