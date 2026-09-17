"""Original-equation verification for eight physical modeling teaching cards."""
import json
import math
from pathlib import Path
import numpy as np
from scipy.integrate import solve_ivp

BATCH = Path(__file__).resolve().parent
models = {}
t = np.linspace(0, 15, 3001)
# Single fixed principal axis, constant inertia, ideal PD and external torque.
free = solve_ivp(lambda t, x: [x[1], .4/2], [0, 15], [0., 0.], t_eval=t,
                 rtol=1e-11, atol=1e-13).y[0]
assert np.allclose(free, .1*t*t, atol=1e-9)
closed = solve_ivp(lambda t, x: [x[1], (.4-4*x[1]-8*x[0])/2], [0, 15], [0., 0.],
                   t_eval=t, rtol=1e-11, atol=1e-13).y[0]
expected = .05*(1-np.exp(-t)*(np.cos(math.sqrt(3)*t)+np.sin(math.sqrt(3)*t)/math.sqrt(3)))
assert np.allclose(closed, expected, atol=1e-9)
models['attitude_disturbance'] = {
    'equation': 'J theta_ddot = u + d', 'J_kg_m2': 2, 'stepDisturbanceNm': .4,
    'zeroInitialState': True, 'freeThetaRad': '0.1 t^2',
    'controller': 'u=-8 theta-4 theta_dot; reference=0',
    'closedEquation': '2 theta_ddot+4 theta_dot+8 theta=0.4',
    'thetaFinalRad': .05, 'finalControlNm': -.4,
    'boundary': 'illustrative single-axis linear model; no claim that all spacecraft torques are constant or that PD rejects constant torque without offset'
}
# Newton force balance; x measured from equilibrium so gravity is already balanced.
x = solve_ivp(lambda t, x: [x[1], (2-4*x[1]-8*x[0])/2], [0, 15], [0., 0.],
              t_eval=t, rtol=1e-11, atol=1e-13).y[0]
assert np.allclose(x, expected*5, atol=1e-9)
models['newton'] = {'equation': '2 x_ddot=F-4 x_dot-8 x', 'massKg': 2,
    'dampingNsPerM': 4, 'stiffnessNPerM': 8, 'stepForceN': 2,
    'initialAccelerationMPerS2': 1, 'finalDisplacementM': .25,
    'boundary': 'inertial coordinate, linear spring and viscous damping, displacement from equilibrium'}
# Similar first-order thermal and electrical systems after explicit scaling.
first = solve_ivp(lambda t, x: [(2-2*x[0])/2], [0, 15], [0.], t_eval=t,
                  rtol=1e-11, atol=1e-13).y[0]
assert np.allclose(first, 1-np.exp(-t), atol=1e-9)
models['similar_first_order'] = {
    'thermal': 'C_th DeltaT_dot+DeltaT/R_th=P; C_th=2 J/K, R_th=0.5 K/W, P=2 W',
    'electrical': 'C V_dot+V/R=I; C=2 F, R=0.5 ohm, I=2 A',
    'scaledCoordinates': 'DeltaT/(1 K), V/(1 V), t/(1 s)',
    'commonEquation': 'z_prime+z=1', 'zeroInitialState': True,
    'timeConstantSeconds': 1, 'atOneSecond': 1-math.exp(-1),
    'boundary': 'linear lumped parameters and matched scaled inputs; physical temperature and voltage remain different quantities'
}
# Exact state-coordinate correspondence for a second-order analogy.
q = solve_ivp(lambda t, x: [x[1], (.5-x[1]-x[0]/.5)/.5], [0, 15], [0., 0.],
              t_eval=t, rtol=1e-11, atol=1e-13).y[0]
assert np.allclose(q, x, atol=1e-9)
models['isomorphic_second_order'] = {
    'mechanical': '2 x_ddot+4 x_dot+8 x=2 step(t)',
    'electrical': '0.5 q_ddot+q_dot+2 q=0.5 step(t)',
    'electricalParameters': 'L=0.5 H,R=1 ohm,C=0.5 F',
    'scaledStateMap': '[x/(1 m), x_dot/(1 m/s)] <-> [q/(1 C), i/(1 A)]',
    'scaledTime': 'tau=t/(1 s)', 'commonEquation': 'z_second+2 z_first+4 z=1',
    'initialConditions': 'both states zero',
    'boundary': 'state map requires matching derivative state and forcing, not merely equal pole locations'
}
# Two unbuffered RC stages: nodal equations include loading from stage two.
loaded = solve_ivp(lambda t, x: [1-2*x[0]+x[1], x[0]-x[1]], [0, 15], [0., 0.],
                   t_eval=t, rtol=1e-11, atol=1e-13).y[1]
poles = np.roots([1,3,1]);a,b = poles
loadedExact = 1+(b*np.exp(a*t)-a*np.exp(b*t))/(a-b)
assert np.allclose(loaded, loadedExact, atol=1e-9)
for s in [.3, 1j, 3]:
    # (s+2)v1-v2=u, -v1+(s+1)v2=0.
    result = np.linalg.solve(np.array([[s+2,-1],[-1,s+1]], dtype=complex), [1,0])
    assert abs(result[1]-1/(s*s+3*s+1)) < 1e-12
alpha=.5;lower=alpha/(1+alpha);ratio=lower/(1-alpha+lower)
assert abs(ratio-.4)<1e-12
models['loading'] = {'components': 'R1=R2=1 ohm,C1=C2=1 F',
    'nodalEquations': 'v1_dot=u-2v1+v2; v2_dot=v1-v2',
    'unbufferedTransfer': '1/(s^2+3s+1)', 'idealBufferedTransfer': '1/(s+1)^2',
    'magnitudeAtOneRadPerSecond': {'unbuffered': 1/3, 'buffered': .5},
    'loadedPotentiometer': 'total R=1 ohm, load=1 ohm, lower fraction alpha=0.5: output/input=0.4; unloaded=0.5',
    'boundary': 'buffer must isolate loading; multiplying isolated component transfers requires appropriate ports'}
# Signal-block series and parallel interconnections, with no loading.
series = solve_ivp(lambda t, x: [1-x[0], 2*x[0]-2*x[1]], [0,15], [0.,0.],
                   t_eval=t, rtol=1e-11, atol=1e-13).y[1]
parallel = solve_ivp(lambda t, x: [1-x[0], 2-2*x[1]], [0,15], [0.,0.],
                     t_eval=t, rtol=1e-11, atol=1e-13).y.sum(axis=0)
assert np.allclose(series, 1-2*np.exp(-t)+np.exp(-2*t), atol=1e-9)
assert np.allclose(parallel, 2-np.exp(-t)-np.exp(-2*t), atol=1e-9)
models['series'] = {'G1': '1/(s+1)', 'G2': '2/(s+2)', 'transfer': '2/((s+1)(s+2))', 'unitStep': '1-2 exp(-t)+exp(-2t)', 'finalValue': 1, 'zeroInitialState': True}
models['parallel'] = {'G1': '1/(s+1)', 'G2': '2/(s+2)', 'output': 'y=y1+y2', 'transfer': '(3s+4)/((s+1)(s+2))', 'unitStep': '2-exp(-t)-exp(-2t)', 'finalValue': 2, 'zeroInitialState': True}
# Sensor first-order lag, calibrated voltage output from angular position.
sensor = solve_ivp(lambda t, x: [(2*.1-x[0])/.1], [0,1], [0.],
                   t_eval=[.1,1], rtol=1e-11, atol=1e-13).y[0]
assert abs(sensor[0]-.2*(1-math.exp(-1)))<1e-10
h = 2/(1+.1j)
models['sensor'] = {'transferVPerRad': '2/(0.1s+1)', 'stepAngleRad': .1,
    'outputAt0_1SecondsV': float(sensor[0]), 'finalOutputV': .2,
    'magnitudeAtOneRadPerSecondVPerRad': abs(h), 'phaseDegrees': math.degrees(np.angle(h)),
    'calibration': 'divide voltage by 2 V/rad; calibrated DC gain is 1 but lag remains',
    'boundary': 'no saturation, noise or calibration drift included; measured signal must share units with reference before subtraction'}
report={'status':'passed','stage':'models-before-authoring','models':models}
(BATCH/'model-verification.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print('PASS: eight original-equation cases, analytic response and frequency checks')
