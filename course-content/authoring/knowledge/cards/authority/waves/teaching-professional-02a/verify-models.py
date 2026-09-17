"""Discrete transforms, holds and finite-word examples before authoring."""
from pathlib import Path
import math,cmath,json
BATCH=Path(__file__).resolve().parent
models={};a=.5;z=2.
series=sum(a**k*z**(-k) for k in range(100));assert abs(series-z/(z-a))<1e-12
models['z_transform']={'sequence':'a^k for k>=0; a=0.5','transform':'z/(z-a)','roc':'abs(z)>abs(a)','atZ2':series,'boundary':'bilateral inverse not unique without ROC; one-sided transform includes initial-condition terms'}
y=[2.]
for k in range(5):y.append(.5*y[-1]+1)
assert y==[2]*6
models['difference_equation']={'equation':'y[k+1]=0.5y[k]+u[k]','oneSidedTransform':'z(Y-y[0])=0.5Y+U','zeroStateTransfer':'1/(z-0.5)','unitStepZeroInitial':'2(1-0.5^k)','nonzeroInitialExample':{'y0':2,'u':1,'y':y},'boundary':'transfer function describes zero state; initial response must be included separately'}
T=.2;a=math.exp(-T);coef=1-a
models['zoh']={'continuous':'1/(s+1)','period':T,'a':a,'b':coef,'discrete':'(1-a)/(z-a)','method':'sample continuous step response then multiply Z by 1-z^-1','boundary':'Z acts on sampled inverse-Laplace step response, not directly on a rational function of s; exact for declared held input and sample timing'}
c=1-(1-a)/T;x=0.;rows=[]
for k in range(5):
 uk=k*T;prev=(k-1)*T;x=a*x+coef*uk+c*(uk-prev);exact=(k+1)*T-1+math.exp(-(k+1)*T);assert abs(x-exact)<1e-12;rows.append(x)
models['foh_extrapolation']={'law':'u(t)=u[k]+(u[k]-u[k-1])*(t-kT)/T','plant':'xdot=-x+u','period':T,'recurrence':'x[k+1]=a*x[k]+(1-a)*u[k]+c*(u[k]-u[k-1])','c':c,'currentInputCoefficient':coef+c,'previousInputCoefficient':-c,'rampHistory':'u[k]=kT, including u[-1]=-T; x[0]=0','rampOutputSamples':rows,'boundary':'causal extrapolating FOH from source; not interpolation using future sample u[k+1]; boundary reset possible for nonramp data'}
q=lambda v:.125*math.floor(v/.125+.5);assert q(.99)==1
wrap=lambda v:((round(v*4)+8)%16-8)/4
assert wrap(2.25)==-1.75
models['finite_word']={'coefficientExact':.99,'step':.125,'roundedCoefficient':q(.99),'effect':'asymptotically decaying scalar recursion becomes constant at coefficient1','signedFourBitTwoFractionRange':[-2,1.75],'sum':2.25,'saturatingSum':1.75,'wrappingSum':wrap(2.25),'boundary':'rounding and overflow mode must be declared; no generic white-noise assumption'}
k=math.ceil(math.log(.02)/math.log(a));assert k==20
models['sampled_metrics']={'response':'1-exp(-kT)','period':T,'twoPercentSampleSettlingIndex':k,'sampleTime':k*T,'continuousSettlingTime':-math.log(.02),'intersampleCounterexample':'1+0.1sin(2pi*t/T) has samples1 but peaks1.1','boundary':'sample-based threshold and true continuous intersample performance differ; sampled criterion requires all later sample errors within bound'}
for z in [0,.5,-.5,.3+.4j]:assert ((z+1)/(z-1)).real<0
for th in [.3,1,2]:assert abs(((cmath.exp(1j*th)+1)/(cmath.exp(1j*th)-1)).real)<1e-12
models['source_w_convention']={'mapping':'w=(z+1)/(z-1), z=(w+1)/(w-1)','atZ0':-1,'atZpoint5':-3,'z1':'maps to infinity','zMinus1':'maps to0','unitCircle':'w=-j cot(theta/2)','boundary':'source uses reciprocal Cayley convention; not same variable as Tustin s=(2/T)(z-1)/(z+1); preserve exceptional points and scale'}
alpha=2/T;pole=(alpha-1)/(alpha+1)
models['tustin']={'continuous':'1/(s+1)','period':T,'substitution':'s=(2/T)(z-1)/(z+1)','discrete':'(z+1)/[(2/T+1)z+(1-2/T)]','pole':pole,'zohPole':a,'frequencyWarp':'Omega=2atan(omega*T/2)','boundary':'trapezoidal approximation, not exact ZOH equivalence; unit-circle frequency mapping is warped'}
for sigma in [-1,0,1]:assert abs(abs(cmath.exp(complex(sigma,2)*T))-math.exp(sigma*T))<1e-12
assert abs(cmath.exp(1j*2*T)-cmath.exp(1j*(2+2*math.pi/T)*T))<1e-12
models['exponential_mapping']={'mapping':'z=exp(sT)','period':T,'stablePoleMinus1':a,'frequencyPeriod':2*math.pi/T,'boundary':'many-to-one in imaginary direction; LHP inside unit circle, axis on circle; not a claim that every discretization uses exponential pole mapping'}
report={'status':'passed','stage':'models-before-authoring','models':models}
(BATCH/'model-verification.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(report,ensure_ascii=False,indent=2))
