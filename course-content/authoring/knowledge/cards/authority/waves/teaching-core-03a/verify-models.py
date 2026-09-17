"""Verify local linearization examples before six-card authoring."""
import json
from pathlib import Path
import math
import numpy as np
from scipy.integrate import solve_ivp

BATCH=Path(__file__).resolve().parent
models={}
# Dimensionless scalar state and time; both signs of x are allowed.
u0=4.; roots=[-2.,2.]
for x0 in roots:
    assert u0-x0*x0==0
    h=1e-5
    derivative=((u0-(x0+h)**2)-(u0-(x0-h)**2))/(2*h)
    assert abs(derivative+2*x0)<1e-8
models['equilibria']={'system':'x_dot=u-x^2','stateAndTime':'dimensionless; x may have either sign',
    'constantInput':4,'equilibria':[-2,2], 'linearPolesAtMinus2AndPlus2':[4,-4],
    'classification':'-2 locally unstable; +2 locally asymptotically stable',
    'boundary':'equilibrium requires both a state and the specified constant input'}
# Static tangent includes offset in absolute coordinates, disappears only in increments.
tangent=[]
for dx in [.1,.5]:
    actual=(2+dx)**2
    approx=4+4*dx
    assert abs(actual-approx-dx*dx)<1e-12
    tangent.append({'deltaX':dx,'actual':actual,'approximation':approx,'absoluteRemainder':dx*dx})
models['static_tangent']={'g':'x^2','x0':2,'g0':4,'slope':4,'absoluteApproximation':'g(x) approximately 4+4(x-2)',
    'incrementApproximation':'delta_g approximately 4 delta_x','exactRemainder':'delta_x^2','samples':tangent,
    'boundary':'a tangent is local; absolute g=4x would lose the operating-point offset'}
# Stable equilibrium, fixed small step; compare original nonlinear ODE with linear ODE.
t=np.linspace(0,2,2001);du=.4
actual=solve_ivp(lambda t,x:[4+du-x[0]**2],[0,2],[2.],t_eval=t,rtol=1e-12,atol=1e-14).y[0]-2
linear=du/4*(1-np.exp(-4*t))
linearOde=solve_ivp(lambda t,x:[-4*x[0]+du],[0,2],[0.],t_eval=t,rtol=1e-12,atol=1e-14).y[0]
assert np.allclose(linearOde,linear,atol=1e-10)
nonlinearFinal=math.sqrt(4+du)-2
assert actual[-1]>0 and actual[-1]<nonlinearFinal
assert max(abs(actual-linear))<.003
models['small_signal']={'operatingPoint':{'x0':2,'u0':4},'exactIncrementEquation':'delta_x_dot=delta_u-4 delta_x-delta_x^2',
    'linearIncrementEquation':'delta_x_dot=-4 delta_x+delta_u', 'incrementTransfer':'1/(s+4)',
    'deltaInputStep':du,'initialIncrement':0,'linearStep':'0.1(1-exp(-4t))',
    'linearFinalIncrement':.1,'nonlinearFinalIncrement':nonlinearFinal,
    'maxAbsoluteDifferenceOn0To2Grid':float(max(abs(actual-linear))),
    'stateRangeOfLinearStep':[0,.1], 'quadraticToLinearStateTermRatioAtDeltaX0_1':.025,
    'boundary':'input size alone does not prove validity; check resulting state deviation and time interval'}
# Non-equilibrium expansion must retain constant drift.
x0=1.;f0=4-x0*x0
for dx in [0,.1,-.1]:
    exact=4-(x0+dx)**2
    assert abs(exact-(f0-2*x0*dx-dx*dx))<1e-12
models['non_equilibrium']={'x0':1,'u0':4,'constantDrift':3,
    'firstOrderEquation':'delta_x_dot approximately 3-2 delta_x+delta_u',
    'boundary':'fixed non-equilibrium operating point does not permit deleting f0; a nominal trajectory requires its own time-dependent expansion'}
# Vanishing Jacobian: the first-order model alone cannot decide nonlinear stability.
x_init=.1;ts=np.linspace(0,10,101)
minus=x_init/np.sqrt(1+2*x_init*x_init*ts)
plus=x_init/np.sqrt(1-2*x_init*x_init*ts)
for sign,expected in [(-1,minus),(1,plus)]:
    trace=solve_ivp(lambda t,x:[sign*x[0]**3],[0,10],[x_init],t_eval=ts,rtol=1e-12,atol=1e-14).y[0]
    assert np.allclose(trace,expected,atol=1e-10)
models['zero_jacobian_counterexample']={'systems':['x_dot=-x^3','x_dot=x^3'], 'equilibrium':0,
    'bothLinearizations':'delta_x_dot=0','nonlinearConclusions':['asymptotically stable','unstable'],
    'initialState':x_init,'xAt10ForMinusAndPlus':[float(minus[-1]),float(plus[-1])],
    'boundary':'zero real-part eigenvalues make first-order stability inference inconclusive; analytic solutions show opposite behavior'}
report={'status':'passed','stage':'models-before-authoring','models':models}
(BATCH/'model-verification.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(report,ensure_ascii=False,indent=2))
