"""Verify fixed teaching models before prose authoring; no runtime simulator."""
import json
import math
from pathlib import Path
import numpy as np
from scipy.integrate import solve_ivp

BATCH = Path(__file__).resolve().parent
models = {}
t = np.linspace(0, 30, 601)
# Illustrative linear yaw-rate model: seconds, degrees, degrees/second.
T, K, rudder = 5., .2, 10.
trace = solve_ivp(lambda t, x: [(K*rudder-x[0])/T, x[0]],
                  [0, 30], [0., 0.], t_eval=t, rtol=1e-11, atol=1e-13).y
r = K*rudder*(1-np.exp(-t/T))
heading = K*rudder*(t-T*(1-np.exp(-t/T)))
assert np.allclose(trace[0], r, atol=1e-8)
assert np.allclose(trace[1], heading, atol=1e-8)
assert math.isclose(r[100], 2*(1-math.exp(-1)), abs_tol=1e-12)
# A different initial rate under the same input demonstrates state dependence.
r_initial_one = solve_ivp(lambda t, x: [(2-x[0])/5], [0, 5], [1.],
                          t_eval=[5.], rtol=1e-11, atol=1e-13).y[0, 0]
assert abs(r_initial_one-(2-math.exp(-1))) < 1e-9
models['yaw_rate'] = {
    'originalEquation': '5 r_dot + r = 0.2 delta; psi_dot = r',
    'units': {'time': 's', 'delta': 'deg', 'r': 'deg/s', 'psi': 'deg', 'K': '1/s'},
    'parametersAreIllustrative': True,
    'input': 'delta(t)=10 deg for t>=0; zero initial r and psi',
    'rAt5Seconds': float(r[100]), 'rFinal': 2.,
    'headingAt5Seconds': float(heading[100]),
    'rAt5SecondsWithInitialRateOne': float(r_initial_one),
    'ratePole': -.2, 'headingHasIntegrator': True,
    'validity': 'linear approximation near a fixed speed and operating condition; no heading convergence under constant rudder'
}
# A fast state retained in the more detailed model changes transient and bandwidth.
t2 = np.linspace(0, 10, 2001)
y = solve_ivp(lambda t, x: [x[1], (1-1.05*x[1]-x[0])/.05],
              [0, 10], [0., 0.], t_eval=t2, rtol=1e-11, atol=1e-13).y[0]
exact = 1-(20*np.exp(-t2)-np.exp(-20*t2))/19
reduced = 1-np.exp(-t2)
assert np.allclose(y, exact, atol=1e-9)
frequency = []
for w in [.2, 20.]:
    high = 1/((1+1j*w)*(1+.05j*w))
    low = 1/(1+1j*w)
    ratio = high/low
    assert abs(ratio-1/(1+.05j*w)) < 1e-12
    frequency.append({'omegaRadPerSecond': w, 'magnitudeRatioDetailedToReduced': abs(ratio),
                      'extraPhaseDegrees': math.degrees(np.angle(ratio))})
models['fidelity'] = {
    'detailedEquation': '0.05 y_ddot + 1.05 y_dot + y = u',
    'reducedEquation': 'y_dot + y = u',
    'inputAndInitialState': 'unit step; all states initially zero',
    'detailedStep': '1-(20 exp(-t)-exp(-20t))/19',
    'reducedStep': '1-exp(-t)',
    'initialSlopeDetailed': 0, 'initialSlopeReduced': 1,
    'frequencyComparison': frequency,
    'maxAbsoluteStepDifferenceOn0To10Grid': float(max(abs(exact-reduced))),
    'validity': 'model-to-model comparison, not experimental proof that the more detailed model is true'
}
# Physical equations are solved separately before comparing scaled coordinates.
t3 = np.linspace(0, 12, 2401)
mechanical = solve_ivp(lambda t, x: [x[1], (2-4*x[1]-8*x[0])/2],
                       [0, 12], [0., 0.], t_eval=t3, rtol=1e-11, atol=1e-13).y[0]
electrical = solve_ivp(lambda t, x: [x[1], (.5-1*x[1]-x[0]/.5)/.5],
                       [0, 12], [0., 0.], t_eval=t3, rtol=1e-11, atol=1e-13).y[0]
analytic = .25*(1-np.exp(-t3)*(np.cos(math.sqrt(3)*t3)+np.sin(math.sqrt(3)*t3)/math.sqrt(3)))
assert np.allclose(mechanical, electrical, atol=1e-10)
assert np.allclose(mechanical, analytic, atol=1e-9)
models['physical_similarity'] = {
    'mechanical': {'equation': 'm x_ddot+c x_dot+k x=F', 'mKg': 2, 'cNsPerM': 4, 'kNPerM': 8, 'stepForceN': 2},
    'electrical': {'equation': 'L q_ddot+R q_dot+q/C=V', 'LHenries': .5, 'ROhms': 1, 'CFarads': .5, 'stepVoltageV': .5},
    'scaledCoordinates': 'X=x/(1 m), Q=q/(1 C), tau=t/(1 s)',
    'commonDimensionlessEquation': 'z_second + 2 z_first + 4 z = 1',
    'zeroInitialState': True, 'dimensionlessFinalValue': .25,
    'physicalFinalValues': {'xMeters': .25, 'qCoulombs': .25},
    'dimensionlessPoles': [[-1, math.sqrt(3)], [-1, -math.sqrt(3)]],
    'validity': 'same scaled differential equation and matched initial conditions; numerical agreement does not equate physical units'
}
report = {'status': 'passed', 'stage': 'models-before-authoring', 'models': models}
(BATCH/'model-verification.json').write_text(json.dumps(report, ensure_ascii=False, indent=2)+'\n')
print(json.dumps(report, ensure_ascii=False, indent=2))
