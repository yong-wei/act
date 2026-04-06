import control as ct
import numpy as np


s = ct.TransferFunction.s
plant = 0.01715 / (s * (s + 0.1) * (s + 2.14375))

variants = {
    'baseline': 2.25,
    'zero_line': 2.25 * ((s / 0.08) + 1) / ((s / 0.5) + 1),
    'pi_weak': 2.25 * (1 + 1 / (200 * s)),
    'pi_strong': 2.25 * (1 + 1 / (40 * s)),
    'pi_corrected': 2.25 * (1 + 1 / (40 * s)) * ((s / 0.05) + 1) / ((s / 0.5) + 1),
    'lag': 2.25 * 2 * ((40 * s) + 1) / ((80 * s) + 1),
}


def ramp_error(sys, t_end=400.0, dt=0.1):
    t = np.arange(0.0, t_end + dt, dt)
    r = t
    tout, y = ct.forced_response(sys, t, r)
    e = r - y
    return {
        'e100': float(e[np.searchsorted(tout, 100.0)]),
        'e200': float(e[np.searchsorted(tout, 200.0)]),
        'e400': float(e[-1]),
    }


for name, controller in variants.items():
    loop = controller * plant
    closed = ct.feedback(loop, 1)
    gm, pm, wg, wp = ct.margin(loop)
    info = ct.step_info(closed)
    errors = ramp_error(closed)
    poles = ct.poles(closed)

    print(f'[{name}]')
    print('controller =', controller)
    print('closed poles =', ', '.join(f'{p.real:.4f}{p.imag:+.4f}j' for p in poles))
    print(
        f"step: OS={info['Overshoot']:.2f}%, "
        f"Ts={info['SettlingTime']:.2f}s, "
        f"Tr={info['RiseTime']:.2f}s, "
        f"Tp={info['PeakTime']:.2f}s"
    )
    print(
        f'phase margin={pm:.2f} deg, '
        f'gain margin={20 * np.log10(gm):.2f} dB, '
        f'wc={wp:.4f} rad/s, wg={wg:.4f} rad/s'
    )
    print(
        f"ramp error: e(100)={errors['e100']:.4f}, "
        f"e(200)={errors['e200']:.4f}, "
        f"e(400)={errors['e400']:.4f}"
    )
    print()
