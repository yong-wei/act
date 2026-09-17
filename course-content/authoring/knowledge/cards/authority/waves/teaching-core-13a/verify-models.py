"""Recompute chosen models before writing cards; no platform numerical runtime."""
import json
import math
from pathlib import Path
import numpy as np
from scipy.integrate import solve_ivp, quad
from scipy.optimize import brentq
from scipy.signal import residue

BATCH = Path(__file__).resolve().parent
models = {}
# Algebraic electrical equation plus original mechanical ODE.
Ra, J, b, Kb, Km, voltage = 2., .5, .1, .5, .5, 4.
tau = Ra*J/(Ra*b+Kb*Km)
steady = Km*voltage/(Ra*b+Kb*Km)
time = np.linspace(0, 20, 1001)
trace = solve_ivp(lambda t, w: [(Km*(voltage-Kb*w[0])/Ra-b*w[0])/J],
                  [0,20], [0.], t_eval=time, rtol=1e-11, atol=1e-13).y[0]
analytic = steady*(1-np.exp(-time/tau))
assert np.max(abs(trace-analytic)) < 1e-8
models['motor_time_constant'] = {'assumptions': ['negligible armature inductance', 'no load torque', 'zero initial speed', 'constant parameters'],
 'equations': ['V=Ra*i+Kb*w', 'J*dw/dt=Km*i-b*w'],
 'parametersSI': {'Ra':Ra,'J':J,'b':b,'Kb':Kb,'Km':Km,'voltage':voltage},
 'tauSeconds':tau,'steadySpeedRadPerSecond':steady,'speedAtTau':steady*(1-math.exp(-1)),
 'electromechanicalResidualBound':float(np.max(abs(trace-analytic)))}
# ITAE: original zero-state first-order step model, not a copied error trace.
T = 2.
y = solve_ivp(lambda t,x: [(1-x[0])/T],[0,20],[0.],t_eval=time,rtol=1e-11,atol=1e-13).y[0]
assert np.max(abs((1-y)-np.exp(-time/T))) < 1e-9
itae,err=quad(lambda t:t*math.exp(-t/T),0,np.inf,epsabs=1e-11)
assert abs(itae-T*T)<1e-10
for H in [1.,4.,10.]:
 finite=quad(lambda t:t*math.exp(-t/T),0,H)[0]
 assert abs(finite-T*T*(1-(1+H/T)*math.exp(-H/T)))<1e-10
models['itae']={'equation':'T*dy/dt+y=1', 'zeroInitialState':True, 'T':T,
 'error':'exp(-t/T)','infiniteHorizonITAE':itae, 'T1ITAE':1.,
 'boundary':'comparison fixes normalized unit input and error units; a cost alone does not certify actuator constraints or optimality'}

def second_order(zeta, wn):
 wd=wn*math.sqrt(1-zeta*zeta);sigma=zeta*wn
 response=lambda t:1-np.exp(-sigma*np.asarray(t))*(np.cos(wd*np.asarray(t))+zeta/math.sqrt(1-zeta*zeta)*np.sin(wd*np.asarray(t)))
 ts=np.linspace(0,10,2001)
 ys=solve_ivp(lambda t,x:[x[1],wn*wn-2*sigma*x[1]-wn*wn*x[0]], [0,10],[0.,0.],t_eval=ts,rtol=1e-11,atol=1e-13).y[0]
 assert np.max(abs(ys-response(ts)))<1e-8
 tp=math.pi/wd;tail=-math.log(.02*math.sqrt(1-zeta*zeta))/sigma
 knots=[0.]+[k*tp for k in range(1,int(tail/tp)+1)]+[tail];roots=[]
 for a,b in zip(knots,knots[1:]):
  for level in [.98,1.02]:
   f=lambda v:float(response(v))-level
   if f(a)*f(b)<0:roots.append(brentq(f,a,b,xtol=1e-13))
 roots.sort();assert roots
 # Derivative changes sign only at k*pi/wd; after tail an analytic bound holds.
 assert all(abs(float(response(v))-1)<=.02+1e-10 for v in knots if v>roots[-1])
 return {'zeta':zeta,'wn':wn,'polesReal':-sigma,'polesImaginary':wd,
  'overshootPercent':100*(float(response(tp))-1),'peakTime':tp,
  'zeroTo100Rise':(math.pi-math.acos(zeta))/wd,
  'twoPercentSettling':roots[-1],'twoPercentEnvelopeUpperBound':tail,
  'commonSettlingApproximation':4/sigma,'allTwoPercentCrossings':roots}
models['second_order_A']=second_order(.6,4.)
models['second_order_B']=second_order(.8,4.)
assert models['second_order_A']['overshootPercent']<10
assert models['second_order_A']['twoPercentEnvelopeUpperBound']<2
assert models['second_order_A']['zeroTo100Rise']<.8
models['design']={'specification':{'overshootPercentMaximum':10,'twoPercentSettlingMaximum':2,'zeroTo100RiseMaximum':.8},
 'zetaMinimumFromOvershoot':-math.log(.1)/math.sqrt(math.pi**2+math.log(.1)**2),
 'candidate':'second_order_A','verifiedExactStandardModel':True,
 'boundary':'no zeros, unit DC gain, zero initial state, unit step; extra poles or zeros require recomputation'}
# Source-specific continuous-time normalized minimum-beat model.
rr,pp,_=residue([1.],[1.,1.9,2.2,1.,0.])
nonzero=abs(pp)>1e-9;rn=rr[nonzero];pn=pp[nonzero]
assert np.all(np.real(pn)<0)
mb=lambda t:float(np.real(1+np.sum(rn*np.exp(pn*t))))
derivative=lambda t:float(np.real(np.sum(rn*pn*np.exp(pn*t))))
tail=lambda t:float(np.sum(abs(rn)*np.exp(np.real(pn)*t)))
bound_time=brentq(lambda t:tail(t)-.02,0,40)
grid=np.linspace(0,bound_time,10001)
trace=solve_ivp(lambda t,x:[x[1],x[2],1-1.9*x[2]-2.2*x[1]-x[0]],
 [0,bound_time],[0.,0.,0.],t_eval=grid,rtol=1e-11,atol=1e-13).y[0]
assert np.max(abs(trace-np.array([mb(t) for t in grid])))<1e-8
extrema=[];crossings=[]
for a,b in zip(grid[:-1],grid[1:]):
 if derivative(a)*derivative(b)<0:extrema.append(brentq(derivative,a,b))
 for level in [.98,1.02]:
  if (mb(a)-level)*(mb(b)-level)<0:crossings.append(brentq(lambda t:mb(t)-level,a,b))
assert extrema and crossings
peak=max(mb(t) for t in extrema)
assert peak<1.02 and abs(peak-1.01651395)<1e-7
models['minimum_beat']={'T':'1/(s^3+1.9s^2+2.2s+1)', 'zeroInitialState':True,
 'overshootPercent':100*(peak-1),'numericallyLocatedTwoPercentSettling':max(crossings),
 'sourceRoundedSettling':4.04,'analyticTailGuaranteeAfter':bound_time,
 'tailMethod':'sum abs(residue)*exp(real(pole)*t), all poles strictly stable',
 'extremaBeforeTail':extrema,'sourceContext':'continuous-time reference-response design, not finite-sample deadbeat',
 'boundary':'settling and peak located numerically before analytic tail; no global time-optimality claim'}
report={'status':'passed','stage':'models-before-authoring','models':models,
 'sourceContextVerified':'local chapter 6 continuous-time minimum-beat; chapter 7 finite-sample minimum-beat is distinct'}
(BATCH/'model-verification.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(report,ensure_ascii=False,indent=2))
