"""Analytic phase-plane, regional-equilibrium and admissible-input examples."""
from pathlib import Path
import math,json
BATCH=Path(__file__).resolve().parent
models={};beta=math.sqrt(3)/2
samples=[]
for t in [0,.5,1,2,4]:
 c=math.cos(beta*t);ss=math.sin(beta*t);e=math.exp(-t/2)
 x=e*(c+ss/math.sqrt(3));v=-2/math.sqrt(3)*e*ss
 vd=e*(ss/math.sqrt(3)-c)
 assert abs(vd+x+v)<1e-12
 samples.append({'t':t,'x':x,'v':v,'energy':(x*x+v*v)/2})
assert all(samples[i+1]['energy']<samples[i]['energy'] for i in range(len(samples)-1))
models['damped_phase']={'equation':'xdot=v; vdot=-x-v','initial':[1,0],'exactX':'exp(-t/2)[cos(sqrt(3)t/2)+sin(sqrt(3)t/2)/sqrt(3)]','exactV':'-2exp(-t/2)sin(sqrt(3)t/2)/sqrt(3)','eigenvaluesRealPart':-.5,'eigenvaluesImagMagnitude':beta,'samples':samples,'energyDerivative':'-v^2','boundary':'state plane x,v; phase curve is not x(t) vs time'}
for m in [-2,-1,0,1]:
 v=1.;x=-(m+1)*v;assert abs((-x-v)/v-m)<1e-12
models['isoclines']={'slope':'dv/dx=(-x-v)/v for v!=0','constantSlopeM':'x=-(m+1)v','verticalDirection':'v=0,x!=0; xdot0 but vdot=-x nonzero','singularity':[0,0],'boundary':'0/0 at equilibrium; slopes alone do not give time direction, use vector field'}
f=lambda x:.5*max(-1,min(1,x))
models['regional_equilibria']={'equation':'xdot=v; vdot=-v-x+0.5clip(x,-1,1)','innerRegion':'abs(x)<=1: vdot=-v-0.5x; equilibrium(0,0) real','positiveRegion':'x>1: vdot=-v-x+0.5; extension equilibrium(0.5,0) virtual','negativeRegion':'x<-1: vdot=-v-x-0.5; extension equilibrium(-0.5,0) virtual','actualEquilibria':[[0,0]],'switchingLines':[-1,1],'boundary':'real/virtual describe region membership, not real/complex eigenvalues; vector field continuous at lines, formula changes but state does not jump'}
for x in [-1,1]:
 for v in [-1,0,1]:assert abs((-v-x+f(x))-(-v-.5*x))<1e-12
models['harmonic_comparison']={'equation':'xdot=v; vdot=-x','invariant':'x^2+v^2=constant','directionAt1_0':[0,-1],'boundary':'family of closed orbits, not isolated limit cycles; origin is center, stability different from damped focus'}
# Double integrator, prescribed admissible bang input; no optimality claim.
for t in [0,.5,1,1.5,2]:
 if t<=1:x=.5*t*t;v=t;u=1
 else:
  q=t-1;x=.5+q-.5*q*q;v=1-q;u=-1
 assert abs(u)<=1
 if t==2:assert abs(x-1)<1e-12 and abs(v)<1e-12
models['admissible_control']={'system':'xdot=v; vdot=u','constraints':'abs(u)<=1, piecewise continuous; horizon2; initial(0,0), terminal(1,0)','input':'u=1 on [0,1), u=-1 on [1,2]','terminal':[1,0],'amplitudeViolationExample':2,'boundedButTerminalFailExample':'u=0 gives terminal(0,0)','boundary':'admissibility depends on all declared constraints; no minimum-time claim from feasible example; switch at time1 not a derived optimal phase switching curve'}
report={'status':'passed','stage':'models-before-authoring','models':models}
(BATCH/'model-verification.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(report,ensure_ascii=False,indent=2))
