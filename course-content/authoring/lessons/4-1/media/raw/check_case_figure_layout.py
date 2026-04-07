from __future__ import annotations

import json
from pathlib import Path

DATA_PATH = Path(__file__).resolve().parent / 'generated-data' / '4-1-case-data.json'


def main() -> None:
    payload = json.loads(DATA_PATH.read_text(encoding='utf-8'))

    ship = payload['cases']['ship_heading']
    platform = payload['cases']['platform_pitch']

    # Regression guard 1:
    # platform root-locus viewport must show the pair of complex open-loop poles
    # around -93 ± 55j, otherwise the plot gets visually truncated and misleading.
    x_min, x_max = platform['root_xlim']
    y_min, y_max = platform['root_ylim']
    relevant_platform_poles = [
        (r, i)
        for r, i in zip(platform['open_loop_poles']['real'], platform['open_loop_poles']['imag'])
        if abs(i) > 1e-9
    ]
    assert relevant_platform_poles, 'platform case should contain complex open-loop poles'
    for r, i in relevant_platform_poles:
        assert x_min <= r <= x_max and y_min <= i <= y_max, (
            'platform root-locus viewport excludes a relevant open-loop pole: '
            f'({r:.3f}, {i:.3f}) not in x={platform["root_xlim"]}, y={platform["root_ylim"]}'
        )

    # Regression guard 2:
    # ship root-locus panel uses both a note box and a legend; keep them in separate corners.
    # This is stored as render metadata because pure image OCR is fragile.
    assert ship.get('root_note_anchor') == 'upper_right', (
        'ship root-locus note box should move away from legend area; '
        f'got {ship.get("root_note_anchor")!r}'
    )
    assert ship.get('root_legend_loc') == 'upper left', (
        'ship root-locus legend location unexpectedly changed'
    )


if __name__ == '__main__':
    main()
