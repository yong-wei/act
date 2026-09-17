"""Verify state-space models and counterexamples before ten-card authoring."""
import json
from pathlib import Path
import numpy as np
from scipy.linalg import expm
from scipy.integrate import solve_ivp, quad

BATCH=Path(__file__).resolve().parent
models={}
A=np.array([[0.,1.],[0.,0.]]);B=np.array([[0.],[1.]]);C=np.array([[1.,0.]])
t=np.linspace(0,1,1001)
x=solve_ivp(lambda t,x:A@x+B[:,0]*(6-12*t),[0,1],[0.,0.],t_eval=t,rtol=1e-12,atol=1e-14).y
assert np.allclose(x[0],3*t*t-2*t**3,atol=1e-10)
assert np.allclose(x[1],6*t-6*t*t,atol=1e-10)
models['state_variables']={'system':'q_ddot=u','state':'x=[q,v], v=q_dot',
    'A':A.tolist(),'B':B.tolist(),'C':C.tolist(), 'stateAndTime':'dimensionless teaching model',
    'sameInputDifferentState':'u=0: [q0,v0]=[0,0] gives q=0; [0,1] gives q=t',
    'boundary':'position alone does not determine future position; state coordinates need not be unique'}
W=np.array([[1/3,1/2],[1/2,1.]])
for i in range(2):
    for j in range(2):
        value=quad(lambda tau:(expm(A*tau)@B@B.T@expm(A.T*tau))[i,j],0,1)[0]
        assert abs(value-W[i,j])<1e-12
assert np.linalg.det(W)>0
assert np.allclose(x[:,-1],[1,0],atol=1e-10)
models['complete_reachability']={'A':A.tolist(),'B':B.tolist(),'initialState':[0,0], 'targetState':[1,0],
    'horizon':1,'input':'u(t)=6-12t','trajectory':['3t^2-2t^3','6t-6t^2'],
    'controllabilityMatrix':np.hstack([B,A@B]).tolist(),'rank':2,'gramianAt1':W.tolist(),
    'boundary':'finite-dimensional continuous LTI system with unconstrained input; actuator bounds can invalidate this specific maneuver'}
J=np.array([[-1.,1.],[0.,-1.]]);Bj=np.array([[0.],[1.]]);Cj=np.array([[1.,0.]])
for z in [.5,1j,3.]:
    assert abs((Cj@np.linalg.solve(z*np.eye(2)-J,Bj))[0,0]-1/(z+1)**2)<1e-12
for tau in [0,.5,1,2]:
    assert np.allclose(expm(J*tau),np.exp(-tau)*np.array([[1,tau],[0,1]]),atol=1e-12)
models['jordan']={'transfer':'1/(s+1)^2','A':J.tolist(),'B':Bj.tolist(),'C':Cj.tolist(),
    'transition':'exp(-t)*[[1,t],[0,1]]','zeroInputFrom0_1':['t exp(-t)','exp(-t)'],
    'boundary':'a repeated eigenvalue alone does not require a nontrivial Jordan block; -I is diagonalizable, unlike this minimal repeated-pole realization'}
# Collocated force actuation and velocity measurement on a single mass.
Ac=np.array([[0.,1.],[-2.,-3.]])
assert np.allclose(np.sort(np.linalg.eigvals(Ac)),[-2,-1])
models['collocation']={'mechanicalEquation':'q_ddot+q_dot+2q=u', 'feedback':'u=-2 q_dot',
    'sensingAndActuation':'same mass, same mechanical point; force actuator and velocity sensor',
    'closedEquation':'q_ddot+3q_dot+2q=0','poles':[-1,-2],
    'energy':'E=0.5 q_dot^2+q^2','energyDerivative':'-3 q_dot^2',
    'boundary':'ideal static negative velocity feedback without delay or saturation; collocation alone is not a universal guarantee for arbitrary controllers'}
L=np.array([[9.],[20.]])
Ae=A-L@C
assert np.allclose(np.sort(np.linalg.eigvals(Ae)),[-5,-4])
trace=solve_ivp(lambda t,z:np.r_[A@z[:2]+B[:,0],A@z[2:]+B[:,0]+L@(C@z[:2]-C@z[2:])],
    [0,2],[1.,0.,0.,0.],t_eval=np.linspace(0,2,201),rtol=1e-12,atol=1e-14).y
for index,tau in enumerate(np.linspace(0,2,201)):
    assert np.allclose(trace[:2,index]-trace[2:,index],expm(Ae*tau)@np.array([1.,0.]),atol=1e-9)
models['estimation_error']={'A':A.tolist(),'B':B.tolist(),'C':C.tolist(),'L':L.tolist(),
    'definition':'e=x-x_hat','observer':'x_hat_dot=A x_hat+B u+L(y-C x_hat)',
    'errorMatrix':Ae.tolist(),'errorPoles':[-4,-5],'actualInitial':[1,0],'estimatedInitial':[0,0],
    'input':1,'boundary':'same known input, exact model and noiseless measurement; with additive measurement noise n the error equation includes -L n'}
Ad=np.diag([-1.,-2.]);badB=np.array([[1.],[0.]]);goodB=np.ones((2,1));goodC=np.ones((1,2));badC=np.array([[1.,0.]])
rank=lambda v:int(np.linalg.matrix_rank(v))
assert rank(np.hstack([badB,Ad@badB]))==1
assert rank(np.hstack([goodB,Ad@goodB]))==2
assert rank(np.vstack([goodC,goodC@Ad]))==2
assert rank(np.vstack([badC,badC@Ad]))==1
pbh=[]
for lam in [-1.,-2.]:
    pbh.append({'eigenvalue':lam,'controllabilityRank':rank(np.hstack([lam*np.eye(2)-Ad,badB])),
                'observabilityRank':rank(np.vstack([lam*np.eye(2)-Ad,goodC]))})
assert [r['controllabilityRank'] for r in pbh]==[2,1]
models['pbh']={'A':Ad.tolist(),'B':badB.tolist(),'C':goodC.tolist(),'checks':pbh,
    'criterion':'rank[lambda I-A,B]=n; rank[[lambda I-A],[C]]=n at every eigenvalue',
    'boundary':'use complex rank for complex eigenvalues; stable inaccessible mode is still inaccessible'}
models['rank_criterion']={'A':Ad.tolist(),'B':badB.tolist(),'controllabilityMatrix':np.hstack([badB,Ad@badB]).tolist(),
    'rank':1,'unreachableState':'x2 cannot be assigned by u; x2(t)=exp(-2t)x2(0)',
    'controllableAlternativeB':goodB.tolist(),'alternativeRank':2,
    'boundary':'input coefficient B alone is insufficient; propagation through A also matters'}
K=np.array([[12.,7.]])
assert np.allclose(np.sort(np.linalg.eigvals(A-B@K)),[-4,-3])
models['pole_placement']={'A':A.tolist(),'B':B.tolist(),'feedback':'u=-Kx','K':K.tolist(),
    'desiredPoles':[-3,-4],'closedMatrix':(A-B@K).tolist(),'characteristic':'s^2+7s+12',
    'boundary':'full-state feedback and controllable pair; no claim of actuator limits or tracking without a reference design'}
assert rank(np.hstack([goodB,-np.eye(2)@goodB]))==1
models['diagonal_criterion']={'distinctA':Ad.tolist(),'goodB':goodB.tolist(),'badB':badB.tolist(),'goodC':goodC.tolist(),'badC':badC.tolist(),
    'rule':'with distinct eigenvalues in diagonal coordinates, no all-zero B row for controllability, no all-zero C column for observability',
    'repeatedCounterexample':{'A':(-np.eye(2)).tolist(),'B':goodB.tolist(),'controllabilityRank':1},
    'boundary':'test applies to transformed B,C, and distinct eigenvalues; nonzero rows alone fail for repeated eigenvalues'}
Co=np.array([[1.,0.]]);Cu=np.array([[0.,1.]])
assert rank(np.hstack([Co@badB,Co@Ad@badB]))==1
assert rank(np.hstack([Cu@badB,Cu@Ad@badB]))==0
models['output_controllability']={'A':Ad.tolist(),'B':badB.tolist(),'D':0,'outputC':Co.tolist(),
    'stateControllabilityRank':1,'outputControllabilityMatrix':[[1,-1]],'outputRank':1,'outputDimension':1,
    'uncontrollableOutputC':Cu.tolist(),'uncontrollableOutputRank':0,
    'boundary':'strictly proper model D=0, unconstrained input, finite horizon; output controllability does not imply full state controllability or observability'}
report={'status':'passed','stage':'models-before-authoring','models':models}
(BATCH/'model-verification.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print('PASS: ten state-space models and counterexamples')
