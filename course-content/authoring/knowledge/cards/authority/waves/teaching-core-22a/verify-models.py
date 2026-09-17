"""Original feedback equations and derivatives for sensitivity examples."""
import json,math
from pathlib import Path
import numpy as np
from scipy.integrate import solve_ivp
BATCH=Path(__file__).resolve().parent
models={};k=2.;a=1.;p=1.
TF=lambda s,p=1.,a=1.:k*p/(s+a+k*p)
S=lambda s:(s+a)/(s+a+k*p)
for w in [0.,.3,2.,30.]:
 s=1j*w;L=k*p/(s+a);assert abs(1/(1+L)-S(s))<1e-12
 assert abs(S(s)+TF(s)-1)<1e-12
 h=1e-6
 dp=(TF(s,p+h)-TF(s,p-h))/(2*h);da=(TF(s,p,a+h)-TF(s,p,a-h))/(2*h)
 assert abs(p/TF(s)*dp-S(s))<1e-8
 assert abs(a/TF(s)*da+a/(s+a+k*p))<1e-8
models['loop_functions']={'P':'p/(s+a)','C':k,'nominalP':p,'nominalA':a,'L':'2/(s+1)',
 'S':'(s+1)/(s+3)','T':'2/(s+3)','outputDisturbance':'S','plantInputDisturbance':'1/(s+3)','measurementNoise':'-T',
 'atOmega2':{'S':[float(S(2j).real),float(S(2j).imag)],'T':[float(TF(2j).real),float(TF(2j).imag)],'sumMagnitudes':abs(S(2j))+abs(TF(2j))},
 'boundary':'S+T=1 is a complex identity, not |S|+|T|=1'}
models['parameter_derivatives']={'gainP':'S_p^T=(s+a)/(s+a+kp)','poleA':'S_a^T=-a/(s+a+kp)',
 'nominalDCGainSensitivity':1/3,'nominalDCPoleSensitivity':-1/3,
 'boundary':'normalized derivative requires nonzero parameter and nonzero transfer value'}
changes=[]
for delta in [.01,.5]:
 old=TF(0);new=TF(0,1+delta)
 changes.append({'fractionalParameterChange':delta,'exactFractionalTransferChange':(new-old)/old,'linearPrediction':delta/3})
models['finite_perturbations']={'parameter':'plant numerator p, controller and a fixed','cases':changes,
 'boundary':'first-order differential estimate is local; finite changes require exact recomputation'}
# Read each disturbance/noise placement from the original plant state.
t=np.linspace(0,12,1201)
reference=solve_ivp(lambda t,x:[2-3*x[0]],[0,12],[0.],t_eval=t,rtol=1e-11,atol=1e-13).y[0]
assert np.max(abs(reference-(2/3)*(1-np.exp(-3*t))))<1e-9
out_d=solve_ivp(lambda t,x:[-3*x[0]-2],[0,12],[0.],t_eval=t,rtol=1e-11,atol=1e-13).y[0]+1
assert np.max(abs(out_d-(1/3+(2/3)*np.exp(-3*t))))<1e-9
in_d=solve_ivp(lambda t,x:[1-3*x[0]],[0,12],[0.],t_eval=t,rtol=1e-11,atol=1e-13).y[0]
assert np.max(abs(in_d-(1/3)*(1-np.exp(-3*t))))<1e-9
models['channels']={'referenceStep':'(2/3)(1-exp(-3t))','outputDisturbanceStep':'1/3+(2/3)exp(-3t)',
 'inputDisturbanceStep':'(1/3)(1-exp(-3t))','measurementNoiseStep':'-(2/3)(1-exp(-3t))',
 'boundary':'negative unity feedback, output noise added only to measurement, not to physical output'}
# A stable near-critical loop can amplify sensitivity.
w=math.sqrt(2);s=1j*w;L=5.4/(s*(s+1)*(s+2));assert abs(L+.9)<1e-12
assert np.max(np.roots([1,3,2,5.4]).real)<0
assert abs(1/(1+L)-10)<1e-10
models['near_critical']={'L':'5.4/[s(s+1)(s+2)]','omega':w,'Lvalue':-.9,'Svalue':10,'Tvalue':-9,'closedStable':True,
 'boundary':'distance of complex L to -1 matters; magnitude alone is insufficient'}
y=lambda t,p=1.:k*p/(a+k*p)*(1-np.exp(-(a+k*p)*t))
times=[.1,1.,5.];results=[]
for time in times:
 analytic=a/(a+k*p)+k*p*time/np.expm1((a+k*p)*time)
 h=1e-6;numerical=p/y(time,p)*(y(time,p+h)-y(time,p-h))/(2*h)
 assert abs(analytic-numerical)<1e-8
 results.append({'time':time,'normalizedGainSensitivity':analytic})
models['time_response']={'step':'kp/(a+kp)*(1-exp(-(a+kp)t))','gainSensitivity':'a/(a+kp)+kp*t/(exp((a+kp)t)-1)',
 'samples':results,'limitAtZeroPlus':1,'limitAtInfinity':1/3,
 'boundary':'normalized response undefined at t=0 where y=0; limit is distinct from value; not automatically settling-time sensitivity'}
noise=solve_ivp(lambda t,x:[-3*x[0]-2],[0,12],[0.],t_eval=t,rtol=1e-11,atol=1e-13).y[0]
assert np.max(abs(noise+(2/3)*(1-np.exp(-3*t))))<1e-9
assert abs(TF(0,1,1.1)-2/3.1)<1e-12
for tau in [1.,1.1]:assert abs(TF(0,1/tau,1/tau)-2/3)<1e-12
models['parameterization']={'plant':'g/(tau*s+1)','mapping':['p=g/tau','a=1/tau'],'fixedGChangeTauDC':2/3}
models['dc_insensitive_example']={'plant':'p/s','C':1,'closed':'p/(s+p)','DC':1,
 'atTime1':{'p1':1-math.exp(-1),'p2':1-math.exp(-2)},
 'boundary':'zero DC gain sensitivity does not mean transient response is independent of p'}
(BATCH/'model-verification.json').write_text(json.dumps({'status':'passed','stage':'models-before-authoring','models':models},ensure_ascii=False,indent=2)+'\n')
print(json.dumps(models,ensure_ascii=False,indent=2))
