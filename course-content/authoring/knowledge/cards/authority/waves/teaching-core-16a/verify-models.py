"""Verify current non-reduction examples; Routh approximation source still pending."""
import json
from pathlib import Path
import numpy as np
from scipy.integrate import quad

BATCH=Path(__file__).resolve().parent
models={}
T=1.
W=np.array([[(1-np.exp(-2*T))/2,(1-np.exp(-3*T))/3],[(1-np.exp(-3*T))/3,(1-np.exp(-4*T))/4]])
for i in range(2):
 for j in range(2):
  assert abs(W[i,j]-quad(lambda t:np.exp(-(i+j+2)*t),0,T)[0])<1e-12
assert np.linalg.det(W)>0
models['controllability_gramian']={'A':[[-1,0],[0,-2]],'B':[1,1],'T':T,'W':W.tolist(),'determinant':float(np.linalg.det(W)),
 'uncontrollableB':[1,0],'uncontrollableW':[[float(W[0,0]),0],[0,0]],
 'boundary':'finite-time controllability criterion, not a stability criterion'}

def routh(coeff):
 n=len(coeff)-1;cols=(n+2)//2;a=np.zeros((n+1,cols));a[0,:len(coeff[::2])]=coeff[::2];a[1,:len(coeff[1::2])]=coeff[1::2];aux=[];epsilon=[]
 for i in range(1,n+1):
  if np.all(abs(a[i])<1e-12):
   power=n-i+1;aux.append({'zeroRowDegree':n-i,'auxiliaryDegree':power,'coefficients':a[i-1].tolist()})
   a[i]=a[i-1]*np.array([max(power-2*j,0) for j in range(cols)])
  elif abs(a[i,0])<1e-12:
   a[i,0]=1e-8;epsilon.append(n-i)
  if i<n:
   for j in range(cols-1):a[i+1,j]=(a[i,0]*a[i-1,j+1]-a[i-1,0]*a[i,j+1])/a[i,0]
 return {'firstColumn':a[:,0].tolist(),'auxiliaryPolynomials':aux,'epsilonRows':epsilon}
even=[1.,2.,2.,2.,1.];assert np.allclose(np.polymul([1,0,1],[1,2,1]),even)
er=routh(even);assert er['auxiliaryPolynomials'][0]['auxiliaryDegree']==2
odd=[1.,1.,1.,1.,0.];assert np.allclose(np.polymul([1,0],np.polymul([1,1],[1,0,1])),odd)
orow=routh(odd);assert orow['auxiliaryPolynomials'][0]['auxiliaryDegree']==3
models['auxiliary']={'standardPolynomial':even,'factorization':'(s^2+1)(s+1)^2','routh':er,
 'originExample':odd,'originFactorization':'s(s+1)(s^2+1)','originRouth':orow,
 'boundary':'all-zero row; an origin root can give an odd auxiliary polynomial'}
single=[1.,2.,3.,6.,5.];sr=routh(single)
assert sr['epsilonRows']==[2] and len(sr['auxiliaryPolynomials'])==0
assert sum(np.real(np.roots(single))>1e-9)==2
models['first_column_zero']={'polynomial':single,'routh':sr,'rhpRoots':2,
 'boundary':'a single leading zero is different from an all-zero row; epsilon represents its positive limit'}
assert np.max(np.roots([1,3,2,5]).real)<0
assert sum(np.roots([1,3,2,7]).real>0)==2
models['parameter_range']={'polynomial':'s^3+3s^2+2s+K','firstColumn':['1','3','(6-K)/3','K'],'strictStableInterval':'0<K<6'}
# p(s)=(s+1)(s+2)(s+3); substitute s=z-a using polynomial composition.
p=np.poly1d([1.,6.,11.,6.]);shifted={}
for margin in [.5,1.2]:
 q=p(np.poly1d([1.,-margin]));roots=np.roots(q)
 assert np.allclose(np.sort(roots),np.sort(np.array([-1.,-2.,-3.])+margin))
 shifted[str(margin)]={'coefficients':q.c.tolist(),'roots':roots.tolist(),'allInLHP':bool(np.all(roots.real<0))}
assert shifted['0.5']['allInLHP'] and not shifted['1.2']['allInLHP']
models['axis_shift']={'p':[1,6,11,6],'requirement':'Re(s)<-a','substitution':'s=z-a','cases':shifted}
assert np.max(np.roots([1,12,44,48]).real)<0
assert np.max(np.roots(np.polymul([1,1],[1,-.1]))).real>0
models['absolute_stability_context']={'meaning':'binary linear closed-loop stability in this source; not nonlinear sector absolute stability','exampleStablePolynomial':[1,6,11,6]}
# Routh alpha-beta example: generate the table and beta pivot instead of guessing a reduced denominator.
D=np.array([1.,2.,1.,1.]);N=np.array([2.,1.,1.])
Dh=D[::-1];Nh=N[::-1]
assert np.allclose(Dh,[1,1,2,1]) and np.allclose(Nh,[1,1,2])
first=routh(Dh)['firstColumn'];alpha=np.array(first[:-1])/np.array(first[1:])
beta=np.array([Nh[0]/first[1],Nh[1]/first[2],(Nh[2]-(Nh[0]/first[1])*Dh[3])/first[3]])
assert np.allclose(alpha,1) and np.allclose(beta,1)
A=[np.poly1d([1.]),np.poly1d([alpha[0],1.])];B=[np.poly1d([0.]),np.poly1d([beta[0]])]
for k in [2,3]:
 A.append(np.poly1d([alpha[k-1],0])*A[k-1]+A[k-2])
 B.append(np.poly1d([alpha[k-1],0])*B[k-1]+B[k-2]+np.poly1d([beta[k-1]]))
assert np.allclose(A[3].c,Dh) and np.allclose(B[3].c,Nh)
# s^-1 * (B_k(1/s)/A_k(1/s)); each numerator here has exact degree k-1.
R2n=B[2].c[::-1];R2d=A[2].c[::-1]
assert np.allclose(R2n,[1,1]) and np.allclose(R2d,[1,1,1])
assert np.max(np.roots(D).real)<0 and np.max(np.roots(R2d).real)<0
assert np.allclose(A[3].c[::-1],D) and np.allclose(B[3].c[::-1],N)
difference=np.polysub(np.polymul(N,R2d),np.polymul(R2n,D))
assert np.allclose(difference,[1,0,1,0,0])
models['routh_approximation']={'originalNumerator':N.tolist(),'originalDenominator':D.tolist(),
 'reciprocalNumerator':Nh.tolist(),'reciprocalDenominator':Dh.tolist(),'routhFirstColumn':first,
 'alpha':alpha.tolist(),'beta':beta.tolist(),'R2numerator':R2n.tolist(),'R2denominator':R2d.tolist(),
 'fullOrderRecovered':True,'bothModelsStable':True,'differenceNumerator':difference.tolist(),
 'boundary':'specific three-to-two Routh recurrence; low-order coefficient agreement is not zero error'}
(BATCH/'model-verification.json').write_text(json.dumps({'status':'passed','stage':'models-before-authoring','models':models},ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'verified':list(models),'gramianDeterminant':float(np.linalg.det(W)),'pending':None},ensure_ascii=False))
