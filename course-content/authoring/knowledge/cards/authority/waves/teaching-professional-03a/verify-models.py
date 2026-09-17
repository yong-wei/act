"""State-space examples verified with original matrices and exponentials."""
from pathlib import Path
import json,math
import numpy as np
from scipy.linalg import expm
from scipy.integrate import quad
BATCH=Path(__file__).resolve().parent
models={};J=np.array([[-1.,1.],[0.,-1.]])
for t in [0,.2,1,2]:assert np.allclose(expm(J*t),math.exp(-t)*np.array([[1,t],[0,1]]),atol=1e-12)
assert np.allclose(expm(J*.3)@expm(J*.7),expm(J),atol=1e-12)
models['matrix_exponential']={'A':[[-1,1],[0,-1]],'exact':'exp(-t)[[1,t],[0,1]]','initialIdentity':True,'semigroupChecked':True,'boundary':'matrix function, not entrywise exponentiation; repeated eigenvalues need not imply diagonal form'}
models['state_transition']={'constantA':'Phi(t,t0)=exp(A(t-t0))','forcedState':'Phi*x0+integral Phi(t,tau)B u(tau)dtau','timeVaryingScalar':'xdot=-2t x -> Phi(t,t0)=exp(-(t^2-t0^2))','boundary':'LTI exponential formula not generally exp(A(t)*(t-t0)) for time-varying matrices'}
A=np.array([[-3.,-2.],[1.,0.]]);B=np.array([[1.],[0.]]);C=np.array([[1.,3.]])
Co=np.column_stack((B,A@B));Ob=np.vstack((C,C@A))
assert np.linalg.matrix_rank(Co)==np.linalg.matrix_rank(Ob)==2
for s in [.5,1j,2+1j]:
 g=(C@np.linalg.solve(s*np.eye(2)-A,B))[0,0];assert abs(g-(s+3)/(s*s+3*s+2))<1e-12
 assert abs((2+g)-(2*s*s+7*s+7)/(s*s+3*s+2))<1e-12
models['canonical_realization']={'A':A.tolist(),'B':B.tolist(),'C':C.tolist(),'D':0,'G':'(s+3)/(s^2+3s+2)','properWithD2':'(2s^2+7s+7)/(s^2+3s+2)','convention':'upper companion first row [-3,-2], B first entry1','boundary':'realization not unique; proper non-strict transfer includes feedthrough; transfer only zero-state behavior'}
models['rank_matrices']={'controllability':Co.tolist(),'controllabilityDet':float(np.linalg.det(Co)),'observability':Ob.tolist(),'observabilityDet':float(np.linalg.det(Ob)),'ranks':[2,2],'boundary':'multi-input controllability matrix may be rectangular; full row rank not ordinary matrix invertibility'}
pbh=[]
for lam in [-1.,-2.]:
 rc=int(np.linalg.matrix_rank(np.column_stack((lam*np.eye(2)-A,B))));ro=int(np.linalg.matrix_rank(np.vstack((C,lam*np.eye(2)-A))));assert rc==ro==2;pbh.append({'lambda':lam,'controllableRank':rc,'observableRank':ro})
models['pbh']={'canonicalEigenvalueTests':pbh,'boundary':'continuous finite-dimensional LTI criterion at all eigenvalues over complex field; one tested mode does not prove all modes'}
Ah=np.diag([-1.,2.]);Bh=np.array([[1.],[0.]]);Ch=np.array([[1.,0.]])
assert np.linalg.matrix_rank(np.column_stack((2*np.eye(2)-Ah,Bh)))==1
assert np.linalg.matrix_rank(np.vstack((Ch,2*np.eye(2)-Ah)))==1
models['hidden_mode']={'A':Ah.tolist(),'B':Bh.tolist(),'C':Ch.tolist(),'uncontrolledUnobservedEigenvalue':2,'ranksAtLambda2':[1,1],'zeroStateTransfer':'1/(s+1)','boundary':'stable external transfer does not reveal all internal modes; initial x2 grows exp(2t)'}
Ad=np.array([[0.,1.],[0.,0.]]);Bd=np.array([[0.],[1.]]);W=np.array([[1/3,1/2],[1/2,1.]])
xf=np.array([1.,0.]);Winvxf=np.linalg.solve(W,xf)
u=lambda t:float((Bd.T@expm(Ad.T*(1-t))@Winvxf).item())
for t in [0,.2,.5,1]:assert abs(u(t)-(6-12*t))<1e-12
end=np.array([quad(lambda t:(1-t)*u(t),0,1)[0],quad(u,0,1)[0]])
assert np.allclose(end,xf,atol=1e-12)
models['reachability']={'A':Ad.tolist(),'B':Bd.tolist(),'horizon':1,'gramian':W.tolist(),'initial':[0,0],'target':xf.tolist(),'input':'6-12t','verifiedEndpoint':end.tolist(),'boundary':'unconstrained input example; bounded controls/time-varying reachability need their own conditions; target reachability is weaker than all-state reachability'}
assert np.allclose(np.column_stack((C.T,A.T@C.T)),Ob.T)
assert np.allclose(np.vstack((B.T,B.T@A.T)),Co.T)
models['duality']={'identity':'O(A,C)^T=Ctrb(A^T,C^T)','reverseIdentity':'Ctrb(A,B)^T=O(A^T,B^T)','boundary':'linear algebra duality under transposition, not physical identity of sensors and actuators or all estimation/control tasks'}
report={'status':'passed','stage':'models-before-authoring','models':models}
(BATCH/'model-verification.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(report,ensure_ascii=False,indent=2))
