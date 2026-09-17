"""Original models fixed before authoring the final six first-stage cards."""
import json
import math
from pathlib import Path
import numpy as np
from scipy.integrate import solve_ivp
from scipy.linalg import expm
from scipy.optimize import brentq
BATCH=Path(__file__).resolve().parent
out={}
# Performance metrics from original y''+2y'+4y=4, not a plotted hand sketch.
solution=solve_ivp(lambda t,x:[x[1],4-2*x[1]-4*x[0]],[0,10],[0.,0.],dense_output=True,rtol=1e-11,atol=1e-12)
tp=brentq(lambda t:solution.sol(t)[1],1,2.5)
peak=solution.sol(tp)[0]
assert abs(tp-math.pi/math.sqrt(3))<1e-8
assert abs(peak-1-math.exp(-math.pi/math.sqrt(3)))<1e-8
t10=brentq(lambda t:solution.sol(t)[0]-.1,0,tp)
t90=brentq(lambda t:solution.sol(t)[0]-.9,0,tp)
grid=np.linspace(0,10,20001);error=abs(solution.sol(grid)[0]-1)
last=np.flatnonzero(error>.02)[-1]
ts=brentq(lambda t:abs(solution.sol(t)[0]-1)-.02,grid[last],grid[last+1])
assert 2/math.sqrt(3)*math.exp(-grid[-1])<.02
out['performance']={'plant':'4/(s^2+2s+4)','unitStepZeroInitial':True,'overshootPercent':100*(peak-1),'peakTime':tp,'rise10to90':t90-t10,'settling2Percent':ts,'settlingApproximation':4,'steadyError':0}
# P=1/s, C=1: moving the same constant disturbance changes its rejection.
t=np.linspace(0,40,4001)
yin=solve_ivp(lambda t,x:[1-x[0]],[0,40],[0.],t_eval=t,rtol=1e-11,atol=1e-12).y[0]
xout=solve_ivp(lambda t,x:[-x[0]-1],[0,40],[0.],t_eval=t,rtol=1e-11,atol=1e-12).y[0]
assert np.allclose(yin,1-np.exp(-t),atol=1e-8)
assert np.allclose(xout+1,np.exp(-t),atol=1e-8)
final=[]
for ramp in [False,True]:
    # With C=1+1/s, z'=-y, plant y'=u+d=-y+z+d.
    state=solve_ivp(lambda time,x:[-x[0]+x[1]+(time if ramp else 1),-x[0]],[0,40],[0.,0.],rtol=1e-11,atol=1e-12).y[:,-1]
    assert abs(state[0]-(1 if ramp else 0))<1e-7
    final.append(float(state[0]))
out['disturbance_type']={'plant':'1/s','C1_inputDisturbanceStepFinal':float(yin[-1]),'C1_outputDisturbanceStepFinal':float(xout[-1]+1),'PIcontroller':'1+1/s','PI_inputDisturbanceStepFinal':final[0],'PI_inputDisturbanceRampFinal':final[1],'reference':'zero','errorDefinition':'e=-y'}
# Full-state feedback and an observer-based dynamic compensator.
A=np.array([[0.,1.],[0.,0.]])
B=np.array([[0.],[1.]])
C=np.array([[1.,0.]])
K=np.array([[6.,5.]])
L=np.array([[9.],[20.]])
assert np.linalg.matrix_rank(np.hstack([B,A@B]))==2
assert np.linalg.matrix_rank(np.vstack([C,C@A]))==2
Acl=A-B@K
assert np.allclose(sorted(np.linalg.eigvals(Acl)),[-3,-2])
N=-1/(C@np.linalg.solve(Acl,B)).item()
assert abs(N-6)<1e-12
step=solve_ivp(lambda t,x:Acl@x+(B*N).ravel(),[0,5],[0.,0.],dense_output=True,rtol=1e-11,atol=1e-12)
assert abs(step.sol(math.log(2))[0]-.5)<1e-8
M=np.block([[A,-B@K],[L@C,A-B@K-L@C]])
assert np.allclose(sorted(np.linalg.eigvals(M).real),[-5,-4,-3,-2])
initial=np.array([1.,0.,0.,0.])
at1=expm(M)@initial
assert np.allclose(at1[:2]-at1[2:],expm(A-L@C)@initial[:2],atol=1e-12)
out['state_feedback']={'A':A.tolist(),'B':B.tolist(),'C':C.tolist(),'K':K.tolist(),'referencePrefilter':N,'desiredPoles':[-2,-3],'stepAtLn2':float(step.sol(math.log(2))[0]),'regulatorControlFromX10':-6}
out['observer_compensator']={'L':L.tolist(),'observerPoles':[-4,-5],'augmentedClosedPoles':[-2,-3,-4,-5],'controllerStateMatrix':(A-B@K-L@C).tolist(),'errorAt1':(at1[:2]-at1[2:]).tolist()}
# Exact delay has unit amplitude, frequency-dependent phase, not first-order lag.
tau=.25;omega=4.
response=np.exp(-1j*omega*tau)
assert abs(abs(response)-1)<1e-12
assert abs(np.angle(response)+1)<1e-12
loop=lambda w:1/(1j*w*(1+1j*w))
wc=brentq(lambda w:abs(loop(w))-1,.01,3)
basepm=180+np.angle(loop(wc),deg=True)
delayedpm=180+np.angle(loop(wc)*np.exp(-1j*wc*tau),deg=True)
assert abs(basepm-delayedpm-wc*tau*180/math.pi)<1e-10
out['delay']={'seconds':tau,'omega':omega,'amplitude':abs(response),'phaseRadians':float(np.angle(response)),'phaseDegrees':float(np.angle(response,deg=True)),'gainCrossover':wc,'originalPhaseMargin':float(basepm),'delayedPhaseMargin':float(delayedpm)}
# PI device realization z'=e, u=e+z, y'=u-y for a unit step.
trace=solve_ivp(lambda t,x:[1-2*x[0]+x[1],1-x[0]],[0,20],[0.,0.],t_eval=np.linspace(0,20,2001),rtol=1e-11,atol=1e-12)
y,z=trace.y;u=1-y+z
assert np.allclose(y,1-np.exp(-trace.t),atol=1e-9)
assert np.allclose(u,1,atol=1e-9)
out['correction_device']={'plant':'1/(s+1)','controller':'1+1/s','closedTransfer':'1/(s+1)','baselineP1StepError':.5,'PIstepError':0,'unitStepControl':1,'stableCancelledPole':-1}
(BATCH/'model-verification.json').write_text(json.dumps({'status':'passed','cardAuthoringStatus':'not-yet-written','models':out},ensure_ascii=False,indent=2)+'\n')
print(json.dumps(out,ensure_ascii=False,indent=2))
