"""Verify causal input and response examples before nine-card authoring."""
import json
import math
from pathlib import Path
import numpy as np
from scipy.integrate import solve_ivp, quad

BATCH=Path(__file__).resolve().parent
models={};t=np.linspace(0,5,1001)
models['impulse_response']={'G':'2/(s+1)','equation':'y_dot+y=2u','input':'unit Dirac impulse at zero',
    'initialCondition':'y(0-)=0','stateJump':'y(0+)=2','responseForTPositive':'2exp(-t)',
    'boundary':'unit area, not unit height; impulse response describes zero-state behavior, with the impulse included across t=0'}
for s in [.3,1.,3.]:
    F=(s+2)/((s+1)*(s+3))
    assert abs(F-(.5/(s+1)+.5/(s+3)))<1e-12
    integral=quad(lambda tau:math.exp(-s*tau)*(.5*math.exp(-tau)+.5*math.exp(-3*tau)),0,np.inf)[0]
    assert abs(integral-F)<1e-9
    repeated=quad(lambda tau:tau*math.exp(-(s+1)*tau),0,np.inf)[0]
    assert abs(repeated-1/(s+1)**2)<1e-9
models['heaviside_expansion']={'F':'(s+2)/((s+1)(s+3))','residues':{'atMinus1':.5,'atMinus3':.5},
    'inverse':'.5exp(-t)+.5exp(-3t)','repeatedPoleExample':{'F':'1/(s+1)^2','inverse':'t exp(-t)'},
    'boundary':'simple-pole cover-up residues do not replace the repeated-pole derivative/expansion rule; causal inverse in its convergence region'}
phi=math.pi/6;omega=3.;amp=2.
for s in [.5,1.,3.]:
    value=quad(lambda tau:math.exp(-s*tau)*amp*math.sin(omega*tau+phi),0,np.inf,limit=300)[0]
    expected=amp*(s*math.sin(phi)+omega*math.cos(phi))/(s*s+omega*omega)
    assert abs(value-expected)<1e-8
models['sinusoid']={'inputForTNonnegative':'2sin(3t+pi/6)','amplitude':2,'angularFrequency':3,
    'phaseRadians':'pi/6','period':'2pi/3','frequencyCyclesPerUnitTime':'3/(2pi)',
    'initialRightValue':1,'causalLaplace':'(s+3sqrt(3))/(s^2+9)',
    'boundary':'frequency is not angular frequency; phase must use the same angular convention as the trigonometric argument'}
free=solve_ivp(lambda t,y:[-y[0]],[0,5],[3.],t_eval=t,rtol=1e-12,atol=1e-14).y[0]
total=solve_ivp(lambda t,y:[-y[0]+2],[0,5],[3.],t_eval=t,rtol=1e-12,atol=1e-14).y[0]
assert np.allclose(free,3*np.exp(-t),atol=1e-10)
assert np.allclose(total,free+2*(1-np.exp(-t)),atol=1e-10)
models['natural_response']={'equation':'y_dot+y=2u','initialOutput':3,'zeroInput':'3exp(-t)',
    'unitStepZeroState':'2(1-exp(-t))','unitStepTotalFromY0_3':'2+exp(-t)',
    'boundary':'distinguish zero-input decomposition from the homogeneous term relative to a chosen particular solution; total transient exp(-t) is not the zero-input term 3exp(-t)'}
ramp=solve_ivp(lambda t,y:[-y[0]+2*t],[0,5],[0.],t_eval=t,rtol=1e-12,atol=1e-14).y[0]
assert np.allclose(ramp,2*(t-1+np.exp(-t)),atol=1e-10)
for tau in [.1,1.,3.]:
    convolution=quad(lambda v:2*math.exp(-(tau-v))*v,0,tau)[0]
    assert abs(convolution-2*(tau-1+math.exp(-tau)))<1e-12
models['convolution']={'impulseResponse':'2exp(-t) for t>=0','input':'u(t)=t for t>=0',
    'zeroStateOutput':'2(t-1+exp(-t))','integral':'integral_0^t 2exp(-(t-tau))*tau d tau',
    'nonzeroInitialAddition':'3exp(-t) when y(0)=3',
    'boundary':'convolution gives zero-state LTI response; nonzero initial state adds free response'}
# Delayed step solved after switching; before delay the state remains zero.
after=np.linspace(1,5,801)
y=solve_ivp(lambda t,y:[-y[0]+6],[1,5],[0.],t_eval=after,rtol=1e-12,atol=1e-14).y[0]
assert np.allclose(y,6*(1-np.exp(-(after-1))),atol=1e-10)
models['step_input']={'input':'3 H(t-1)','amplitude':3,'delay':1,'laplace':'3exp(-s)/s',
    'plant':'2/(s+1)','output':'0 for t<1; 6(1-exp(-(t-1))) for t>=1',
    'boundary':'input jumps at the switching time; this strictly proper plant output stays continuous for a finite step'}
models['typical_inputs']={'causalTransforms':[{'signal':'H(t)','laplace':'1/s'},
    {'signal':'t H(t)','laplace':'1/s^2'}, {'signal':'0.5 t^2 H(t)','laplace':'1/s^3'},
    {'signal':'delta(t)','laplace':'1'}, {'signal':'sin(3t) H(t)','laplace':'3/(s^2+9)'}],
    'boundary':'normalized ideal test signals; unit acceleration convention uses 0.5 t^2, not t^2'}
for s in [.5,1.,3.]:
    for power,scale in [(0,1),(1,1),(2,.5)]:
        value=quad(lambda tau:scale*tau**power*math.exp(-s*tau),0,np.inf)[0]
        assert abs(value-1/s**(power+1))<1e-8
pulse_cases=[]
for eps in [.1,.01]:
    area=quad(lambda tau:1/eps,0,eps)[0];assert abs(area-1)<1e-12
    trace=solve_ivp(lambda t,y:[-y[0]+2/eps],[0,eps],[0.],t_eval=[eps],rtol=1e-12,atol=1e-14).y[0,0]
    value=trace*math.exp(-(1-eps));expected=2*math.expm1(eps)/eps*math.exp(-1)
    assert abs(value-expected)<1e-10
    pulse_cases.append({'width':eps,'height':1/eps,'area':area,'responseAt1':float(value)})
assert abs(pulse_cases[1]['responseAt1']-2/math.e)<abs(pulse_cases[0]['responseAt1']-2/math.e)
models['unit_impulse']={'pulseApproximation':'height=1/epsilon on [0,epsilon), zero elsewhere','cases':pulse_cases,
    'idealResponseAt1':2/math.e,'pulseResponseAfterEpsilon':'(2/epsilon)(exp(epsilon)-1)exp(-t)',
    'boundary':'Dirac is a distribution with unit area; a height-one pulse shrinking in width has area approaching zero'}
y=solve_ivp(lambda t,y:[-y[0]+2*(1-y[0])],[0,5],[0.],t_eval=t,rtol=1e-12,atol=1e-14).y[0]
assert np.allclose(y,2/3*(1-np.exp(-3*t)),atol=1e-10)
control=2*(1-y);assert control[0]==2
models['reference_input']={'plant':'1/(s+1)','controller':'u=2(r-y)','reference':'unit step',
    'output':'(2/3)(1-exp(-3t))','control':'2/3+(4/3)exp(-3t)',
    'initialReference':1,'initialControl':2,'finalOutput':'2/3','finalError':'1/3',
    'boundary':'reference is a desired output command, not necessarily actuator input or achieved output'}
zero_input_zero_state=solve_ivp(lambda t,y:[-y[0]],[0,1],[0.],t_eval=[1.]).y[0,0]
assert zero_input_zero_state==0 and 2/math.e>0
report={'status':'passed','stage':'models-before-authoring','timeConvention':'normalized time; a one-second scale gives corresponding rad/s and Hz','models':models}
lines=(json.dumps(report,ensure_ascii=False,indent=2)+'\n').splitlines(keepends=True)
with (BATCH/'model-verification.json').open('w') as f:
    for i in range(0,len(lines),300):f.writelines(lines[i:i+300])
print('PASS: nine input/response models, ODE and quadrature checks')
