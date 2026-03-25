#!/usr/bin/env python3
"""验证 2-3 讲义例题中的典型频率响应数值。"""

from __future__ import annotations

import math

import control


def polar(value: complex) -> tuple[float, float]:
    magnitude = abs(value)
    phase_deg = math.degrees(math.atan2(value.imag, value.real))
    return magnitude, phase_deg


def main() -> None:
    print('=== 例题一：G(s)=1/(0.5s+1), ω=4 ===')
    system_a = control.tf([1], [0.5, 1])
    value_a = control.evalfr(system_a, 1j * 4)
    mag_a, phase_a = polar(value_a)
    print(f'|G(j4)| = {mag_a:.6f}')
    print(f'∠G(j4) = {phase_a:.3f}°')
    print(f'输出振幅 = {2 * mag_a:.6f}')
    print()

    print('=== 例题二：G(s)=1/(s+1), ω=0.2 与 5 ===')
    system_b = control.tf([1], [1, 1])
    for omega, input_amp in [(0.2, 1.0), (5.0, 0.5)]:
        value_b = control.evalfr(system_b, 1j * omega)
        mag_b, phase_b = polar(value_b)
        print(f'ω = {omega:>4.1f} rad/s')
        print(f'  |G(jω)| = {mag_b:.6f}')
        print(f'  ∠G(jω) = {phase_b:.3f}°')
        print(f'  输出振幅 = {input_amp * mag_b:.6f}')


if __name__ == '__main__':
    main()
