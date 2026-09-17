"""Limit-cycle, harmonic approximation and quantization teaching examples."""
from pathlib import Path
import math,cmath,json
BATCH=Path(__file__).resolve().parent
models={}
for x,y in [(.5,0),(1,0),(1.2,.2),(-.6,.8)]:
 r=math.hypot(x,y);xd=(1-r*r)*x-y;yd=x+(1-r*r)*y
 assert abs((x*xd+y*yd)/r-r*(1-r*r))<1e-12
 assert abs((x*yd-y*xd)/(r*r)-1)<1e-12
models['stable_limit_cycle']={'cartesian':'xdot=(1-r^2)x-y; ydot=x+(1-r^2)y; r^2=x^2+y^2','radial':'rdot=r(1-r^2), theta_dot=1','cycleRadius':1,'period':2*math.pi,'insideR05RadialRate':.5*(1-.25),'outsideR2RadialRate':2*(1-4),'origin':'equilibrium, not itself the cycle; nonzero initial radii converge to cycle','boundary':'isolated periodic orbit; harmonic oscillator family of circles is not a limit cycle'}
for r in [.5,.9,1,1.1,2]:
 f=r*(r*r-1)**2;assert f>=0
models['semistable_cycle']={'cartesian':'xdot=(r^2-1)^2 x-y; ydot=x+(r^2-1)^2 y','radial':'rdot=r(r^2-1)^2; theta_dot=1','cycleRadius':1,'inside':'r rises toward1 asymptotically','outside':'r rises away from1','boundary':'attracts from one side and repels from other; not two-sided asymptotic stability'}
# Fourier projection directly integrates relay output for sinusoidal input.
A=2.;M=1.;n=100000;dt=2*math.pi/n
sincoef=coscoef=third=0.
for i in range(n):
 theta=(i+.5)*dt;y=M if math.sin(theta)>0 else -M
 sincoef+=y*math.sin(theta)*dt/math.pi
 coscoef+=y*math.cos(theta)*dt/math.pi
 third+=y*math.sin(3*theta)*dt/math.pi
assert abs(sincoef-4/math.pi)<1e-8 and abs(coscoef)<1e-10
assert abs(third-4/(3*math.pi))<1e-8
models['relay_describing_function']={'input':'A sin(theta)','output':'M sign(sin(theta))','A':A,'M':M,'fundamentalSine':sincoef,'fundamentalCosine':coscoef,'N':4*M/(math.pi*A),'NAtAmplitude1':4/math.pi,'NAtAmplitude2':2/math.pi,'negativeInverseAtAmplitude2':-math.pi/2,'thirdHarmonicAmplitude':third,'boundary':'fundamental approximation, not exact linear gain; A>0; third harmonic nonzero'}
G=lambda w:1/((1+1j*w)*(2+1j*w)*(3+1j*w));w=math.sqrt(11);a=1/(15*math.pi);N=4/(math.pi*a)
assert abs(1+G(w)*N)<1e-12
ratio=abs(G(3*w)/G(w))/3
models['harmonic_balance']={'G':'1/[(s+1)(s+2)(s+3)]','relayM':1,'candidateOmega':w,'candidateAmplitudeAtRelayInput':a,'describingGain':N,'negativeInverse':-1/N,'thirdToFirstAfterLinearPartAssumingSinusoidalInput':ratio,'boundary':'candidate from 1+GN=0 only; existence/amplitude/stability need full nonlinear confirmation; no external periodic reference'}
delta=.25
q=lambda x:max(-1,min(1,delta*math.floor(x/delta+.5)))
for x in [i/1000 for i in range(-1000,1001)]:assert abs(q(x)-x)<=delta/2+1e-12
models['quantization']={'step':delta,'law':'Q(x)=clip(delta floor(x/delta+0.5),-1,1)','tieRule':'half-step ties toward positive infinity before clipping','errorDefinition':'e=Q(x)-x','samples':[[x,q(x),q(x)-x] for x in [-.4,0,.125,.4,1,1.6]],'noOverloadBound':delta/2,'overloadExampleError':q(1.6)-1.6,'uniformErrorVarianceIfAssumed':delta*delta/12,'boundary':'bounded rounding error requires no overload; uniform independent noise is an additional approximation, not guaranteed by deterministic quantizer; sampling and amplitude quantization are distinct'}
report={'status':'passed','stage':'models-before-authoring','models':models}
(BATCH/'model-verification.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(report,ensure_ascii=False,indent=2))
