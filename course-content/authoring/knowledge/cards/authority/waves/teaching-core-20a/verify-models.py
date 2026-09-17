"""Original equations for velocity feedback and compensation-network examples."""
import json,math
from pathlib import Path
import numpy as np
from scipy.integrate import solve_ivp
BATCH=Path(__file__).resolve().parent
models={}
cases=[]
for K,Kt in [(4.,0.),(4.,1.8),(36.,7.4)]:
 a=1+Kt;wn=math.sqrt(K);zeta=a/(2*wn);wd=wn*math.sqrt(1-zeta*zeta)
 t=np.linspace(0,40,4001)
 response=1-np.exp(-a*t/2)*(np.cos(wd*t)+zeta/math.sqrt(1-zeta*zeta)*np.sin(wd*t))
 state=solve_ivp(lambda t,x:[x[1],K*(1-x[0])-(1+Kt)*x[1]],[0,40],[0.,0.],t_eval=t,rtol=1e-11,atol=1e-13).y
 assert np.max(abs(state[0]-response))<1e-8
 ramp=solve_ivp(lambda t,x:[x[1],K*(t-x[0])-(1+Kt)*x[1]],[0,40],[0.,0.],t_eval=t,rtol=1e-11,atol=1e-13).y
 assert abs((40-ramp[0,-1])-a/K)<1e-7
 cases.append({'K':K,'Kt':Kt,'wn':wn,'zeta':zeta,'stepOvershootPercent':100*math.exp(-math.pi*zeta/math.sqrt(1-zeta*zeta)),
  'rampSteadyError':a/K,'initialStepControl':K})
models['velocity_feedback']={'plant':'y_ddot+y_dot=u','control':'u=K(r-y)-Kt*y_dot','zeroInitialState':True,
 'closedReferenceTransfer':'K/[s^2+(1+Kt)s+K]','cases':cases,
 'PDOnErrorReferenceNumerator':'K+Kt*s','boundary':'measurement velocity feedback and error PD share denominator here, not reference numerator; ramp error and control effort must be checked'}
# Same compensator location, same loop product, different reference transfer.
G=lambda s:1/(s+1);C=lambda s:2/(s+2)
for s in [0.,1.,2.,1j]:
 assert abs(G(s)*C(s)/(1+G(s)*C(s))-2/(s*s+3*s+4))<1e-12
 assert abs(G(s)/(1+G(s)*C(s))-(s+2)/(s*s+3*s+4))<1e-12
models['placement']={'plant':'1/(s+1)','compensator':'2/(s+2)',
 'seriesClosed':'2/(s^2+3s+4)','feedbackClosed':'(s+2)/(s^2+3s+4)',
 'localFeedbackEquivalent':'(s+2)/(s^2+3s+4)','withOuterUnityLoop':'(s+2)/(s^2+4s+6)',
 'boundary':'same characteristic denominator does not imply identical reference response; distinguish local equivalent and final outer closed loop'}
a=4.;T=.25;wm=1/(T*math.sqrt(a));lead=lambda w:(1+1j*a*T*w)/(1+1j*T*w)
phi=math.asin((a-1)/(a+1));assert abs(np.angle(lead(wm))-phi)<1e-12
assert abs(abs(lead(wm))-math.sqrt(a))<1e-12
models['lead']={'C':'(1+a*T*s)/(1+T*s)','a':a,'T':T,'zero':-1/(a*T),'pole':-1/T,
 'maximumPhaseDegrees':phi*180/math.pi,'maximumPhaseFrequency':wm,'magnitudeAtMaximum':abs(lead(wm)),
 'DCgain':1,'highFrequencyGain':a,'lowFrequencyPDApproximation':'1+(a-1)T*s',
 'boundary':'positive phase and changed magnitude do not guarantee all closed-loop metrics improve'}
beta=10.;Tlag=1.;wlag=1/(Tlag*math.sqrt(beta));lag=lambda w:(1+1j*Tlag*w)/(1+1j*beta*Tlag*w)
assert np.angle(lag(wlag))<0
models['lag']={'C':'(1+T*s)/(1+beta*T*s)','beta':beta,'T':Tlag,'zero':-1,'pole':-.1,
 'DCgain':1,'highFrequencyGain':.1,'minimumPhaseDegrees':float(np.angle(lag(wlag),deg=True)),
 'minimumPhaseFrequency':wlag,'gainScaledByBeta':{'DC':10,'highFrequency':1},
 'boundary':'finite DC gain and no origin pole; lag is not an exact integrator and does not itself increase system type'}
# Lead in the error-to-plant path, using the full controller and plant states.
t=np.linspace(0,10,1001)
full=solve_ivp(lambda t,x:[-5*x[0]-12*x[1]+4,-x[0]-4*x[1]+1],[0,10],[0.,0.],t_eval=t,rtol=1e-11,atol=1e-13).y
assert np.max(abs(full[0]-.5*(1-np.exp(-8*t))))<1e-8
assert np.allclose(np.sort(np.linalg.eigvals([[-5,-12],[-1,-4]])),[-8,-1])
models['lead_closed_example']={'plant':'1/(s+1)','C':'(1+s)/(1+0.25s)',
 'controllerState':'z_dot=-4z+e; u=4e-12z','plantState':'y_dot=-y+u',
 'zeroStateReferenceTransfer':'4/(s+8)','fullInternalPoles':[-8,-1],
 'baselineReferenceTransfer':'1/(s+2)','baselineT90':math.log(10)/2,'leadT90':math.log(10)/8,
 'initialStepControlBaseline':1,'initialStepControlLead':4,
 'boundary':'nominal stable pole cancellation in zero-state reference channel; internal pole -1 remains'}
for point in [0.,1.,1j]:
 assert abs(C(point)*G(point)/(1+G(point))-2/(point+2)**2)<1e-12
models['placement']['referencePrefilterOnly']='2/(s+2)^2'
assert np.max(np.roots([1,-1,4]).real)>0
models['wrong_velocity_sign']={'K':4,'Kt':-2,'characteristic':[1,-1,4],'unstable':True}
# Placement responses directly from each set of connection equations.
t=np.linspace(0,10,1001);wd=math.sqrt(7)/2
series=solve_ivp(lambda t,x:[-x[0]+2*x[1],1-x[0]-2*x[1]],[0,10],[0.,0.],t_eval=t,rtol=1e-11,atol=1e-13).y[0]
feedback=solve_ivp(lambda t,x:[1-x[0]-2*x[1],x[0]-2*x[1]],[0,10],[0.,0.],t_eval=t,rtol=1e-11,atol=1e-13).y[0]
ys=.5*(1-np.exp(-1.5*t)*(np.cos(wd*t)+1.5/wd*np.sin(wd*t)))
assert np.max(abs(series-ys))<1e-8
assert np.max(abs(feedback-(ys+np.exp(-1.5*t)*np.sin(wd*t)/wd)))<1e-8
models['placement']['initialOutputSlopeSeries']=0
models['placement']['initialOutputSlopeFeedback']=1
ades=(1+math.sin(math.pi/6))/(1-math.sin(math.pi/6));Tdes=1/(2*math.sqrt(ades))
assert abs(np.angle((1+1j*ades*Tdes*2)/(1+1j*Tdes*2))-math.pi/6)<1e-12
models['lead_inverse_design']={'desiredMaxPhaseDegrees':30,'desiredMaxPhaseFrequency':2,'a':ades,'T':Tdes,
 'boundary':'network phase specification only; closed-loop crossover must be checked separately'}
(BATCH/'model-verification.json').write_text(json.dumps({'status':'passed','stage':'models-before-authoring','models':models},ensure_ascii=False,indent=2)+'\n')
print(json.dumps(models,ensure_ascii=False,indent=2))
