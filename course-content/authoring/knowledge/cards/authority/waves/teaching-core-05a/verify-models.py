"""Equation-backed examples for seven block-diagram modeling cards."""
import json
from pathlib import Path
import numpy as np
from scipy.integrate import solve_ivp

BATCH=Path(__file__).resolve().parent
models={}
t=np.linspace(0,5,1001)
# G=2/(s+1), H=1/2, negative feedback.
y=solve_ivp(lambda t,y:[2*(1-.5*y[0])-y[0]],[0,5],[0.],t_eval=t,rtol=1e-12,atol=1e-14).y[0]
assert np.allclose(y,1-np.exp(-2*t),atol=1e-10)
models['structural_model']={'plant':'G=2/(s+1)','sensor':'H=0.5','equations':['e=r-0.5y','y_dot=2e-y'],
    'closedTransfer':'2/(s+2)','unitStep':'1-exp(-2t)','zeroInitialState':True,
    'boundary':'dimensionless signals with consistent scaling; arrows express equations, not necessarily physical transport'}
# A nested path and an independently located disturbance; preserve both inputs.
A=np.array([[-1.,-1.],[2.,-2.]]);Br=np.array([1.,0.]);Bd=np.array([0.,2.]);C=np.array([0.,1.])
for s in [.3,1j,3.]:
    den=s*s+3*s+4
    assert abs(C@np.linalg.solve(s*np.eye(2)-A,Br)-2/den)<1e-12
    assert abs(C@np.linalg.solve(s*np.eye(2)-A,Bd)-2*(s+1)/den)<1e-12
rstep=solve_ivp(lambda t,x:A@x+Br,[0,10],[0.,0.],t_eval=[0,10],rtol=1e-12,atol=1e-14).y
assert abs(rstep[1,-1]-.5)<1e-6
models['reduction_with_disturbance']={'blocks':['G1=1/(s+1)','G2=2/(s+2)'],
    'signalEquations':['e=r-y','v=G1 e','w=v+d','y=G2 w'],
    'stateEquations':['v_dot=r-y-v','y_dot=2(v+d)-2y'],
    'Y_over_R':'2/(s^2+3s+4)','Y_over_D':'2(s+1)/(s^2+3s+4)',
    'zeroInitialState':True,'initialOutputSlopeForUnitR':0,'initialOutputSlopeForUnitD':2,
    'bothUnitStepFinalOutputs':.5,
    'boundary':'preserve each retained input/output relation; equal DC gain does not prove equivalent disturbance dynamics'}
# Moving summing or takeoff points requires compensating gains.
a,b=1.,3.;gain=2.
assert gain*(a+b)==gain*a+gain*b==8
assert gain*a+b==gain*(a+b/gain)==5
assert (gain*a)/gain==a
models['algebraic_movement']={'G':2,'a':1,'b':3,
    'sumBefore':'y=2(a+b)=8','equivalentAfter':'y=2a+2b=8',
    'sumAfter':'y=2a+b=5','equivalentBefore':'y=2(a+b/2)=5',
    'takeoffBeforeMovedAfter':'if z=2a and branch must remain a, branch=z/2',
    'boundary':'for dynamic G, formal 1/G may be improper or unstable; algebraic equivalence does not guarantee an implementable compensator'}
# A transfer-function block represents zero-state response, not all initial conditions.
for initial in [0.,1.]:
    y=solve_ivp(lambda t,y:[2-y[0]],[0,5],[initial],t_eval=t,rtol=1e-12,atol=1e-14).y[0]
    expected=2+(initial-2)*np.exp(-t)
    assert np.allclose(y,expected,atol=1e-10)
models['block']={'transfer':'2/(s+1)','equation':'y_dot+y=2u','unitStepZeroState':'2(1-exp(-t))',
    'unitStepFromY0_1':'2-exp(-t)','boundary':'Y=GU alone describes the zero-state contribution; nonzero initial conditions add a free response'}
# Drawing procedure must start from loaded physical equations.
Ar=np.array([[-2.,1.],[1.,-1.]]);Brc=np.array([1.,0.])
for s in [.3,1j,3.]:
    assert abs(C@np.linalg.solve(s*np.eye(2)-Ar,Brc)-1/(s*s+3*s+1))<1e-12
models['drawing_loaded_rc']={'components':'R1=R2=1 ohm, C1=C2=1 F',
    'stateEquations':['v1_dot=u-2v1+v2','v2_dot=v1-v2'],
    'integratorInputs':['u-2v1+v2','v1-v2'],'transfer':'1/(s^2+3s+1)',
    'isolatedProduct':'1/(s+1)^2',
    'boundary':'derive interconnection equations before assigning isolated component blocks; do not erase loading'}
# Feedback sign and well-posedness are separate checks.
for s in [.3,1j,3.]:
    G=2/(s+1);H=.5
    assert abs(G/(1+G*H)-2/(s+2))<1e-12
    assert abs(G/(1-G*H)-2/s)<1e-12
models['feedback']={'G':'2/(s+1)','H':.5,'negativeFeedback':'2/(s+2)','positiveFeedback':'2/s',
    'positiveFeedbackUnitStep':'2t; no finite steady state','boundary':'negative sign is not a universal stability proof; compute closed poles and internal dynamics'}
models['algebraic_loop']={'staticG':2,'positiveFeedbackH':.5,'equations':['e=r+0.5y','y=2e'],
    'eliminatedEquation':'0=2r','nonzeroR':'no solution','zeroR':'nonunique solutions',
    'boundary':'a static loop with 1-GH=0 is not a well-defined input-output model; do not divide by zero or call it an ordinary infinite gain'}
report={'status':'passed','stage':'models-before-authoring','models':models}
(BATCH/'model-verification.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print('PASS: seven equation-backed block diagram examples')
