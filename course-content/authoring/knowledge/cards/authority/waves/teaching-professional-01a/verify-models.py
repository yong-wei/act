"""Sampling and aliasing models checked before authored content."""
from pathlib import Path
import math,json,cmath
BATCH=Path(__file__).resolve().parent
models={};fs=10.;samples=[]
for k in range(21):
 t=k/fs;low=math.cos(2*math.pi*2*t);high=math.cos(2*math.pi*8*t)
 assert abs(low-high)<1e-12
 samples.append({'k':k,'t':t,'cos2Hz':low,'cos8Hz':high})
models['aliasing']={'sampleRateHz':fs,'samplePeriodSeconds':1/fs,'signals':['cos(2pi*2t)','cos(2pi*8t)'],'samples':samples[:6],'sameSamples':True,'boundary':'deterministic signals alias too; reconstruction requires spectral assumptions; post-sampling filter cannot generally distinguish identical sample sequences'}
for k in range(21):assert abs(math.sin(2*math.pi*5*k/fs))<1e-12
models['nyquist_boundary']={'fsHz':fs,'nyquistFrequencyHz':fs/2,'bandlimitedSignalNyquistRateForB2Hz':4,'criticalSignal':'sin(2pi*5t)','criticalSamples':'all zero at k/10','strictGuarantee':'fs>2B for arbitrary strictly bandlimited signal under ideal infinite-sample reconstruction assumptions','boundary':'fs/2 frequency vs 2B required sampling rate; equality needs endpoint restrictions, not arbitrary phase guarantee'}
Ts=.2;a=math.exp(-Ts);b=1-a
for x0,u,t in [(0,1,Ts),(.4,-.2,Ts),(1,0,Ts)]:
 exact=u+(x0-u)*math.exp(-t)
 assert abs(exact-(a*x0+b*u))<1e-12
seq=[0.]
for k in range(5):seq.append(a*seq[-1]+b)
for k,x in enumerate(seq):assert abs(x-(1-math.exp(-k*Ts)))<1e-12
models['sample_hold']={'plant':'xdot=-x+u; y=x','periodSeconds':Ts,'heldInput':'u(t)=u[k] for kT<=t<(k+1)T','exactRecurrence':'x[k+1]=a*x[k]+(1-a)*u[k]','a':a,'inputCoefficient':b,'unitStepSamples':seq,'intersampleAtPoint1':1-math.exp(-.1),'boundary':'continuous plant exists between samples; sequence is not impulse train; hold is distinct from sampling and quantization'}
# Pure computational delay sensitivity at a fixed frequency, not entire stability proof.
w=5.
models['sample_rate_design']={'targetAngularFrequency':w,'periodsSeconds':[.02,.2],'oneSampleDelayPhasesDegrees':[-math.degrees(w*T) for T in [.02,.2]],'boundary':'same one-sample delay gives different physical phase lag; rate selection must consider dynamics, processing delay and bandwidth, not Nyquist threshold alone'}
fc=3.;atten=lambda f:1/math.sqrt(1+(f/fc)**2)
models['prefilter']={'analogFilter':'H(s)=1/(1+s/(2pi*3))','cutoffHz':fc,'magnitudeAt2Hz':atten(2),'magnitudeAt8Hz':atten(8),'boundary':'finite-order filter attenuates rather than eliminates out-of-band components; affects desired band too; located before sampling'}
models['ideal_sampler']={'timeModel':'x_s(t)=sum_k x(kT) delta(t-kT)','spectrumConvention':'angular frequency transform; X_s(jw)=1/T sum_m X(j(w-m ws)); ws=2pi/T','sequence':'x[k]=x(kT)','boundary':'Dirac impulses have weights not ordinary finite amplitudes; ideal sampler is mathematical abstraction, not finite-width pulse or zero-order hold'}
# Sampled proportional closed-loop examples added during authoring.
closed=[]
for period in [.2,2.]:
 a=math.exp(-period);pole=3*a-2
 closed.append({'period':period,'pole':pole,'stable':abs(pole)<1})
assert closed[0]['stable'] and not closed[1]['stable']
assert abs(2*(1-math.exp(-.2))/(1-(3*math.exp(-.2)-2))-2/3)<1e-12
for k in range(11):assert abs(math.sin(2*math.pi*5*(.05+k*.1))-(-1)**k)<1e-12
models['sampled_feedback']={'plant':'xdot=-x+u','controller':'u[k]=2(r[k]-x[k])','hold':'zero order, immediate update without computational delay','pole':'3exp(-T)-2','samples':closed,'constantReferenceEquilibrium':2/3,'boundary':'different delay/hold requires a different recurrence'}
models['sampling_phase']={'signal':'sin(2pi*5t)','period':.1,'t0zero':'all zero','t0point05':'(-1)^k'}
report={'status':'passed','stage':'models-before-authoring','models':models}
(BATCH/'model-verification.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(report,ensure_ascii=False,indent=2))
