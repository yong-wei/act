from __future__ import annotations

import control as ct
import numpy as np


def main() -> None:
    s = ct.TransferFunction.s
    G = 4 / (s * (0.5 * s + 1) * (0.2 * s + 1))
    T = ct.feedback(G, 1)

    gm, pm, w_g, w_c = ct.margin(G)
    w_b = ct.bandwidth(T)

    print(f'gm = {gm:.6f}')
    print(f'gm_db = {20 * np.log10(gm):.6f}')
    print(f'pm = {pm:.6f}')
    print(f'w_g = {w_g:.6f}')
    print(f'w_c = {w_c:.6f}')
    print(f'w_b = {w_b:.6f}')


if __name__ == '__main__':
    main()
