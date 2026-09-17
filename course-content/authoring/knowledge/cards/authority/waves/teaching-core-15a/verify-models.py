"""Distinguish internal, asymptotic, marginal and BIBO stability from original models."""
import json
import math
from pathlib import Path
import numpy as np
from scipy.integrate import solve_ivp

BATCH=Path(__file__).resolve().parent
models={}
# Imaginary-axis crossing of a unity-negative-feedback loop.
for K in [5.,6.,7.]:
 roots=np.roots([1,3,2,K])
 if K==5:assert np.max(roots.real)<0
 if K==7:assert np.max(roots.real)>0
 if K==6:assert np.allclose(np.poly([-3,1j*math.sqrt(2),-1j*math.sqrt(2)]),[1,3,2,6])
models['imaginary_crossing']={'openLoop':'K/[s(s+1)(s+2)]','feedback':'negative unity',
 'characteristic':'s^3+3s^2+2s+K','stableGainInterval':'0<K<6','criticalK':6,
 'criticalPoles':[[-3,0],[0,math.sqrt(2)],[0,-math.sqrt(2)]]}
t=np.linspace(0,20,4001)
# Simple imaginary roots: bounded zero-input motion does not establish BIBO.
y=solve_ivp(lambda t,x:[x[1],math.sin(t)-x[0]],[0,20],[0.,0.],t_eval=t,rtol=1e-11,atol=1e-13).y[0]
resonance=.5*(np.sin(t)-t*np.cos(t))
assert np.max(abs(y-resonance))<1e-8
models['oscillator']={'equation':'y_ddot+y=u','poles':[[0,1],[0,-1]],
 'zeroInputInitialState':[1,0],'zeroInputOutput':'cos(t)',
 'boundedResonantInput':'sin(t)','zeroStateResponse':'(sin(t)-t*cos(t))/2',
 'internallyLyapunovStable':True,'asymptoticallyStable':False,'BIBOStable':False}
# Scalar LHP/RHP and a stable zero-state impulse response bound.
models['half_planes']={'lhp':{'equation':'x_dot=-2x','solution':'x0 exp(-2t)'},
 'rhp':{'equation':'x_dot=x','solution':'x0 exp(t)'},
 'boundary':'continuous-time eigenvalues; discrete-time stability uses the unit disk'}
sine=solve_ivp(lambda t,y:[2*math.sin(t)-2*y[0]],[0,20],[0.],t_eval=t,rtol=1e-11,atol=1e-13).y[0]
assert np.max(abs(sine-(.8*np.sin(t)-.4*np.cos(t)+.4*np.exp(-2*t))))<1e-9
models['stable_sine']={'G':'2/(s+2)','input':'sin(t)','zeroInitialState':True,'response':'0.8sin(t)-0.4cos(t)+0.4exp(-2t)'}
assert np.allclose(np.roots([1,4,4]),[-2,-2])
models['rhp_zero_stable_channel']={'G':'(s-1)/(s+2)^2','zero':1,'poles':[-2,-2],
 'impulseResponse':'exp(-2t)-3t exp(-2t)','absoluteImpulseIntegralUpperBound':1.25}
models['stable_bibo']={'G':'2/(s+2)','impulseResponse':'2exp(-2t) for t>=0',
 'absoluteImpulseIntegral':1.,'zeroStateInputBound':'abs(u)<=M implies abs(y)<=M',
 'boundary':'causal zero-state input-output claim; hidden states require separate internal analysis'}
# Conditional gain stability via one concrete proper rational loop, not a guessed trace.
# D(s)+K N(s), N=1-s, D=s^3+2s^2+3s-2.
for K in [1.,2.4,3.]:
 coeff=np.array([1.,2.,3.-K,K-2.]);roots=np.roots(coeff)
 if K==2.4:assert np.max(roots.real)<0
 else:assert np.max(roots.real)>0
assert np.allclose(np.poly([-2,1j/math.sqrt(3),-1j/math.sqrt(3)]),[1,2,1/3,2/3])
models['conditional_gain']={'plant':'(1-s)/(s^3+2s^2+3s-2)','controller':'positive scalar K',
 'feedback':'negative unity','closedCharacteristic':'s^3+2s^2+(3-K)s+(K-2)',
 'routhFirstColumn':['1','2','(8-3K)/2','K-2'],'strictStableInterval':'2<K<8/3',
 'testedGains':[1.,2.4,3.],'boundary':'open-loop plant has unstable pole and RHP zero; statement applies only to this explicit loop'}
assert abs(2.4/(2.4-2)-6)<1e-10
rotation=np.array([[0.,1.],[-1.,0.]])
assert np.allclose(rotation.T+rotation,0)
defective=np.array([[0.,1.],[0.,0.]])
assert np.allclose(defective@defective,0)
# Semisimple repeated zero roots versus a defective zero root.
models['motion']={'semisimpleA':[[0,0],[0,0]],'semisimpleMotion':'constant initial state',
 'defectiveA':[[0,1],[0,0]],'defectiveInitialState':[0,'epsilon'],
 'defectiveMotion':['epsilon*t','epsilon'],
 'boundary':'imaginary-axis eigenvalues require semisimple Jordan blocks for Lyapunov stability; strict LHP is needed for asymptotic stability'}
(BATCH/'model-verification.json').write_text(json.dumps({'status':'passed','stage':'models-before-authoring','models':models},ensure_ascii=False,indent=2)+'\n')
print(json.dumps(models,ensure_ascii=False,indent=2))
