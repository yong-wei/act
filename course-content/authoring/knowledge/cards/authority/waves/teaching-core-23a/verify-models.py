"""Track physical output, measurement error and feedforward feasibility separately."""
import json
from pathlib import Path
import numpy as np
from scipy.integrate import solve_ivp
BATCH=Path(__file__).resolve().parent
models={};t=np.linspace(0,15,1501)
# P=1/(s+1), C=2; physical y, measurement y+n.
noise=solve_ivp(lambda t,y:[-3*y[0]-2],[0,15],[0.],t_eval=t,rtol=1e-11,atol=1e-13).y[0]
true_error=-noise;comparator_error=-noise-1
assert np.max(abs(true_error-(2/3)*(1-np.exp(-3*t))))<1e-9
assert np.max(abs(comparator_error-(-1/3-(2/3)*np.exp(-3*t))))<1e-9
models['noise_channels']={'P':'1/(s+1)','C':2,'measurement':'y+n','trueTrackingError':'r-y','comparatorError':'r-y-n',
 'noiseToOutput':'-T','noiseToTrueError':'T','noiseToComparatorError':'-S',
 'T':'2/(s+3)','S':'(s+1)/(s+3)','noiseStepTrueError':'(2/3)(1-exp(-3t))',
 'noiseStepComparatorError':'-1/3-(2/3)exp(-3t)',
 'atOmega30':{'trueErrorMagnitude':abs(2/(3+30j)),'comparatorMagnitude':abs((1+30j)/(3+30j))}}
# Integral feedback drives biased measurement error to zero, not physical tracking error.
biased=solve_ivp(lambda t,x:[-x[0]+(-x[0]-1)+x[1],-x[0]-1],[0,15],[0.,0.],t_eval=t,rtol=1e-11,atol=1e-13).y[0]
assert np.max(abs(biased-(-1+np.exp(-t))))<1e-8
models['constant_bias']={'P':'1/(s+1)','C':'1+1/s','noise':1,'reference':0,
 'physicalOutput':'-1+exp(-t)','trueError':'1-exp(-t)','comparatorError':'-exp(-t)',
 'boundary':'integral action can remove comparator error while physical output remains biased'}
models['disturbance_error']={'P':'1/(s+1)','C':2,'trueTrackingError':'r-y',
 'outputDisturbanceToError':'-S','inputDisturbanceToError':'-P*S',
 'outputDisturbanceStepError':'-1/3-(2/3)exp(-3t)','inputDisturbanceStepError':'-(1/3)(1-exp(-3t))'}
ramp=solve_ivp(lambda t,y:[2*t-3*y[0]],[0,15],[0.],t_eval=t,rtol=1e-11,atol=1e-13).y[0]
assert np.max(abs((t-ramp)-(t/3+(2/9)*(1-np.exp(-3*t)))))<1e-8
models['type_zero']={'loop':'2/(s+1)','originPoles':0,'positionErrorConstant':2,'unitStepSteadyError':1/3,
 'unitRampError':'t/3+(2/9)(1-exp(-3t))','unitRampSteadyError':'unbounded',
 'boundary':'system type is origin-pole count of specified loop, not total system order'}
# Exact nominal compensation is feasible here because P and its inverse are stable proper.
for r,d in [(1.,0.),(0.,1.),(1.,.3)]:
 h=r-d
 states=solve_ivp(lambda t,x:[h-1.5*x[0]-.5*x[1],h-2*x[1]],[0,15],[0.,0.],t_eval=t,rtol=1e-11,atol=1e-13).y
 u=h-(states[0]+states[1])/2;y=u+states[0]+d
 assert np.max(abs(y-r))<1e-9
models['full_compensation']={'P':'(s+2)/(s+1)','outputDisturbanceQ':1,'C':1,
 'Fr':'(s+1)/(s+2)','Fd':'-(s+1)/(s+2)','control':'u=C(r-y)+Fr*r+Fd*d',
 'errorReference':'S*(1-P*Fr)','errorDisturbance':'-S*(Q+P*Fd)',
 'internalPoles':[-1.5,-2],'zeroInitialState':True,'nominalModelExact':True,
 'stateRealization':'h=r-d; x_dot=h-1.5x-0.5w; w_dot=h-2w; u=h-(x+w)/2; y=u+x+d',
 'strictlyProperCounterexample':'P=2/(s+1) requires Fr=(s+1)/2, an improper ideal derivative',
 'boundary':'not arbitrary plant inversion, unknown disturbance cancellation or nonzero-initial-state zero error'}
(BATCH/'model-verification.json').write_text(json.dumps({'status':'passed','stage':'models-before-authoring','models':models},ensure_ascii=False,indent=2)+'\n')
print(json.dumps(models,ensure_ascii=False,indent=2))
