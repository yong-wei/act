"""Verify normalized first/second-order models and damping boundaries."""
import json
import math
from pathlib import Path
import numpy as np
from scipy.integrate import solve_ivp
from scipy.optimize import brentq

BATCH=Path(__file__).resolve().parent
models={}
def step(t,zeta,wn):
    t=np.asarray(t)
    if zeta==1:return 1-(1+wn*t)*np.exp(-wn*t)
    if zeta<1:
        wd=wn*math.sqrt(1-zeta*zeta)
        return 1-np.exp(-zeta*wn*t)*(np.cos(wd*t)+zeta/math.sqrt(1-zeta*zeta)*np.sin(wd*t))
    root=math.sqrt(zeta*zeta-1)
    slow=-wn*(zeta-root);fast=-wn*(zeta+root)
    return 1+(fast*np.exp(slow*t)-slow*np.exp(fast*t))/(slow-fast)
def poles(zeta,wn):
    return [[float(p.real),float(p.imag)] for p in np.roots([1,2*zeta*wn,wn*wn])]
t=np.linspace(0,12,2401)
for zeta,wn in [(0.,2.),(.5,2.),(1.,2.),(2.,2.),(.5,3.),(.125,2.)]:
    trace=solve_ivp(lambda t,x:[x[1],wn*wn*(1-x[0])-2*zeta*wn*x[1]],
                    [0,12],[0.,0.],t_eval=t,rtol=1e-11,atol=1e-13).y[0]
    assert np.allclose(trace,step(t,zeta,wn),atol=1e-8)
wn=2.;zeta=.5;wd=math.sqrt(3);tp=math.pi/wd;mp=math.exp(-math.pi/math.sqrt(3))
assert abs(float(step(tp,zeta,wn))-(1+mp))<1e-12
models['underdamped_system']={'T':'4/(s^2+2s+4)','zeta':.5,'wn':2,'wd':'sqrt(3)',
    'poles':poles(.5,2),'unitStep':'1-exp(-t)(cos(sqrt(3)t)+sin(sqrt(3)t)/sqrt(3))',
    'peakTime':tp,'fractionalOvershoot':mp,'boundary':'stable zero-free unit-DC-gain standard second-order system, zero initial state; not every higher-order complex pole implies the same visible step shape'}
assert math.sqrt(8/2)==2 and (4/2)/(2*math.sqrt(8/2))==.5
models['natural_frequency_coefficients']={'equation':'2 y_ddot+4 y_dot+8 y=8r',
    'normalizedDenominator':'s^2+2s+4','wn':'sqrt(a0/a2)=2','zeta':.5,
    'boundary':'normalize the leading coefficient before identifying wn; the coefficient 4 is wn squared, not wn'}
free=solve_ivp(lambda t,x:[x[1],-4*x[0]],[0,12],[1.,0.],t_eval=t,rtol=1e-11,atol=1e-13).y
assert np.allclose(free[0],np.cos(2*t),atol=1e-8)
assert np.allclose(.5*free[1]**2+2*free[0]**2,2,atol=1e-8)
models['undamped_natural_frequency']={'equation':'q_ddot+4q=0','initialState':[1,0],
    'freeResponse':'cos(2t)','wn':2,'period':'pi','constantEnergy':2,
    'unitStepForUnityGainModel':'1-cos(2t)',
    'boundary':'zero damping gives persistent oscillation, not convergence; wn is not generally the damped transient frequency'}
T=2.;gain=3.
first=solve_ivp(lambda t,y:[(gain-y[0])/T],[0,12],[0.],t_eval=t,rtol=1e-11,atol=1e-13).y[0]
assert np.allclose(first,3*(1-np.exp(-t/2)),atol=1e-9)
models['time_constant']={'G':'3/(2s+1)','T':2,'DCGain':3,'unitStep':'3(1-exp(-t/2))',
    'fractionAtT':1-math.exp(-1),'outputAtT':3*(1-math.exp(-1)),
    'exact2PercentSettlingTime':-2*math.log(.02),'fourT':8,
    'boundary':'one time constant means 63.2 percent of the total change in this first-order model, not 63.2 percent of the input amplitude'}
models['damping_ratio']={'normalizedMass':1,'stiffness':4,'criticalDampingCoefficient':4,
    'dampingCases':[{'c':c,'zeta':c/4} for c in [0,2,4,8]],
    'formula':'zeta=c/(2sqrt(mk))','boundary':'damping ratio is dimensionless and depends on mass/stiffness as well as damping coefficient'}
critical90=brentq(lambda tau:float(step(tau,1,2))-.9,0,20)
models['critical_damping']={'T':'4/(s+2)^2','zeta':1,'wn':2,'poles':[[-2,0],[-2,0]],
    'unitStep':'1-(1+2t)exp(-2t)','stepDerivative':'4t exp(-2t)', 't90':critical90,
    'boundary':'monotone standard zero-free step response; fastest nonoscillatory comparison only under matched model conditions such as fixed wn'}
Tm=2.;K=8.
assert math.sqrt(K/Tm)==2 and 1/(2*math.sqrt(K*Tm))==.125
models['natural_frequency_parameter_model']={'equation':'T_m y_ddot+y_dot+K y=K r',
    'T_m':Tm,'K':K,'wn':2,'zeta':.125,'normalizedDenominator':'s^2+0.5s+4',
    'poles':poles(.125,2),'boundary':'source formula sqrt(K/T_m) belongs to this parameterized model; changing K also changes zeta if T_m is fixed'}
assert abs(math.hypot(1,math.sqrt(3))-2)<1e-12
models['natural_frequency_symbol']={'poleGeometry':'wn=sqrt(sigma^2+wd^2)','basePoles':poles(.5,2),
    'wn2PeakTime':tp,'wn3PeakTime':math.pi/(3*math.sqrt(.75)),
    'sameZetaOvershoot':mp,'boundary':'wn is pole modulus for the standard underdamped pair, not its imaginary part; time scaling at fixed zeta preserves fractional overshoot'}
models['underdamped_range']={'stableRange':'0<zeta<1','wn':2,
    'stableExample':{'zeta':.5,'poles':poles(.5,2)},
    'undampedBoundary':{'zeta':0,'poles':poles(0,2)},
    'negativeDampingCounterexample':{'zeta':-.5,'poles':poles(-.5,2)},
    'boundary':'complex poles with positive real part describe growing oscillation, not the stable underdamped case used here'}
over90=brentq(lambda tau:float(step(tau,2,2))-.9,0,30)
assert over90>critical90
assert np.all(np.diff(step(t,2,2))>=0)
models['overdamped']={'zeta':2,'wn':2,'T':'4/(s^2+8s+4)','poles':poles(2,2),
    'slowPole':'-4+2sqrt(3)','fastPole':'-4-2sqrt(3)', 't90':over90,'criticalT90AtSameWn':critical90,
    'boundary':'standard zero-free unit-gain step response and fixed wn; more damping does not automatically mean faster settling across arbitrary systems'}
models['damped_natural_frequency']={'zeta':.5,'wn':2,'wd':'sqrt(3)',
    'formula':'wd=wn sqrt(1-zeta^2)','transientPeriod':2*math.pi/wd,
    'firstPeakTime':tp,'nextPositivePeakTime':3*math.pi/wd,
    'boundary':'adjacent maximum/minimum spacing is half a period; consecutive positive overshoot peaks are one full damped period apart'}
report={'status':'passed','stage':'models-before-authoring','timeConvention':'normalized time','models':models}
lines=(json.dumps(report,ensure_ascii=False,indent=2)+'\n').splitlines(keepends=True)
with (BATCH/'model-verification.json').open('w') as f:
    for i in range(0,len(lines),300):f.writelines(lines[i:i+300])
print('PASS: eleven damping/frequency topics, original ODE traces and boundary checks')
