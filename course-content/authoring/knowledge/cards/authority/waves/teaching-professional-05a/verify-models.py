"""Original Lyapunov examples; numerical checks complement analytic arguments."""
import json
from pathlib import Path
import numpy as np
from scipy.linalg import expm, solve_continuous_lyapunov

BATCH=Path(__file__).resolve().parent

def check(a,b):
    assert np.allclose(a,b,atol=1e-10), (a,b)

A=np.array([[-1.,4.],[0.,-2.]])
P=solve_continuous_lyapunov(A.T,-np.eye(2))
check(P,[[1/2,2/3],[2/3,19/12]])
check(A.T@P+P@A,-np.eye(2))
assert min(np.linalg.eigvalsh(P))>0
x=np.ones(2)
check(x@(A.T+A)@x,2.)
check(x@(A.T@P+P@A)@x,-2.)
assert max(np.linalg.eigvals(A).real)<0
check(solve_continuous_lyapunov(np.array([[1.]]),np.array([[-1.]])),[[-0.5]])

R=np.array([[0.,1.],[-1.,0.]])
check(R.T+R,np.zeros((2,2)))
for t in [0.,0.3,2.,10.]:check(np.linalg.norm(expm(R*t)@np.array([2.,-1.])),np.sqrt(5.))

# The analytic solution to xdot=-x^3 and its time derivative.
for x0 in [-3.,-0.2,0.,0.4,2.]:
    for tau in [0.,1.,10.]:
        sol=x0/np.sqrt(1+2*x0*x0*tau)
        derivative=-x0**3/(1+2*x0*x0*tau)**1.5
        check(derivative,-sol**3)
        assert abs(sol)<=abs(x0)+1e-12

# Uniform stability versus nonuniform attraction for xdot=-x/(1+t).
ratios={}
for t0 in [0.,10.,1000.,1000000.]:
    T=10.; t=t0+T; ratio=(1+t0)/(1+t)
    assert 0<ratio<=1
    ratios[str(t0)]=ratio
assert ratios['1000000.0']>0.9999
# Uniform exponential decay: for |x0|<=r use T=log(r/eps)/2.
r=2.;eps=0.01;T=np.log(r/eps)/2
check(r*np.exp(-2*T),eps)

D=np.array([[0.,1.],[-1.,-1.]])
check((D.T+D)/2,[[0,0],[0,-1]])
# On x2=0, keeping x2dot=0 requires x1=0: LaSalle invariant set.
for x1 in [-2.,0.,3.]:check((D@np.array([x1,0.]))[1],-x1)
for a,b in [(1.,2.),(-3.,0.4),(0.,0.)]:
    check(np.array([a,b])@np.array([-a,-b**3]),-a*a-b**4)
    check(a*(-a-a**3),-a*a-a**4)

models={
 'definiteness':{'positiveDefiniteP':[[1,0],[0,2]],'positiveSemidefiniteP':[[1,0],[0,0]],'nonzeroZeroPoint':[0,1],'negativeForms':'negatives of the positive forms'},
 'stable_rotation':{'A':R.tolist(),'normConstant':True},
 'cubic_asymptotic':{'solution':'x0/sqrt(1+2*x0^2*(t-t0))','derivative':'-x^3','notExponential':'decay is algebraic for nonzero initial states'},
 'uniform_stability':{'solutionRatio':'(1+t0)/(1+t)','fixedWait':10,'ratios':ratios},
 'uniform_asymptotic':{'system':'xdot=-2x','radius':r,'epsilon':eps,'waitingTime':float(T)},
 'global_asymptotic':{'system':'xdot=-x-x^3','V':'x^2/2','Vdot':'-x^2-x^4','localCounterexample':'xdot=-x+x^3, basin (-1,1)'},
 'candidate_failure':{'A':A.tolist(),'V':'x^T*x','point':[1,1],'Vdot':2},
 'lyapunov_equation':{'P':P.tolist(),'eigenvalues':np.linalg.eigvalsh(P).tolist(),'residualMax':float(np.max(np.abs(A.T@P+P@A+np.eye(2)))),'unstableScalarP':-0.5},
 'energy_lasalle':{'A':D.tolist(),'Vdot':'-x2^2','largestInvariantSubsetOfZeroDerivative':'origin'},
 'indirect_method':{'localStableJacobian':-1,'inconclusivePair':['xdot=-x^3','xdot=x^3'],'pairJacobian':0},
 'direct_method':{'system':['-x1','-x2^3'],'V':'(x1^2+x2^2)/2','Vdot':'-x1^2-x2^4'}
}
(BATCH/'model-verification.json').write_text(json.dumps({'status':'passed','models':models},ensure_ascii=False,indent=2)+'\n')
print('Passed eleven original Lyapunov model groups; analytic scope recorded')
