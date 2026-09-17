"""Original connection equations for feedforward, prefilters and reference internal models."""
import json
from pathlib import Path
import numpy as np
from scipy.integrate import solve_ivp
BATCH=Path(__file__).resolve().parent
models={};t=np.linspace(0,20,2001)
# y=x+d, x_dot=-x+b*u, u=K*(r-y)+Fr*r+Fd*d.
K=1.;Fr=.5;Fd=-.5
for gain in [2.,3.]:
 track=solve_ivp(lambda t,x:[-x[0]+gain*(K*(1-x[0])+Fr)],[0,20],[0.],t_eval=t,rtol=1e-11,atol=1e-13).y[0]
 expected=gain*(K+Fr)/(1+gain*K)*(1-np.exp(-(1+gain*K)*t));assert np.max(abs(track-expected))<1e-8
 disturb=solve_ivp(lambda t,x:[-x[0]+gain*(-K*(x[0]+1)+Fd)],[0,20],[0.],t_eval=t,rtol=1e-11,atol=1e-13).y[0]+1
 dsteady=(1+gain*Fd)/(1+gain*K)
 assert abs(disturb[-1]-dsteady)<1e-8
models['feedforward']={'plant':'x_dot=-x+b*u; y=x+d','control':'u=K(r-y)+Fr*r+Fd*d',
 'nominalB':2,'K':K,'Fr':Fr,'Fd':Fd,'nominalReferenceTransfer':'3/(s+3)',
 'withoutFrReferenceTransfer':'2/(s+3)','nominalOutputDisturbanceTransfer':'s/(s+3)',
 'disturbanceStepOutput':'exp(-3t)','withoutFdDisturbanceSteadyOutput':1/3,
 'b3Mismatch':{'referenceFinal':1.125,'disturbanceFinal':-.125},
 'boundary':'disturbance is added at measured output; inverse DC gain cancels constant steady effect, not the full transient'}
# Disturbance at plant input is a different channel.
models['disturbance_location']={'outputAdditive':'Tdy=(1+P*Fd)/(1+P*K)',
 'plantInputAdditive':'Tdy=P*(1+Fd)/(1+P*K)','inputCancellationFd':-1,
 'boundary':'do not use -1/P(0) for an input-additive disturbance without re-deriving the channel'}
# Stable reference prefilter cancels a nominal stable zero in the reference channel only.
sol=solve_ivp(lambda t,x:[-x[0]-2*x[1]+x[2],x[0]-2*x[1],2-2*x[2]],[0,20],[0.,0.,0.],t_eval=t,rtol=1e-11,atol=1e-13).y
wd=np.sqrt(7)/2;exact=.5*(1-np.exp(-1.5*t)*(np.cos(wd*t)+1.5/wd*np.sin(wd*t)))
assert np.max(abs(sol[0]-exact))<1e-8
models['prefilter']={'baseClosed':'(s+2)/(s^2+3s+4)','F':'2/(s+2)','referenceResult':'2/(s^2+3s+4)',
 'fullInternalCharacteristic':'(s+2)(s^2+3s+4)','DCbefore':.5,'DCafter':.5,
 'boundary':'stable nominal zero cancellation; filter state remains; not arbitrary RHP-zero inversion'}
# Two copies of the origin internal model stabilize a ramp-tracking design.
A=np.array([[-3.,3.,1.],[-1.,0.,0.],[0.,1.,0.]])
assert np.allclose(np.poly(A),[1,3,3,1])
for ramp in [False,True]:
 fun=lambda v,x:[-3*x[0]+3*x[1]+x[2]+2*(v if ramp else 1),(v if ramp else 1)-x[0],x[1]]
 states=solve_ivp(fun,[0,20],[0.,0.,0.],t_eval=t,rtol=1e-11,atol=1e-13).y
 expected=t*(1-np.exp(-t)) if ramp else 1-(1-t)*np.exp(-t)
 assert np.max(abs(states[0]-expected))<1e-8
 if ramp:
  assert np.max(abs(states[1]-(1-(t+1)*np.exp(-t))))<1e-8
  assert np.max(abs(states[2]-(t-2+(t+2)*np.exp(-t))))<1e-8
  control=2*(t-states[0])+3*states[1]+states[2]
  assert np.max(abs(control-(t+1-np.exp(-t))))<1e-8
models['reference_internal_model']={'plant':'1/(s+1)','controller':'2+3/s+1/s^2',
 'states':'x_dot=-x+u; z1_dot=r-x; z2_dot=z1; u=2(r-x)+3z1+z2',
 'fullClosedCharacteristic':'(s+1)^3','rampError':'t exp(-t)','stepError':'(1-t)exp(-t)',
 'singleIntegratorComparison':{'C':'1+1/s','closedT':'1/(s+1)','rampError':'1-exp(-t)','steadyRampError':1},
 'boundary':'specified constant/ramp reference class and stable augmented loop, not arbitrary-signal tracking or industrial IMC topology'}
models['feedforward_stability_boundary']={'feedbackCharacteristicUnchangedFor':'independent well-posed feedforward with fixed feedback loop',
 'unstableCounterexampleF':'1/(s-1)','boundary':'new feedforward internal poles must still be stable; unchanged feedback characteristic does not guarantee full internal stability'}
# An unstable independent feedforward filter adds an unstable internal mode.
test_t=np.linspace(0,5,501)
bad=solve_ivp(lambda t,x:[-3*x[0]+2*x[1]+2,x[1]+1],[0,5],[0.,0.],t_eval=test_t,rtol=1e-11,atol=1e-13).y[0]
assert np.max(abs(bad-.5*(np.exp(test_t)-np.exp(-3*test_t))))<1e-8
models['feedforward_stability_boundary']['referenceTransfer']='2s/((s-1)(s+3))'
models['feedforward_stability_boundary']['unitStepOutput']='(exp(t)-exp(-3t))/2'
ramp_ref=solve_ivp(lambda t,x:[3*t-3*x[0]],[0,20],[0.],t_eval=t,rtol=1e-11,atol=1e-13).y[0]
assert np.max(abs(ramp_ref-(t-1/3+np.exp(-3*t)/3)))<1e-8
models['feedforward']['nominalRampReferenceError']='(1-exp(-3t))/3'
models['feedforward']['disturbanceMagnitudeSamples']={str(w):abs(1j*w/(3+1j*w)) for w in [.3,30.]}
assert abs((1+Fr/K)-1.5)<1e-12
models['reference_prefilter_equivalence']={'K':1,'parallelFr':.5,'referencePrefilter':1.5,'boundary':'constant nonzero K; not arbitrary dynamic controller inversion'}
(BATCH/'model-verification.json').write_text(json.dumps({'status':'passed','stage':'models-before-authoring','models':models},ensure_ascii=False,indent=2)+'\n')
print(json.dumps(models,ensure_ascii=False,indent=2))
