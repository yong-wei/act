import numpy as np


def first_order_step_response(t: np.ndarray, gain: float, time_constant: float) -> np.ndarray:
    return gain * (1.0 - np.exp(-t / time_constant))


def second_order_step_response(
    zeta: float,
    wn: float,
    duration: float | None = None,
    dt: float | None = None,
) -> tuple[np.ndarray, np.ndarray]:
    if duration is None:
        duration = max(8.0, 10.0 / max(wn, 1e-6))
    if dt is None:
        dt = min(0.005, duration / 2500.0)

    t = np.arange(0.0, duration + dt, dt)
    state = np.array([0.0, 0.0], dtype=float)
    y = np.zeros_like(t)

    def dynamics(x: np.ndarray) -> np.ndarray:
        position, velocity = x
        acceleration = wn * wn * (1.0 - position) - 2.0 * zeta * wn * velocity
        return np.array([velocity, acceleration], dtype=float)

    for idx in range(1, len(t)):
        k1 = dynamics(state)
        k2 = dynamics(state + 0.5 * dt * k1)
        k3 = dynamics(state + 0.5 * dt * k2)
        k4 = dynamics(state + dt * k3)
        state = state + (dt / 6.0) * (k1 + 2.0 * k2 + 2.0 * k3 + k4)
        y[idx] = state[0]

    return t, y


def time_domain_metrics(t: np.ndarray, y: np.ndarray, settle_band: float = 0.02) -> dict[str, float]:
    final_value = float(y[-1])
    rise_index = int(np.argmax(y >= final_value))
    peak_index = int(np.argmax(y))
    within = np.abs(y - final_value) <= settle_band * abs(final_value)
    future_outside = np.maximum.accumulate((~within)[::-1])[::-1]
    settle_candidates = np.where(~future_outside)[0]
    settling_index = int(settle_candidates[0]) if len(settle_candidates) else len(t) - 1

    peak_value = float(y[peak_index])
    overshoot = max(0.0, (peak_value - final_value) / final_value * 100.0)

    return {
        'final_value': final_value,
        'rise_time': float(t[rise_index]),
        'peak_time': float(t[peak_index]),
        'settling_time': float(t[settling_index]),
        'peak_value': peak_value,
        'overshoot_percent': overshoot,
        'settling_index': settling_index,
        'peak_index': peak_index,
        'rise_index': rise_index,
    }
