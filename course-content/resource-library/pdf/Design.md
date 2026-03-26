# Design

- 来源文件：`Design.pdf`
- 页数：78

## 第 1 页

自动控制原理
控制系统综合
自动化学院
张永韡 博士 副教授
2023-2024 学年春

## 第 2 页

主要内容
1 问题描述
2 磁盘读写系统的数学模型
3 磁盘读写系统的反馈控制
4 磁盘读写系统反馈控制的性能
5 磁盘读写控制系统的稳定性
6 磁盘读写系统 PID 控制-使用根轨迹法
7 磁盘读写系统模糊控制
控制系统综合 自动控制原理 2023-2024 学年春 2 / 59

## 第 3 页

1. 问题描述 1. 磁盘驱动器
问题描述：磁盘驱动器
磁盘驱动器是目前最有效和方便的数据存储介质之一。过去，人们一直在尝试增大磁盘的
存储密度并缩短存取时间。在上世纪 90 年代，磁盘驱动器的数据密度以每年 60% 的速率
递增，近些年来更是达到了每年 100% 的增长速度。下图为磁盘驱动器的基本结构图。
Sectio n 1 . 9 S e q u e n t i a l D e s i g n Example : D i s k Driv e Rea d Syste m 29
FIGUR E 1 . 2 5
Dis k driv e dat a
densit y trend s
(Source : IBM) .
198 0 198 5 199 0 1 9 9 5
Productio n (Year ;
200 0 200 5
includ e o f f - l i n e e r r o r r e c o v e r y , d i s k d r i v e f a i l u r e w a r n i n g s , an d s t o r i n g dat a a c r o s s
multipl e dis k drives . Conside r th e basi c diagra m of a dis k driv e show n in Fig . 1.26 . Th e
goa l o f th e d i s k d r i v e r e a d e r d e v i c e is to positio n t h e r e a d e r h e a d to r e a d t h e d a t a
store d o n a trac k o n th e disk . Th e variabl e to accuratel y contro l is th e positio n o f th e
reade r hea d ( m o u n t e d o n a slide r device) . Th e dis k rotate s a t a spee d betwee n 1 8 0 0
and 720 0 rpm , an d t h e hea d "flies " abov e th e d i s k a t a distanc e o f les s tha n 1 0 0 nm .
Th e initia l specificatio n f o r th e positio n a c c u r a c y is 1 / x m . Furthermore , w e pla n to be
abl e t o m o v e t h e h e a d f r o m t r a c k a to t r a c k b w i t h i n 5 0 m s , if p o s s i b l e . Thus , w e
establis h an initia l syste m configuratio n a s show n in Figur e 1.27 . Thi s propose d closed -
loo p s y s t e m use s a moto r to actuat e ( m o v e ) t h e ar m to th e d e s i r e d l o c a t i o n o n t h e
disk . W e wil l conside r th e desig n of th e dis k driv e furthe r in Chapte r 2.
FIGUR E 1 . 2 6
(a) A dis k driv e
© 199 9 Quantu m
Corporation . Al l
right s reserved .
(b) Diagra m of a
dis k drive .
Rotatio n
of ar m
Spindl e
Trac k a
Trac k b
Hea d slide r
(a) (b)
图 9-1: 磁盘驱动器结构图
控制系统综合 自动控制原理 2023-2024 学年春 3 / 59

## 第 4 页

1. 问题描述 2. 磁盘驱动器闭环系统
问题描述：磁盘驱动器闭环系统
磁盘驱动器使用读写头读取存储在磁盘轨道上的数据。磁盘驱动器的读取装置将读写头准
确的定位在相应轨道上。影响控制精度的变量就是读写头的位置（安装在滑动装置上） 。磁
盘以每分钟 1800∼7200 转的速度转动，读写头“飞”至磁盘表面上方，且与磁盘表面的工作
距离小于 100 nm。位置精度的初始指标是 1µm。此外，读写头应该能够在 50 ms 内从轨道
a 移动到轨道 b。由此，可以得到初始的系统结构图：
期望磁头位置 误差
控制装置 执行电机
和读写臂
实际磁头位置
传感器
−
图 9-2: 磁盘驱动器闭环系统
所得闭环系统使用电机作为执行机构，驱动读写臂到磁盘上的期望位置。
控制系统综合 自动控制原理 2023-2024 学年春 4 / 59

## 第 5 页

2. 磁盘读写系统的数学模型 1. 读写臂
磁盘读写系统的数学模型：读写臂
前面确定了磁盘驱动系统的两个初始目标：
1 精确定位读写头至期望轨道
2 在 50 ms 内由一条轨道移动到另一条轨道
首先确定控制对象 G(s) 和传感器的数学模
型。磁盘驱动器使用永磁直流电机使得读写
臂旋动。直流电机使用所谓的音圈电动机。
音圈电动机是为适应计算机外围设备存储容
量增大的需要而发展起来的一种高精度直线
定位用的新型执行元件。读写头安装在滑动
装置上，而滑动装置连接在读写臂上，如右
图所示：
Sectio n 2.1 0 S e q u e n t i a l D e s i g n Example : Dis k Driv e Rea d Syste m 117
2.10 S E Q U E N T I A L DESIG N EXAMPLE : DIS K DRIV E REA D SYSTE M
^
In Sectio n 1 . 9, we develope d an initia l goa l for th e dis k driv e system : to positio n t he
reade r hea d accuratel y at th e desire d t r a c k and to mov e fro m o n e trac k to a n o t h e r
withi n 10 ms , if possible . We nee d to identif y t he plant , the sensor , an d the controller .
We wil l obtai n a mode l of th e plan t G(s) and th e sensor . Th e dis k driv e reade r u s e s
a permanen t magne t D C moto r to rotat e th e reade r ar m ( s e e Figur e 1 . 2 6 ) . Th e D C
moto r is calle d a voic e coi l moto r in th e dis k driv e industry . Th e rea d hea d is mount -
ed on a slide r device , whic h is connecte d to th e arm as show n in Figur e 2 . 7 1 . A f l e x -
ure (sprin g metal ) is use d to enabl e th e hea d to floa t a b o v e th e dis k at a ga p of les s
tha n 1 0 0 nm . Th e thin-fil m hea d read s th e magneti c flu x an d provide s a signa l to an
amplifier . Th e erro r signa l of Figur e 2.72(a ) is provide d by readin g th e erro r fro m a
prerecorde d inde x track . Assumin g an accurat e rea d head , th e senso r ha s a t r a n s f e r
functio n H(s) = 1 , as show n in Figur e 2.72(b) . Th e mode l of th e permanen t m a g n e t
DC moto r a n d a linea r a m p l i f i e r is show n in Figur e 2.72(b) . As a goo d a p p r o x i m a -
tion , we u s e th e mode l of t h e armature-controlle d D C m o t o r as show n e a r l i e r in
FIGUR E 2.7 1
Hea d moun t for
reader , showin g
flexure .
Moto r
Flexur e
Hea d
FIGUR E 2.7 2
Bloc k diagra m
mode l of dis k driv e
read system .
Desire d + , -
head i ^
positio n -~A
-^ e r r o r
J *
,
+ P(r\
R(s) i f
—.
~w
J *
.
Contro l devic e
Amplifie r
Inpu t
voltag e
Actuato r an d rea d a r m
DC moto r an d a rm
Senso r
Rea d hea d a n d inde x t r a c k on dis k
(a)
Amplifie r
K*
V(s)
Senso r
H(s) = 1
Actua l
>- i - i
Moto r an d ar m G(s)
(7(
-
-I -
"
v
" s(Js+b)(Ls+R)
positio n
(b)
图 9-3: 读写臂结构
控制系统综合 自动控制原理 2023-2024 学年春 5 / 59

## 第 6 页

2. 磁盘读写系统的数学模型 2. 方框图
磁盘读写系统的数学模型：方框图
曲部（Flexure，一片有弹性的金属）使得读写头浮动于磁盘面上方 100 nm 的间隙之间。
贴片电阻读写头读取磁通量并把信号传递至放大器。图9-4中的误差信号读取自事先记录在
索引轨道中的误差。
期望
磁头
位置
误差
放大器
控制装置 输入
电压
直流电机和摇臂
执行器和读写臂
实际
磁头
位置读写头和磁盘上的索引轨道
传 感 器
−
图 9-4: 磁盘读写系统方框图
控制系统综合 自动控制原理 2023-2024 学年春 6 / 59

## 第 7 页

2. 磁盘读写系统的数学模型 2. 方框图
磁盘读写系统的数学模型
假设读写准确，则传感器的传递函数为 H(s) = 1 ，如图9-5所示。永磁电机和线性放大器的
模型也如图9-5所示。为了更好的近似，这里使用电枢控制直流电机的模型。
R(s)
E(s)
Ka
放大器 V(s)
G(s) = Km
s(Js+b)(Ls+R)
执行器和读写臂 G(s)
Y(s)
H(s) = 1
传感器
−
图 9-5: 磁盘读写系统方框图
图9-5的模型假定曲部是刚体，也就是不会显著发生形变。以后将会考虑有形变的模型，不
再是完全的刚体。
控制系统综合 自动控制原理 2023-2024 学年春 7 / 59

## 第 8 页

2. 磁盘读写系统的数学模型 3. 典型参数
磁盘读写系统的数学模型：典型参数
表 1: 磁盘驱动器的典型参数
参数 符号 典型值
读写头和读写臂的转动惯量 J 1 N m s2/rad
阻力 b 20 N m s/rad
放大器 Ka 10-1000
电枢电阻 R 1Ω
电机常数 Km 5 N /A
电枢电感 L 1 mH
表1为磁盘驱动系统的典型参数，于是，我们有：
G(s) = Km
s(Js + b)(Ls + R) = 5000
s(s + 20)(s + 1000) (9-1)
控制系统综合 自动控制原理 2023-2024 学年春 8 / 59

## 第 9 页

2. 磁盘读写系统的数学模型 3. 典型参数
磁盘读写系统的数学模型：闭环方框图
还可以写为：
G(s) = Km/(bR)
s(τLs + 1)(τ s + 1) (9-2)
其中 τL = J/b = 50 ms，τ = L/R = 1 ms。由于 τ ≪ τL，常常可以忽略 τ ，于是可以有
G(s) ≈ Km/(bR)
s(τLs + 1) = 0.25
s(0.05s + 1) = 5
s(s + 20)
闭环系统的方框图如下：
R(s)
E(s)
Ka G(s)
Y(s)−
图 9-6: 闭环系统方框图
控制系统综合 自动控制原理 2023-2024 学年春 9 / 59

## 第 10 页

2. 磁盘读写系统的数学模型 3. 典型参数
磁盘读写系统的数学模型：阶跃响应
相应的闭环传递函数：
Y(s)
R(s) = KaG(s)
1 + KaG(s) (9-3)
使用上面给出的 G(s) 的二阶近似模型， 得到：
Y(s)
R(s) = 5Ka
s2 + 20s + 5Ka
当 Ka = 40，可得
Y(s) = 200
s2 + 20s + 200 R(s)
在 R(s) = 0.1
s 下的阶跃响应如右图。
0 0.1 0.2 0.3 0.4 0.5 0.6 0.70
0.02
0.04
0.06
0.08
0.1
0.12
Time (s)
y(t) (rad)
图 9-7: 图9-6中系统在 R(s) = 0.1
s 时的响应
控制系统综合 自动控制原理 2023-2024 学年春 10 / 59

## 第 11 页

3. 磁盘读写系统的反馈控制 1. 控制系统
磁盘读写系统的反馈控制：控制系统
磁盘驱动控制系统的设计目标是准确定位读写头，并能降低参数变化、外部震动和冲击带
来的效应。机械臂和柔性部在特定频率下会发生共振（例如笔记本受到冲击） 。磁盘驱动器
的扰动包括转动轴的物理振动，磨损和晃动，以及部件改变造成的参数变动。
下面将研究扰动和系统参数变化对磁盘驱动系统的影响。此外，还将系统对于阶跃响应的
稳态误差以及放大器增益 Ka 改变时瞬态响应的变化。
考虑图9-8所示的系统，使用可变增益的放大器作为控制器，使用表1中的参数，可得到
图9-9中的传递函数。首先考察当 Td(s) = 0 时系统在单位阶跃输入 R(s) = 1/ s 下的稳态。
当 H(s) = 1 时，有
E(s) = R(s) − Y(s) = 1
1 + KaG1(s)G2(s) R(s)
控制系统综合 自动控制原理 2023-2024 学年春 11 / 59

## 第 12 页

3. 磁盘读写系统的反馈控制 1. 控制系统
磁盘读写系统的反馈控制：控制系统
R(s)
Ka
放大器 V(s) Km
Ls+R
线圈 扰动 Td(s)
− 1
s(Js+b)
负载
Y(s)
H(s) = 1
传感器
−
图 9-8: 磁盘驱动控制系统
R(s)
Ka G1(s) = 5000
s+1000
线 圈
扰动 Td(s)
− G2(s) = 1
s(s+20)
负 载
Y(s)−
图 9-9: 使用表1中典型参数的磁盘驱动控制系统
控制系统综合 自动控制原理 2023-2024 学年春 12 / 59

## 第 13 页

3. 磁盘读写系统的反馈控制 1. 控制系统
磁盘读写系统的反馈控制：闭环传函
因此有
lim
t→∞
e(t) = lim
s→0
s 1
1 + KaG1(s)G2(s)
1
s
于是对于阶跃响应的稳态误差 e(∞) = 0 ，在系统参数改变的情况下此结论依然成立。
现在考察 Ka 调整时的系统瞬态性能。当 Td(s) = 0 时，系统闭环传递函数为
T(s) = Y(s)
R(s) = KaG1(s)G2(s)
1 + KaG1(s)G2(s)
= 5000Ka
s3 + 1020s2 + 20000s + 5000Ka
(9-4)
控制系统综合 自动控制原理 2023-2024 学年春 13 / 59

## 第 14 页

3. 磁盘读写系统的反馈控制 2. 系统仿真
磁盘读写系统的反馈控制：系统仿真
使用下面的代码（以 Ka = 10 为例） ，可以得到系统在Ka = 10 和 Ka = 80 时的响应，如
图9-10所示。显然，系统对于输入的响应在 Ka = 80 时要快得多，但同时出现了震荡，这
是无法接受的。
close all
Ka=10;
nf=5000; df=[1 1000]; sysf=tf(nf,df);
ng=1; dg=[1 20 0];sysg=tf(ng,dg);
sysa=series(Ka*sysf,sysg);
sys=feedback(sysa,1);
t=0:0.01:2;
y=step(sys,t); plot(t,y,'LineWidth',2);
set(gca,'FontSize',20,'FontName','Times');
ylabel('y(t)'), xlabel('Time (s)'), grid
annotation('textbox',[.7,.3,.11,.09],'String',...
['K_a=',num2str(Ka)],'FontSize',20,'FontName','Times');
控制系统综合 自动控制原理 2023-2024 学年春 14 / 59

## 第 15 页

3. 磁盘读写系统的反馈控制 2. 系统仿真
磁盘读写系统的反馈控制：系统仿真
0 0.5 1 1.5 20
0.2
0.4
0.6
0.8
1
y(t)
Time (s)
Ka=10
(a) Ka = 10
0 0.5 1 1.5 20
0.2
0.4
0.6
0.8
1
1.2
1.4y(t)
Time (s)
Ka=80 (b) Ka = 80
图 9-10: Ka = 10 和 Ka = 80 时的闭环系统响应
控制系统综合 自动控制原理 2023-2024 学年春 15 / 59

## 第 16 页

3. 磁盘读写系统的反馈控制 2. 系统仿真
磁盘读写系统的反馈控制
现在考察当 Td(s) = 1/ s，R(s) = 0 时的情况。我们期望将扰动的影响降至最低，使用
图9-9的系统，可以得到以 Td(s) 为输入，Ka = 80 时的系统响应 Y(s)：
Y(s) = G2(s)
1 + KaG1(s)G2(s) Td(s) (9-5)
使用下面的代码可得到系统响应曲线，如图9-11所示。
Ka=80;
nf=[5000]; df=[1 1000]; sysf=tf(nf,df);
ng=[1]; dg=[1 20 0];sysg=tf(ng,dg);
sys=feedback(sysg,Ka*sysf);
sys=-sys;
t=[0:0.01:2];
y=step(sys,t); plot(t,y)
ylabel('y(t)'), xlabel('Time (s)'), grid
控制系统综合 自动控制原理 2023-2024 学年春 16 / 59

## 第 17 页

3. 磁盘读写系统的反馈控制 2. 系统仿真
磁盘读写系统的反馈控制
0 0.5 1 1.5 2−3
−2.5
−2
−1.5
−1
−0.5
0 x 10
−3
y(t)
Time (s)
Ka=80
图 9-11: Ka = 80 时的扰动阶跃响应
为了进一步减小扰动的影响，我们需要将 Ka 增大到 80 以上。但是，这将使系统对阶跃响
应产生更强的震荡。接下来，我们尝试确定 Ka 的最佳值，使得系统响应迅速且无震荡。
控制系统综合 自动控制原理 2023-2024 学年春 17 / 59

## 第 18 页

4. 磁盘读写系统反馈控制的性能 1. 性能指标
磁盘读写系统反馈控制的性能：性能指标
下面给出明确的性能指标，并通过校正放大器增益 Ka 获得尽可能好的系统性能。
我们的目标是取得对于阶跃输入的最快速响应，同时：
1 限制超调和震荡
2 减小扰动对读写头位置的影响。
性能指标如下表：
表 2: 动态响应的性能指标
性能指标 期望值
超调量 小于 5%
调节时间 小于 250 ms
对于单位阶跃输入的最大响应绝对值 小于 5 × 10−3
控制系统综合 自动控制原理 2023-2024 学年春 18 / 59

## 第 19 页

4. 磁盘读写系统反馈控制的性能 1. 性能指标
磁盘读写系统反馈控制的性能：性能指标
考察电机和摇臂的二阶模型，忽略线圈电感，可得到如下图的闭环系统
R(s)
Ka
放大器
5
电机常数
扰动 Td(s)
− 1
s(s+20)
负载
Y(s)−
图 9-12: 电机和负载二阶模型的控制系统
当 Td(s) = 0 时的输出为
Y(s) = 5Ka
s(s + 20) + 5Ka
R(s) = 5Ka
s2 + 20s + 5Ka
R(s)
= ω2
n
s2 + 2ζω ns + ω2n
R(s) (9-6)
控制系统综合 自动控制原理 2023-2024 学年春 19 / 59

## 第 20 页

4. 磁盘读写系统反馈控制的性能 2. 系统仿真
磁盘读写系统反馈控制的性能：系统仿真
因此，ω2
n = 5Ka，2ζω n = 20。使用下面的代码得到响应曲线，响应曲线如图9-13所示。
Ka=[30,60]; t=[0:0.01:1];
for i = 1:2
nc=[Ka(i)*5]; dc=[1]; sysc=tf(nc,dc);
ng=[1]; dg=[1 20 0]; sysg=tf(ng,dg);
sys1=series(sysc,sysg); sys=feedback(sys1,[1]);
y(:,i)=step(sys,t);
end
plot(t,y,'LineWidth',2);
set(gca,'FontSize',20,'FontName','Times');
ylabel('y(t)'), xlabel('Time (s)'), grid
控制系统综合 自动控制原理 2023-2024 学年春 20 / 59

## 第 21 页

4. 磁盘读写系统反馈控制的性能 2. 系统仿真
磁盘读写系统反馈控制的性能：系统仿真
0 0.2 0.4 0.6 0.8 10
0.2
0.4
0.6
0.8
1
1.2
1.4y(t)
Time (s)
Ka=30
Ka=60
图 9-13: Ka = 30 和 60 时的单位阶跃输入响应
控制系统综合 自动控制原理 2023-2024 学年春 21 / 59

## 第 22 页

4. 磁盘读写系统反馈控制的性能 2. 系统仿真
磁盘读写系统反馈控制的性能：系统仿真
表 3: 阶跃输入下的二阶系统响应指标
Ka 20 30 40 60 80
超调量 0 1.2% 4.3% 10.8% 16.3%
调节时间 0.55 0.40 0.40 0.40 0.40
阻尼比 1 0.82 0.707 0.58 0.50
对单位扰动的最大响应 -10E-3 -6.6E-3 -5.2E-3 -3.7E-3 -2.9E-4
控制系统综合 自动控制原理 2023-2024 学年春 22 / 59

## 第 23 页

4. 磁盘读写系统反馈控制的性能 2. 系统仿真
磁盘读写系统反馈控制的性能：系统仿真
当 Ka 增大到 60，扰动的效应降低了一半，如图9-14所示，所用代码如下：
close all
Ka=[30,60]; t=[0:0.01:1];
for i = 1:2
nc=[Ka(i)*5]; dc=[1]; sysc=tf(nc,dc);
ng=[1]; dg=[1 20 0];sysg=tf(ng,dg);
sys=feedback(sysg,sysc);
sys=-sys; y(:,i)=step(sys,t);
end
plot(t,y,'LineWidth',2);
set(gca,'FontSize',20,'FontName','Times');
ylabel('y(t)'), xlabel('Time (s)'), grid
显然，如果使该系统满足目标，必须选择适中的增益。这里，我们选择 Ka = 40 作为最佳
的折衷。这一选择无法满足所有的性能指标，因此，接下来需要再次进行设计，并改变控
制系统的结构。
控制系统综合 自动控制原理 2023-2024 学年春 23 / 59

## 第 24 页

4. 磁盘读写系统反馈控制的性能 2. 系统仿真
磁盘读写系统反馈控制的性能：系统仿真
0 0.2 0.4 0.6 0.8 1−7
−6
−5
−4
−3
−2
−1
0 x 10
−3
y(t)
Time (s)
Ka=30
Ka=60
图 9-14: Ka = 30 和 60 时扰动 Td(s) = 1/ s 的单位阶跃响应
控制系统综合 自动控制原理 2023-2024 学年春 24 / 59

## 第 25 页

5. 磁盘读写控制系统的稳定性 1. 串级控制
磁盘读写控制系统的稳定性：串级控制
上一节考察了带可变增益 Ka 的磁盘读写控制系统，现在考察 Ka 变化时系统的稳定性并
重新设计控制器。
考虑下面的系统，该系统除了增加的速度反馈传感器外，与之前系统别无二致。
R(s)
Ka
放大器
G1(s)
电机线圈
扰动 Td(s)
− 1
s+20
速度 1
s Y(s)
K1
速度传感器
H(s) = 1
位置传感器
− −
图 9-15: 带可选速度反馈的磁盘驱动器闭环控制
控制系统综合 自动控制原理 2023-2024 学年春 25 / 59

## 第 26 页

5. 磁盘读写控制系统的稳定性 1. 串级控制
磁盘读写控制系统的稳定性：串级控制
首先考虑速度传感器断开的情况。闭环传递函数为
Y(s)
R(s) = KaG1(s)G2(s)
1 + KaG1(s)G2(s) , (9-7)
其中
G1(s) = 5000
s + 1000
并且
G2(s) = 1
s(s + 20) .
特征方程为
s(s + 20)(s + 1000) + 5000Ka = 0, (9-8)
或者
s3 + 1020s2 + 20000s + 5000Ka = 0. (9-9)
控制系统综合 自动控制原理 2023-2024 学年春 26 / 59

## 第 27 页

5. 磁盘读写控制系统的稳定性 2. 劳斯判据
磁盘读写控制系统的稳定性：劳斯判据
使用劳斯判据
s3 1 20000
s2 1020 5000 Ka
s1 b1
s0 5000Ka
,
其中
b1 = (20000)1020 − 5000Ka
1020 .
当 Ka = 4080 时，b1 = 0，此时临界稳定。使用辅助方程，有
1020s2 + 5000(4080) = 0 ,
表明在 jω 轴上的根为 s = ±j141.4。为了使系统稳定，应有 Ka < 4080。
控制系统综合 自动控制原理 2023-2024 学年春 27 / 59

## 第 28 页

5. 磁盘读写控制系统的稳定性 2. 劳斯判据
磁盘读写控制系统的稳定性：劳斯判据
现在闭合图9-15速度反馈的开关，由于等效反馈系数等于 1 + K1s，系统的闭环传递函数为：
Y(s)
R(s) = KaG1(s)G2(s)
1 + [KaG1(s)G2(s)](1 + K1s) , (9-10)
如图9-16所示。
R(s)
Ka G1(s)
Td(s)
−
G2(s)
Y(s)
1 + K1s
−
图 9-16: 速度反馈开关闭合的等效系统
控制系统综合 自动控制原理 2023-2024 学年春 28 / 59

## 第 29 页

5. 磁盘读写控制系统的稳定性 2. 劳斯判据
磁盘读写控制系统的稳定性：劳斯判据
系统特征方程为
1 + [KaG1(s)G2(s)](1 + K1s) = 0 ,
或者
s(s + 20)(s + 1000) + 5000Ka(1 + K1s) = 0 .
因此，可得到
s3 + 1020s2 + [20000 + 5000KaK1]s + 5000Ka = 0.
使用劳斯判据
s3 1 20000 + 5000 KaK1
s2 1020 5000Ka
s1 b1
s0 5000Ka
,
其中
b1 = 1020(20000 + 5000KaK1) − 5000Ka
1020 .
控制系统综合 自动控制原理 2023-2024 学年春 29 / 59

## 第 30 页

5. 磁盘读写控制系统的稳定性 3. 系统仿真
磁盘读写控制系统的稳定性：系统仿真
为保证系统稳定，必须选择一对 Ka, K1 使得 b1 > 0，并且 Ka > 0。当 K1 = 0.05，
Ka = 100，使用下面的代码得到系统的响应。
Ka=100; K1=0.05;
ng1=[5000]; dg1=[1 1000]; sys1=tf(ng1,dg1);
ng2=[1]; dg2=[1 20 0]; sys2=tf(ng2,dg2);
nc=[K1 1]; dc=[0 1]; sysc=tf(nc,dc);
syso=series(Ka*sys1,sys2);
sys=feedback(syso,sync); sys=minreal(sys);
t=[0:0.001:0.5];
y=step(sys,t); plot(t,y)
ylabel('y(t)'), xlabel('Time (s)'), grid
控制系统综合 自动控制原理 2023-2024 学年春 30 / 59

## 第 31 页

5. 磁盘读写控制系统的稳定性 3. 系统仿真
磁盘读写控制系统的稳定性：系统仿真
调节时间（2% 误差带）大约为 260ms，超调量为 0。系统的性能如表4。性能指标几乎满足
了，为了得到期望的 250ms 调节时间，还需要对 K1 进行微调。
表 4: 磁盘驱动系统性能指标对比
性能指标 期望值 实际值
超调量 小于 5% 0%
调节时间 小于 250ms 260ms
对扰动的最大响应 小于 5E-3 2E-3
控制系统综合 自动控制原理 2023-2024 学年春 31 / 59

## 第 32 页

5. 磁盘读写控制系统的稳定性 3. 系统仿真
磁盘读写控制系统的稳定性：系统仿真
0 0.1 0.2 0.3 0.4 0.50
0.2
0.4
0.6
0.8
1
y(t)
Time (s)
图 9-17: Ka = 100 和 K1 = 0.05 时速度反馈系统的响应
控制系统综合 自动控制原理 2023-2024 学年春 32 / 59

## 第 33 页

6. 磁盘读写系统 PID 控制-使用根轨迹法 1. 使用根轨迹法
磁盘读写系统 PID 控制：使用根轨迹法
根轨迹的定义
根轨迹是系统特征方程的根在 s 平面上随系统参数变化的路径。
反馈控制系统的性能可通过特征方程根在 s 平面上的位置进行描述。根轨迹图可以刻画特
征方程的根如何随着某个系统参数变化而变化。根轨迹图是设计和分析反馈控制系统的有
力工具。
PID 控制器是非常受欢迎的控制结构，因为其实现方面，设计简单，仅仅三个可调参数。
下面通过磁盘驱动控制系统介绍基于根轨迹的 PID 控制器设计。
控制系统综合 自动控制原理 2023-2024 学年春 33 / 59

## 第 34 页

6. 磁盘读写系统 PID 控制-使用根轨迹法 1. 使用根轨迹法
磁盘读写系统 PID 控制：使用根轨迹法
上一节介绍了引入速度反馈的控制结构，现在在同样的控制对象下，使用 PID 控制，以使
系统响应达到期望的性能。
PID 控制器的传递函数可以表示为如下：
Gc(s) = KP + KI
s + KDs.
因为控制对象中已经包含了积分项，我们令 KI = 0。于是有了如下 PD 控制器：
Gc(s) = KP + KDs.
我们的目标是选择合适的 KP 和 KD 使得系统满足性能指标。系统如图9-18所示，其闭环
传递函数为
Y(s)
R(s) = T(s) = Gc(s)G1(s)G2(s)
1 + Gc(s)G1(s)G2(s)H(s) ,
其中 H(s) = 1 。
控制系统综合 自动控制原理 2023-2024 学年春 34 / 59

## 第 35 页

6. 磁盘读写系统 PID 控制-使用根轨迹法 1. 使用根轨迹法
磁盘读写系统 PID 控制：使用根轨迹法
R(s)
KP + KDs
PD 控制器
5000
s+1000
电机线圈
Td(s)
− 1
s(s+20)
负载
Y(s)−
图 9-18: 速度反馈开关闭合的等效系统
为了得到根轨迹的参数方程，将 Gc(s)G1(s)G2(s)H(s) 写为
GcG1G2H = 5000(KP + KDs)
s(s + 20)(s + 1000) = 5000KD(s + z)
s(s + 20)(s + 1000) ,
其中 z = KP/KD。
控制系统综合 自动控制原理 2023-2024 学年春 35 / 59

## 第 36 页

6. 磁盘读写系统 PID 控制-使用根轨迹法 1. 使用根轨迹法
磁盘读写系统 PID 控制：使用根轨迹法
使用 KP 的值选择零点 z 的位置，令 KP = KD，绘制以 KD 为参数的函数轨迹。
GcG1G2H = 5000KD(s + 1)
s(s + 20)(s + 1000) . (9-11)
下面简要介绍根轨迹及其绘制方法。对于如图9-6的系统，其特征方程为
∆(s) = 1 + KG = 1 + K p(s)
q(s) = 0,
其中 K 是要考察的参数，其变化范围 0 < K < ∞。注意
一般情况下 K 为系统增益，此时的根轨迹为典型的根轨迹；
当 K 为其他参数时，根轨迹称为广义根轨迹。
控制系统综合 自动控制原理 2023-2024 学年春 36 / 59

## 第 37 页

6. 磁盘读写系统 PID 控制-使用根轨迹法 2. 绘制根轨迹
磁盘读写系统 PID 控制：绘制根轨迹
式9-11系统的根轨迹可由下面代码得到：
p=[-1]; q=[0 -20 -1000]; sys=zpk(p,q,5000); rlocus(sys)
−1200 −1000 −800 −600 −400 −200 0 200−300
−200
−100
0
100
200
300
Root Locus
Real Axis (seconds−1)
Imaginary Axis (seconds−1)
图 9-19: 9-11系统的根轨迹
控制系统综合 自动控制原理 2023-2024 学年春 37 / 59

## 第 38 页

6. 磁盘读写系统 PID 控制-使用根轨迹法 2. 绘制根轨迹
磁盘读写系统 PID 控制：绘制根轨迹
当使用没有返回值的 rlocus 函数时，Matlab 给出根轨迹图，当使用下面的代码时
p=[-1]; q=[0 -20 -1000]; sys=zpk(p,q,5000); [r,K]=rlocus(sys)
rlocus 函数将返回特征方程根与其对应的增益。使用函数 rlocfind(sys) 在根轨迹图上选择
极点。当输入命令后，会出现十字选择线，这时需要在已有的根轨迹图上选择极点位置，
选择后的极点以十字标出，并且系统会返回该点的增益。
控制系统综合 自动控制原理 2023-2024 学年春 38 / 59

## 第 39 页

6. 磁盘读写系统 PID 控制-使用根轨迹法 2. 绘制根轨迹
磁盘读写系统 PID 控制-使用根轨迹法
p=[-1]; q=[0 -20 -1000]; sys=zpk(p,q,5000);
rlocus(sys); rlocfind(sys)
−1200 −1000 −800 −600 −400 −200 0 200−800
−600
−400
−200
0
200
400
600
800
Root Locus
Real Axis (seconds−1)
Imaginary Axis (seconds−1)
图 9-20: 在根轨迹上选择极点
控制系统综合 自动控制原理 2023-2024 学年春 39 / 59

## 第 40 页

6. 磁盘读写系统 PID 控制-使用根轨迹法 3. 系统仿真
磁盘读写系统 PID 控制：系统仿真
系统输出为
Select a point in the graphics window
selected_point =
-5.0829e+02 + 5.0435e+02i
ans =
98.9914
选择 KD = 100，并使用下面代码绘制系统单位阶跃响应和单位阶跃扰动响应：
s = tf('s'); Kd = 100; Kp = Kd; Gc = Kp+Kd*s;
G1 = 5000/(s+1000); G2 = 1/(s*(s+20));
sysr = feedback(Gc*G1*G2,1);
step(sysr,5); sysn = feedback(G2,Gc*G1); sysn = -sysn;
figure
step(sysn);
控制系统综合 自动控制原理 2023-2024 学年春 40 / 59

## 第 41 页

6. 磁盘读写系统 PID 控制-使用根轨迹法 3. 系统仿真
磁盘读写系统 PID 控制：系统仿真
0 1 2 3 4 50
0.2
0.4
0.6
0.8
1
1.2
1.4y(t)
Time (s)
(a) 前 5 秒
0 0.005 0.01 0.015 0.02 0.0250
0.2
0.4
0.6
0.8
1
1.2
1.4y(t)
Time (s) (b) 前 120 个数据点
图 9-21: 输入阶跃响应
控制系统综合 自动控制原理 2023-2024 学年春 41 / 59

## 第 42 页

6. 磁盘读写系统 PID 控制-使用根轨迹法 3. 系统仿真
磁盘读写系统 PID 控制：系统仿真
0 2 4 6 8 10−2
−1.5
−1
−0.5
0 x 10
−3
y(t)
Time (s)
图 9-22: 扰动阶跃响应
控制系统综合 自动控制原理 2023-2024 学年春 42 / 59

## 第 43 页

6. 磁盘读写系统 PID 控制-使用根轨迹法 3. 系统仿真
磁盘读写系统 PID 控制：系统仿真
表 5: 磁盘驱动系统性能指标对比
性能指标 期望值 实际值
超调量 小于 5% 0%
调节时间 小于 250ms 20ms
对扰动的最大响应 小于 5E-3 2E-3
系统现在满足了所有的性能指标。系统需要近 20ms 时间“基本上”达到终值。但是实际中，
系统首先快速达到终值的 97%，然后缓慢的飘移到终值。
控制系统综合 自动控制原理 2023-2024 学年春 43 / 59

## 第 44 页

7. 磁盘读写系统模糊控制 1. 概念
磁盘读写系统模糊控制：概念
模糊控制
一种智能化的控制。它是利用模糊集理论、模糊逻辑和模糊推理方法把人的直觉、经验形
式化、模型化，由计算机来实现有效控制。
人类经验：模糊
计算机指令：精确
}
二者如何沟通？
检测信号
模糊控制器
控制信号模
糊
化
模糊规则
人的经验
解
模
糊
控制系统综合 自动控制原理 2023-2024 学年春 44 / 59

## 第 45 页

7. 磁盘读写系统模糊控制 1. 概念
磁盘读写系统模糊控制：概念
模糊控制
一种智能化的控制。它是利用模糊集理论、模糊逻辑和模糊推理方法把人的直觉、经验形
式化、模型化，由计算机来实现有效控制。
人类经验：模糊
计算机指令：精确
}
二者如何沟通？
检测信号
模糊控制器
控制信号模
糊
化
模糊规则
人的经验
解
模
糊
控制系统综合 自动控制原理 2023-2024 学年春 44 / 59

## 第 46 页

7. 磁盘读写系统模糊控制 2. 建模
磁盘读写系统模糊控制：建模
考虑上一节速度反馈开关闭和的等效系统，并将 PD 控制器替换为模糊控制器：
R(s)
模糊控制器 5000
s+1000
电机线圈
Td(s)
− 1
s(s+20)
负载
Y(s)−
图 9-23: 模糊控制的磁盘读写系统
控制系统综合 自动控制原理 2023-2024 学年春 45 / 59

## 第 47 页

7. 磁盘读写系统模糊控制 2. 建模
磁盘读写系统模糊控制：建模
首先确定误差信号的范围，考虑到超调，定义 E ∈ [−0.5, 1] 再考虑误差变化率的范围。上
一节中 PD 控制器与控制对象构成的开环传递函数为：
500000s + 500000
s3 + 1020s2 + 20000s
在 Simulink 中建立如下框图：
图 9-24: PD 控制器的 Simulink 框图
控制系统综合 自动控制原理 2023-2024 学年春 46 / 59

## 第 48 页

7. 磁盘读写系统模糊控制 2. 建模
磁盘读写系统模糊控制：建模
运行模型，并且绘制工作空间中变量 DE 的曲线
0 0.005 0.01 0.015 0.02 0.025−400
−300
−200
−100
0
100
∆ E
Time (s)
图 9-25: ∆E 的变化曲线
控制系统综合 自动控制原理 2023-2024 学年春 47 / 59

## 第 49 页

7. 磁盘读写系统模糊控制 3. 控制器设计
磁盘读写系统模糊控制：控制器设计
根据输出曲线的上下限，定义
∆E ∈ [−350, 50]
类似的，可以定义控制量的变化范围
U ∈ [−10, 100]
事实上，实际中对于 U 的定义往往根据控制器和执行器的具体情况进行调整，这里为了和
上一节的 PD 控制器进行对比，将输出范围定为相同的。
控制系统综合 自动控制原理 2023-2024 学年春 48 / 59

## 第 50 页

7. 磁盘读写系统模糊控制 3. 控制器设计
磁盘读写系统模糊控制：控制器设计
确定误差输入的几个模糊语言值
E : Z, S, M, B
分别表示零，小，中，大这几个模糊变量。
DeltaE : NB, NS, Z, P
分别表示负大，负小，零和正。
U : Z, S, M, B
分别表示零，小，中，大。
控制系统综合 自动控制原理 2023-2024 学年春 49 / 59

## 第 51 页

7. 磁盘读写系统模糊控制 3. 控制器设计
磁盘读写系统模糊控制：控制器设计
打开 Matlab 模糊控制工具箱 Fuzzy Control Toolbox，将出现模糊控制器编辑界面，选择
Edit→Add Variable→Input，增加一个输入变量，对默认变量名进行修改，得到如下界面：
图 9-26: 模糊控制编辑器界面
控制系统综合 自动控制原理 2023-2024 学年春 50 / 59

## 第 52 页

7. 磁盘读写系统模糊控制 3. 控制器设计
磁盘读写系统模糊控制：控制器设计
双击各个变量，对其成员函数（隶属度函数）进行编辑：
图 9-27: 输入误差 E 成员函数编辑界面
控制系统综合 自动控制原理 2023-2024 学年春 51 / 59

## 第 53 页

7. 磁盘读写系统模糊控制 3. 控制器设计
磁盘读写系统模糊控制：控制器设计
图 9-28: 输入误差变化率 DeltaE 成员函数编辑界面
控制系统综合 自动控制原理 2023-2024 学年春 52 / 59

## 第 54 页

7. 磁盘读写系统模糊控制 3. 控制器设计
磁盘读写系统模糊控制：控制器设计
图 9-29: 控制量 U 成员函数编辑界面
控制系统综合 自动控制原理 2023-2024 学年春 53 / 59

## 第 55 页

7. 磁盘读写系统模糊控制 3. 控制器设计
磁盘读写系统模糊控制：控制器设计
图 9-30: 模糊控制规则编辑界面
控制系统综合 自动控制原理 2023-2024 学年春 54 / 59

## 第 56 页

7. 磁盘读写系统模糊控制 3. 控制器设计
磁盘读写系统模糊控制：控制器设计
共有 10 条规则（也可以绘制为规则表供查询） ：
1 If (E is B) then (U is B)
2 If (E is M) and (DeltaE is NB) then
(U is B)
3 If (E is M) and (DeltaE is NS) then
(U is S)
4 If (E is M) and (DeltaE is Z) then
(U is M)
5 If (E is M) and (DeltaE is P) then
(U is B)
6 If (E is S) and (DeltaE is NB) then
(U is S)
7 If (E is S) and (DeltaE is NS) then
(U is Z)
8 If (E is S) and (DeltaE is Z) then
(U is Z)
9 If (E is S) and (DeltaE is P) then
(U is Z)
10 If (E is Z) then
(U is Z)
控制系统综合 自动控制原理 2023-2024 学年春 55 / 59

## 第 57 页

7. 磁盘读写系统模糊控制 3. 控制器设计
磁盘读写系统模糊控制：控制器设计
共有 10 条规则（也可以绘制为规则表供查询） ：
1 If (E is B) then (U is B)
2 If (E is M) and (DeltaE is NB) then
(U is B)
3 If (E is M) and (DeltaE is NS) then
(U is S)
4 If (E is M) and (DeltaE is Z) then
(U is M)
5 If (E is M) and (DeltaE is P) then
(U is B)
6 If (E is S) and (DeltaE is NB) then
(U is S)
7 If (E is S) and (DeltaE is NS) then
(U is Z)
8 If (E is S) and (DeltaE is Z) then
(U is Z)
9 If (E is S) and (DeltaE is P) then
(U is Z)
10 If (E is Z) then
(U is Z)
控制系统综合 自动控制原理 2023-2024 学年春 55 / 59

## 第 58 页

7. 磁盘读写系统模糊控制 3. 控制器设计
磁盘读写系统模糊控制：控制器设计
共有 10 条规则（也可以绘制为规则表供查询） ：
1 If (E is B) then (U is B)
2 If (E is M) and (DeltaE is NB) then (U is B)
3 If (E is M) and (DeltaE is NS) then
(U is S)
4 If (E is M) and (DeltaE is Z) then
(U is M)
5 If (E is M) and (DeltaE is P) then
(U is B)
6 If (E is S) and (DeltaE is NB) then
(U is S)
7 If (E is S) and (DeltaE is NS) then
(U is Z)
8 If (E is S) and (DeltaE is Z) then
(U is Z)
9 If (E is S) and (DeltaE is P) then
(U is Z)
10 If (E is Z) then
(U is Z)
控制系统综合 自动控制原理 2023-2024 学年春 55 / 59

## 第 59 页

7. 磁盘读写系统模糊控制 3. 控制器设计
磁盘读写系统模糊控制：控制器设计
共有 10 条规则（也可以绘制为规则表供查询） ：
1 If (E is B) then (U is B)
2 If (E is M) and (DeltaE is NB) then (U is B)
3 If (E is M) and (DeltaE is NS) then
(U is S)
4 If (E is M) and (DeltaE is Z) then
(U is M)
5 If (E is M) and (DeltaE is P) then
(U is B)
6 If (E is S) and (DeltaE is NB) then
(U is S)
7 If (E is S) and (DeltaE is NS) then
(U is Z)
8 If (E is S) and (DeltaE is Z) then
(U is Z)
9 If (E is S) and (DeltaE is P) then
(U is Z)
10 If (E is Z) then
(U is Z)
控制系统综合 自动控制原理 2023-2024 学年春 55 / 59

## 第 60 页

7. 磁盘读写系统模糊控制 3. 控制器设计
磁盘读写系统模糊控制：控制器设计
共有 10 条规则（也可以绘制为规则表供查询） ：
1 If (E is B) then (U is B)
2 If (E is M) and (DeltaE is NB) then (U is B)
3 If (E is M) and (DeltaE is NS) then (U is S)
4 If (E is M) and (DeltaE is Z) then
(U is M)
5 If (E is M) and (DeltaE is P) then
(U is B)
6 If (E is S) and (DeltaE is NB) then
(U is S)
7 If (E is S) and (DeltaE is NS) then
(U is Z)
8 If (E is S) and (DeltaE is Z) then
(U is Z)
9 If (E is S) and (DeltaE is P) then
(U is Z)
10 If (E is Z) then
(U is Z)
控制系统综合 自动控制原理 2023-2024 学年春 55 / 59

## 第 61 页

7. 磁盘读写系统模糊控制 3. 控制器设计
磁盘读写系统模糊控制：控制器设计
共有 10 条规则（也可以绘制为规则表供查询） ：
1 If (E is B) then (U is B)
2 If (E is M) and (DeltaE is NB) then (U is B)
3 If (E is M) and (DeltaE is NS) then (U is S)
4 If (E is M) and (DeltaE is Z) then
(U is M)
5 If (E is M) and (DeltaE is P) then
(U is B)
6 If (E is S) and (DeltaE is NB) then
(U is S)
7 If (E is S) and (DeltaE is NS) then
(U is Z)
8 If (E is S) and (DeltaE is Z) then
(U is Z)
9 If (E is S) and (DeltaE is P) then
(U is Z)
10 If (E is Z) then
(U is Z)
控制系统综合 自动控制原理 2023-2024 学年春 55 / 59

## 第 62 页

7. 磁盘读写系统模糊控制 3. 控制器设计
磁盘读写系统模糊控制：控制器设计
共有 10 条规则（也可以绘制为规则表供查询） ：
1 If (E is B) then (U is B)
2 If (E is M) and (DeltaE is NB) then (U is B)
3 If (E is M) and (DeltaE is NS) then (U is S)
4 If (E is M) and (DeltaE is Z) then (U is M)
5 If (E is M) and (DeltaE is P) then
(U is B)
6 If (E is S) and (DeltaE is NB) then
(U is S)
7 If (E is S) and (DeltaE is NS) then
(U is Z)
8 If (E is S) and (DeltaE is Z) then
(U is Z)
9 If (E is S) and (DeltaE is P) then
(U is Z)
10 If (E is Z) then
(U is Z)
控制系统综合 自动控制原理 2023-2024 学年春 55 / 59

## 第 63 页

7. 磁盘读写系统模糊控制 3. 控制器设计
磁盘读写系统模糊控制：控制器设计
共有 10 条规则（也可以绘制为规则表供查询） ：
1 If (E is B) then (U is B)
2 If (E is M) and (DeltaE is NB) then (U is B)
3 If (E is M) and (DeltaE is NS) then (U is S)
4 If (E is M) and (DeltaE is Z) then (U is M)
5 If (E is M) and (DeltaE is P) then
(U is B)
6 If (E is S) and (DeltaE is NB) then
(U is S)
7 If (E is S) and (DeltaE is NS) then
(U is Z)
8 If (E is S) and (DeltaE is Z) then
(U is Z)
9 If (E is S) and (DeltaE is P) then
(U is Z)
10 If (E is Z) then
(U is Z)
控制系统综合 自动控制原理 2023-2024 学年春 55 / 59

## 第 64 页

7. 磁盘读写系统模糊控制 3. 控制器设计
磁盘读写系统模糊控制：控制器设计
共有 10 条规则（也可以绘制为规则表供查询） ：
1 If (E is B) then (U is B)
2 If (E is M) and (DeltaE is NB) then (U is B)
3 If (E is M) and (DeltaE is NS) then (U is S)
4 If (E is M) and (DeltaE is Z) then (U is M)
5 If (E is M) and (DeltaE is P) then (U is B)
6 If (E is S) and (DeltaE is NB) then
(U is S)
7 If (E is S) and (DeltaE is NS) then
(U is Z)
8 If (E is S) and (DeltaE is Z) then
(U is Z)
9 If (E is S) and (DeltaE is P) then
(U is Z)
10 If (E is Z) then
(U is Z)
控制系统综合 自动控制原理 2023-2024 学年春 55 / 59

## 第 65 页

7. 磁盘读写系统模糊控制 3. 控制器设计
磁盘读写系统模糊控制：控制器设计
共有 10 条规则（也可以绘制为规则表供查询） ：
1 If (E is B) then (U is B)
2 If (E is M) and (DeltaE is NB) then (U is B)
3 If (E is M) and (DeltaE is NS) then (U is S)
4 If (E is M) and (DeltaE is Z) then (U is M)
5 If (E is M) and (DeltaE is P) then (U is B)
6 If (E is S) and (DeltaE is NB) then
(U is S)
7 If (E is S) and (DeltaE is NS) then
(U is Z)
8 If (E is S) and (DeltaE is Z) then
(U is Z)
9 If (E is S) and (DeltaE is P) then
(U is Z)
10 If (E is Z) then
(U is Z)
控制系统综合 自动控制原理 2023-2024 学年春 55 / 59

## 第 66 页

7. 磁盘读写系统模糊控制 3. 控制器设计
磁盘读写系统模糊控制：控制器设计
共有 10 条规则（也可以绘制为规则表供查询） ：
1 If (E is B) then (U is B)
2 If (E is M) and (DeltaE is NB) then (U is B)
3 If (E is M) and (DeltaE is NS) then (U is S)
4 If (E is M) and (DeltaE is Z) then (U is M)
5 If (E is M) and (DeltaE is P) then (U is B)
6 If (E is S) and (DeltaE is NB) then (U is S)
7 If (E is S) and (DeltaE is NS) then
(U is Z)
8 If (E is S) and (DeltaE is Z) then
(U is Z)
9 If (E is S) and (DeltaE is P) then
(U is Z)
10 If (E is Z) then
(U is Z)
控制系统综合 自动控制原理 2023-2024 学年春 55 / 59

## 第 67 页

7. 磁盘读写系统模糊控制 3. 控制器设计
磁盘读写系统模糊控制：控制器设计
共有 10 条规则（也可以绘制为规则表供查询） ：
1 If (E is B) then (U is B)
2 If (E is M) and (DeltaE is NB) then (U is B)
3 If (E is M) and (DeltaE is NS) then (U is S)
4 If (E is M) and (DeltaE is Z) then (U is M)
5 If (E is M) and (DeltaE is P) then (U is B)
6 If (E is S) and (DeltaE is NB) then (U is S)
7 If (E is S) and (DeltaE is NS) then
(U is Z)
8 If (E is S) and (DeltaE is Z) then
(U is Z)
9 If (E is S) and (DeltaE is P) then
(U is Z)
10 If (E is Z) then
(U is Z)
控制系统综合 自动控制原理 2023-2024 学年春 55 / 59

## 第 68 页

7. 磁盘读写系统模糊控制 3. 控制器设计
磁盘读写系统模糊控制：控制器设计
共有 10 条规则（也可以绘制为规则表供查询） ：
1 If (E is B) then (U is B)
2 If (E is M) and (DeltaE is NB) then (U is B)
3 If (E is M) and (DeltaE is NS) then (U is S)
4 If (E is M) and (DeltaE is Z) then (U is M)
5 If (E is M) and (DeltaE is P) then (U is B)
6 If (E is S) and (DeltaE is NB) then (U is S)
7 If (E is S) and (DeltaE is NS) then (U is Z)
8 If (E is S) and (DeltaE is Z) then
(U is Z)
9 If (E is S) and (DeltaE is P) then
(U is Z)
10 If (E is Z) then
(U is Z)
控制系统综合 自动控制原理 2023-2024 学年春 55 / 59

## 第 69 页

7. 磁盘读写系统模糊控制 3. 控制器设计
磁盘读写系统模糊控制：控制器设计
共有 10 条规则（也可以绘制为规则表供查询） ：
1 If (E is B) then (U is B)
2 If (E is M) and (DeltaE is NB) then (U is B)
3 If (E is M) and (DeltaE is NS) then (U is S)
4 If (E is M) and (DeltaE is Z) then (U is M)
5 If (E is M) and (DeltaE is P) then (U is B)
6 If (E is S) and (DeltaE is NB) then (U is S)
7 If (E is S) and (DeltaE is NS) then (U is Z)
8 If (E is S) and (DeltaE is Z) then
(U is Z)
9 If (E is S) and (DeltaE is P) then
(U is Z)
10 If (E is Z) then
(U is Z)
控制系统综合 自动控制原理 2023-2024 学年春 55 / 59

## 第 70 页

7. 磁盘读写系统模糊控制 3. 控制器设计
磁盘读写系统模糊控制：控制器设计
共有 10 条规则（也可以绘制为规则表供查询） ：
1 If (E is B) then (U is B)
2 If (E is M) and (DeltaE is NB) then (U is B)
3 If (E is M) and (DeltaE is NS) then (U is S)
4 If (E is M) and (DeltaE is Z) then (U is M)
5 If (E is M) and (DeltaE is P) then (U is B)
6 If (E is S) and (DeltaE is NB) then (U is S)
7 If (E is S) and (DeltaE is NS) then (U is Z)
8 If (E is S) and (DeltaE is Z) then (U is Z)
9 If (E is S) and (DeltaE is P) then
(U is Z)
10 If (E is Z) then
(U is Z)
控制系统综合 自动控制原理 2023-2024 学年春 55 / 59

## 第 71 页

7. 磁盘读写系统模糊控制 3. 控制器设计
磁盘读写系统模糊控制：控制器设计
共有 10 条规则（也可以绘制为规则表供查询） ：
1 If (E is B) then (U is B)
2 If (E is M) and (DeltaE is NB) then (U is B)
3 If (E is M) and (DeltaE is NS) then (U is S)
4 If (E is M) and (DeltaE is Z) then (U is M)
5 If (E is M) and (DeltaE is P) then (U is B)
6 If (E is S) and (DeltaE is NB) then (U is S)
7 If (E is S) and (DeltaE is NS) then (U is Z)
8 If (E is S) and (DeltaE is Z) then (U is Z)
9 If (E is S) and (DeltaE is P) then
(U is Z)
10 If (E is Z) then
(U is Z)
控制系统综合 自动控制原理 2023-2024 学年春 55 / 59

## 第 72 页

7. 磁盘读写系统模糊控制 3. 控制器设计
磁盘读写系统模糊控制：控制器设计
共有 10 条规则（也可以绘制为规则表供查询） ：
1 If (E is B) then (U is B)
2 If (E is M) and (DeltaE is NB) then (U is B)
3 If (E is M) and (DeltaE is NS) then (U is S)
4 If (E is M) and (DeltaE is Z) then (U is M)
5 If (E is M) and (DeltaE is P) then (U is B)
6 If (E is S) and (DeltaE is NB) then (U is S)
7 If (E is S) and (DeltaE is NS) then (U is Z)
8 If (E is S) and (DeltaE is Z) then (U is Z)
9 If (E is S) and (DeltaE is P) then (U is Z)
10 If (E is Z) then
(U is Z)
控制系统综合 自动控制原理 2023-2024 学年春 55 / 59

## 第 73 页

7. 磁盘读写系统模糊控制 3. 控制器设计
磁盘读写系统模糊控制：控制器设计
共有 10 条规则（也可以绘制为规则表供查询） ：
1 If (E is B) then (U is B)
2 If (E is M) and (DeltaE is NB) then (U is B)
3 If (E is M) and (DeltaE is NS) then (U is S)
4 If (E is M) and (DeltaE is Z) then (U is M)
5 If (E is M) and (DeltaE is P) then (U is B)
6 If (E is S) and (DeltaE is NB) then (U is S)
7 If (E is S) and (DeltaE is NS) then (U is Z)
8 If (E is S) and (DeltaE is Z) then (U is Z)
9 If (E is S) and (DeltaE is P) then (U is Z)
10 If (E is Z) then
(U is Z)
控制系统综合 自动控制原理 2023-2024 学年春 55 / 59

## 第 74 页

7. 磁盘读写系统模糊控制 3. 控制器设计
磁盘读写系统模糊控制：控制器设计
共有 10 条规则（也可以绘制为规则表供查询） ：
1 If (E is B) then (U is B)
2 If (E is M) and (DeltaE is NB) then (U is B)
3 If (E is M) and (DeltaE is NS) then (U is S)
4 If (E is M) and (DeltaE is Z) then (U is M)
5 If (E is M) and (DeltaE is P) then (U is B)
6 If (E is S) and (DeltaE is NB) then (U is S)
7 If (E is S) and (DeltaE is NS) then (U is Z)
8 If (E is S) and (DeltaE is Z) then (U is Z)
9 If (E is S) and (DeltaE is P) then (U is Z)
10 If (E is Z) then (U is Z)
控制系统综合 自动控制原理 2023-2024 学年春 55 / 59

## 第 75 页

7. 磁盘读写系统模糊控制 3. 控制器设计
磁盘读写系统模糊控制：控制器设计
绘制出控制规则的表面图如下
图 9-31: 控制规则的表面图
控制系统综合 自动控制原理 2023-2024 学年春 56 / 59

## 第 76 页

7. 磁盘读写系统模糊控制 4. 系统仿真
磁盘读写系统模糊控制：系统仿真
在模糊控制器编辑界面中选择 File→Export→To Workspace，并且指定到处的控制其名称。
在 Simulink 中组成仿真框图，双击模糊控制器，在 FIS Matrix 一栏填入刚才导出的控制
器名称。
图 9-32: 磁盘读写系统模糊控制仿真框图
控制系统综合 自动控制原理 2023-2024 学年春 57 / 59

## 第 77 页

7. 磁盘读写系统模糊控制 4. 系统仿真
磁盘读写系统模糊控制：系统仿真
运行仿真，系统响应如下图：
0 0.005 0.01 0.015 0.02 0.0250
0.2
0.4
0.6
0.8
1
U
Time (s)
图 9-33: 模糊控制的磁盘读写系统阶跃响应
控制系统综合 自动控制原理 2023-2024 学年春 58 / 59

## 第 78 页

7. 磁盘读写系统模糊控制 4. 系统仿真
磁盘读写系统模糊控制：系统仿真
控制信号如下图：
0 0.005 0.01 0.015 0.02 0.0250
20
40
60
80
100U
Time (s)
图 9-34: 模糊控制的磁盘读写系统控制信号
控制系统综合 自动控制原理 2023-2024 学年春 59 / 59
