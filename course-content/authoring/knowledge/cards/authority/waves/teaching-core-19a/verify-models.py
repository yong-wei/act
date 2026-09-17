"""Original controller and plant examples with source-qualified Z-N settings."""
import json,math
from pathlib import Path
import numpy as np
from scipy.integrate import solve_ivp
from scipy.optimize import brentq
BATCH=Path(__file__).resolve().parent
models={};t=np.linspace(0,20,2001)
models['proportional']={'plant':'1/(s+1)','controller':'Kp','negativeUnityFeedback':True,'cases':[]}
for kp in [1.,3.]:
 y=solve_ivp(lambda t,y:[kp-(1+kp)*y[0]],[0,20],[0.],t_eval=t,rtol=1e-11,atol=1e-13).y[0]
 analytic=kp/(1+kp)*(1-np.exp(-(1+kp)*t));assert np.max(abs(y-analytic))<1e-9
 models['proportional']['cases'].append({'Kp':kp,'finalOutput':kp/(1+kp),'steadyError':1/(1+kp),'timeConstant':1/(1+kp),'initialControl':kp})
pi_cases=[]
for kp in [1.,2.]:
 ki=1.;solution=solve_ivp(lambda t,x:[-x[0]+kp*(1-x[0])+ki*x[1],1-x[0]],[0,20],[0.,0.],t_eval=t,rtol=1e-11,atol=1e-13).y
 if kp==1:
  response=lambda v:1-np.exp(-np.asarray(v))
 else:
  slow=(-3+math.sqrt(5))/2;fast=(-3-math.sqrt(5))/2
  response=lambda v:1-((5-math.sqrt(5))/10)*np.exp(slow*np.asarray(v))-((5+math.sqrt(5))/10)*np.exp(fast*np.asarray(v))
 assert np.max(abs(solution[0]-response(t)))<1e-8
 pi_cases.append({'Kp':kp,'Ki':ki,'Ti':kp/ki,'t50':brentq(lambda v:float(response(v))-.5,0,20),'twoPercentSettling':brentq(lambda v:float(response(v))-.98,0,30),'initialControl':kp,'finalOutput':1,'finalControl':1})
models['pi_trials']={'plant':'1/(s+1)','states':'y_dot=-y+Kp*(1-y)+Ki*z; z_dot=1-y','zeroInitialState':True,'cases':pi_cases,
 'boundary':'finite candidate comparison; earlier t50 need not imply shorter settling time'}
I=solve_ivp(lambda t,x:[-x[0]+x[1],1-x[0]],[0,20],[0.,0.],t_eval=t,rtol=1e-11,atol=1e-13).y[0]
Iexact=1-np.exp(-t/2)*(np.cos(math.sqrt(3)*t/2)+np.sin(math.sqrt(3)*t/2)/math.sqrt(3))
assert np.max(abs(I-Iexact))<1e-8
assert abs(.5+2*.25*4-2*.25*4-.5)<1e-12
models['integral']={'controller':'1/s','plant':'1/(s+1)','closedTransfer':'1/(s^2+s+1)',
 'stateRuleExample':{'Ki':2,'initialControl':.5,'constantError':.25,'duration':4,'finalControl':2.5},
 'boundary':'integrator output persists when error becomes zero; closed-loop behavior depends on plant'}
filtered=solve_ivp(lambda t,d:[(.5-d[0])/.1],[0,20],[0.],t_eval=t,rtol=1e-11,atol=1e-13).y[0]
assert np.max(abs(filtered-.5*(1-np.exp(-10*t))))<1e-9
models['pd']={'error':'e(t)=t for t>=0','Kp':2,'Kd':.5,'idealControl':'2t+0.5 for t>0',
 'filteredDerivative':'0.5s/(1+0.1s)','filteredControl':'2t+0.5(1-exp(-10t))',
 'boundary':'ramp error avoids a derivative impulse; a step error would produce an impulse for ideal D'}
clip=lambda x:max(-1,min(1,2*x));h=1e-6
assert abs(clip(.25)/.25-2)<1e-12 and abs(clip(1)/1-1)<1e-12
assert abs((clip(1+h)-clip(1-h))/(2*h))<1e-12
models['equivalent_gain']={'nonlinearity':'clip(2x,-1,1)','cases':[{'x':.25,'ratio':2,'incrementalSlope':2},{'x':1,'ratio':1,'incrementalSlope':0}],
 'atZero':'ratio undefined; this particular continuous extension is 2','boundary':'static secant gain, not incremental gain or a describing function'}
aug=solve_ivp(lambda t,x:[-2*x[0]+x[1],1-x[0]],[0,20],[0.,0.],t_eval=t,rtol=1e-11,atol=1e-13).y
assert np.max(abs(aug[0]-(1-(1+t)*np.exp(-t))))<1e-8
assert np.max(abs(aug[1]-(2-(t+2)*np.exp(-t))))<1e-8
models['integral_augmentation']={'plant':'x_dot=-x+u; y=x','integralState':'z_dot=r-x','control':'u=-x+z','reference':'unit step','zeroInitialState':True,
 'Aclosed':[[-2,1],[-1,0]],'output':'1-(1+t)exp(-t)','z':'2-(t+2)exp(-t)','controlResponse':'1-exp(-t)',
 'boundary':'reference enters the integral state only; not identical to proportional action on reference error'}
# Z-N ultimate-gain example on a strictly stable open-loop plant.
D=np.array([1.,6.,11.,6.]);assert np.max(np.roots(D).real)<0
Ku=60.;Pu=2*math.pi/math.sqrt(11)
assert np.allclose(np.poly([-6,1j*math.sqrt(11),-1j*math.sqrt(11)]),[1,6,11,66])
Kp=.6*Ku;Ti=Pu/2;Td=Pu/8;Ki=Kp/Ti;Kd=Kp*Td
closed=[1,6,11+Kd,6+Kp,Ki];poles=np.roots(closed);assert np.max(poles.real)<0
models['zn_tuning']={'plant':'1/((s+1)(s+2)(s+3))','method':'ultimate gain, P only for boundary calculation','Ku':Ku,'Pu':Pu,
 'idealForm':'Kp(1+1/(Ti*s)+Td*s)','Kp':Kp,'Ti':Ti,'Td':Td,'Ki':Ki,'Kd':Kd,
 'closedCharacteristic':closed,'closedPoles':[[float(p.real),float(p.imag)] for p in poles],
 'boundary':'strictly stable plant; ideal derivative and nominal model only, not actual actuator/performance assurance'}
assert abs((2+.5*(1j*1e8)/(1+.1j*1e8))-7)<1e-6
assert abs((2*180/math.pi)*(math.pi/6)-60)<1e-10
assert clip(.4)+clip(.4)!=clip(.8)
models['proportional_units']={'perDegree':2,'perRadian':2*180/math.pi,'errorDegrees':30,'control':60}
(BATCH/'model-verification.json').write_text(json.dumps({'status':'passed','stage':'models-before-authoring','models':models},ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'verified':list(models),'piTrials':pi_cases,'pending':None},ensure_ascii=False,indent=2))
