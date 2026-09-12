"""Original electronic score and Foley, synthesized for the 67.5-second action edit.

No downloaded music, samples, voices or external service. Reproducible stereo stems.
Requires numpy and scipy. The final master is loudness-normalized by finish.mjs.
"""
from pathlib import Path
import numpy as np
from scipy.signal import butter, sosfilt
from scipy.io.wavfile import write

SR = 48000
DURATION = 67.5
N = int(SR * DURATION)
rng = np.random.default_rng(90210)
music = np.zeros((N, 2), np.float64)
sfx = np.zeros((N, 2), np.float64)
out = Path(__file__).resolve().parents[1] / 'artifacts/cinematic-demo/extended'
out.mkdir(parents=True, exist_ok=True)

def clock(d): return np.arange(int(d * SR)) / SR
def hz(m): return 440 * 2 ** ((m - 69) / 12)
def filt(x, cutoff, kind='lowpass'):
    return sosfilt(butter(2, cutoff, kind, fs=SR, output='sos'), x)

def add(bus, signal, at, gain=1, pan=0):
    signal = np.asarray(signal)
    offset = int(at * SR)
    if offset < 0:
        signal, offset = signal[-offset:], 0
    length = min(len(signal), N - offset)
    if length <= 0: return
    if signal.ndim == 1:
        signal = np.column_stack((signal * np.sqrt((1-pan)/2), signal * np.sqrt((1+pan)/2)))
    bus[offset:offset+length] += signal[:length] * gain

def envelope(t, attack=.05, release=.5):
    return np.minimum(1, t / attack) * np.minimum(1, (t[-1] - t) / release)

def pad(notes, duration, at, gain=.07):
    t = clock(duration); channels=[]
    for channel in range(2):
        x = np.zeros(len(t))
        for i, note in enumerate(notes):
            f=hz(note) * (1 + (channel*2-1)*.0015)
            for harmonic in range(1, 6):
                x += np.sin(2*np.pi*f*harmonic*t+i*.7+channel*.4) / harmonic**1.7
        x *= envelope(t, 1.2, 1.7) * (.87+.13*np.sin(t*.7+channel))
        channels.append(x)
    add(music, np.column_stack(channels), at, gain)

def pluck(note, duration=.85):
    t=clock(duration);f=hz(note)
    return (np.sin(2*np.pi*f*t)+.28*np.sin(2*np.pi*f*2*t)+.09*np.sin(2*np.pi*f*3*t))*np.exp(-t*6)*np.minimum(t/.008,1)

def kick(at, gain=.25):
    t=clock(.7); f=43+92*np.exp(-t*31)
    x=np.sin(2*np.pi*np.cumsum(f)/SR)*np.exp(-t*9)
    x+=filt(rng.normal(size=len(t)),1800)*np.exp(-t*90)*.2
    add(music,x,at,gain)

def snare(at,gain=.14):
    t=clock(.5);n=filt(rng.normal(size=len(t)),[1200,7000],'bandpass')
    x=(n*np.exp(-t*15)+.28*np.sin(2*np.pi*184*t)*np.exp(-t*23))*np.minimum(1,t/.002)
    add(music,x,at,gain,.13)

def hat(at,gain=.025,pan=-.3):
    t=clock(.15);add(music,filt(rng.normal(size=len(t)),7500,'highpass')*np.exp(-t*45),at,gain,pan)

def boom(at,power=1,pan=0):
    t=clock(3.7)
    noise=filt(rng.normal(size=len(t)),[35,1800],'bandpass')
    sub=np.sin(2*np.pi*(38*t+1.5*(1-np.exp(-t*12))))*np.exp(-t*1.9)
    crack=filt(rng.normal(size=len(t)),[900,8500],'bandpass')*np.exp(-t*28)
    x=(noise*.75*np.exp(-t*2.8)+sub*.6+crack*.65)*np.minimum(1,t/.003)
    add(sfx,x,at,.44*power,pan)
    add(sfx,x,at+.135,.08*power,-pan)

def whoosh(at,duration=1.2,gain=.15,pan=0):
    t=clock(duration);n=filt(rng.normal(size=len(t)),[180,4600],'bandpass')
    env=np.sin(np.pi*t/duration)**2
    x=n*env + .13*np.sin(2*np.pi*(90*t+240*t*t/duration))*env
    # Counter-delayed stereo creates motion without large level differences.
    stereo=np.column_stack((x,np.roll(x,int(.013*SR))))
    add(sfx,stereo,at,gain)

def metal(at,gain=.12):
    t=clock(1.7);x=sum(np.sin(2*np.pi*f*t)*np.exp(-t*(3+i*.8)) for i,f in enumerate([117,283,471,733,1103]))
    add(sfx,x,at,gain)

def glass(at,gain=.075,pan=0):
    for i in range(17):
        t=clock(.12+rng.random()*.3);f=rng.uniform(1500,6700)
        x=(np.sin(2*np.pi*f*t)+.25*rng.normal(size=len(t)))*np.exp(-t*24)
        add(sfx,x,at+rng.random()*.55,gain*rng.uniform(.3,1),np.clip(pan+rng.uniform(-.5,.5),-1,1))

# 160 BPM action arrangement with breathing room around the staged impacts.
beat=.375
roots=[38,34,41,36,38,41,34,36]
for j,at in enumerate(np.arange(0,63,3)):
    root=roots[j%8];pad([root,root+12,root+19,root+24],3.8,float(at),.029)
for j,at in enumerate(np.arange(0,63.3,beat)):
    if j%4 in [0,2,3]:kick(float(at),.23)
    if j%2:snare(float(at),.17)
    for k in range(4):hat(float(at+k*beat/4),.018 if k%2==0 else .011,(-.35 if k%2 else .35))
for j,at in enumerate(np.arange(0,62.9,beat/2)):
    root=roots[int(at//3)%8];note=root+[0,0,7,0,3,0,10,7][j%8]
    tt=clock(.26);f=hz(note-12)
    x=np.tanh(1.6*(np.sin(2*np.pi*f*tt)+.27*np.sin(2*np.pi*f*2*tt)))
    add(music,x*np.minimum(tt/.008,1)*np.exp(-tt*10),float(at),.11)
    if j%2==0 or 25<at<36:
        x=pluck(note+24,.5);add(music,x,float(at),.038,(-.35 if j%4 else .35));add(music,x,float(at+beat*.75),.01)
# Low street-scale footfalls, armor creaks and directional jet passes.
for at in [.3,1.2,11.25,12.1]:boom(at,.35);metal(at,.025)
for at in [2,3.3,5.45,6.1,9,10.1,13.7,15.6,17.75,21.5,23.2,36.4,38.35,43,45.5,46.9,50.5,51.65,53,55.8,58.6,65]:whoosh(at,.55,.14)
for start,end in [(0,1.8),(4,5.5),(11,15.3),(15.6,17.65),(36,37.8),(55.5,57.8)]:
    for j,at in enumerate(np.arange(start,end,.14)):
        tt=clock(.1);x=np.sin(2*np.pi*(980*tt-3000*tt*tt))*np.exp(-tt*40)
        add(sfx,x,float(at),.055,(-.45 if j%2 else .45))
metal(13.75,.12)
# Localized chest impact; subsequent secondary clanks follow the tumble.
tt=clock(.8);x=(np.sin(2*np.pi*(52*tt+2*(1-np.exp(-tt*25))))*.65*np.exp(-tt*7)+filt(rng.normal(size=len(tt)),[230,8500],'bandpass')*np.exp(-tt*35))*np.minimum(tt/.0015,1)
add(sfx,x,18,.65);metal(18.025,.09)
for at in [18.4,19.15,20.2]:metal(at,.025)
boom(20.05,.32)
# Native masonry and frame collapses, each followed by separate rubble hits.
for at,power in [(6.1,1),(38.65,1.05),(47.3,1.05),(51.9,1.05),(59.05,.95)]:
    boom(at,power);metal(at+.06,.09);glass(at+.08,.055)
    for j in range(7):boom(at+.35+j*.27,.14);glass(at+.27+j*.32,.021)
for at in [7.4,8.2,40,40.7,41.4,42.2,48.4,49.1,53.2,54]:boom(at,.3)
# Eight individually timed homing missiles: launch, near pass, overshoot impact.
for i in range(8):whoosh(23.55+i*.13,.6,.1)
near=[2.8,3.6,4.5,5.4,6.3,7.2,8.1,9]
tt=clock(11);wind=filt(rng.normal(size=len(tt)),[150,4700],'bandpass')*.055
add(sfx,wind*envelope(tt,.15,.3),25)
for i,n in enumerate(near):
    at=25+n;tt=clock(.6);f=450-330*tt/.6
    x=(np.sin(2*np.pi*np.cumsum(f)/SR)*.14+filt(rng.normal(size=len(tt)),[600,6500],'bandpass')*.7)*np.sin(np.pi*tt/.6)**2
    add(sfx,x,at-.2,.2,(-.65 if i%2 else .65));boom(at+.9,.44,(i%3-1)*.45);glass(at+.94,.035)
# Reactor failure and the last survivor's flyby.
for i,b in enumerate([0,.24,.49,.73,.98,1.2,1.42,1.6,1.76,2.02,2.3,2.65,3.05,3.5,4.1]):
    boom(60.5+b,1.05 if i==7 else .2,(i%3-1)*.25)
for at in [61.6,61.85]:snare(at,.08)
whoosh(65,.7,.22);pad([38,50,57],3.5,64,.06)
time=np.arange(N)/SR;duck=np.ones(N)
for at in [6.1,18,38.65,47.3,51.9,59.05,62.1]:
    duck-=.68*np.exp(-np.maximum(0,time-at)*5)*(time>=at)
    duck*=np.where((time>at-.08)&(time<at),.25,1)
music*=np.clip(duck,.18,1)[:,None]
music*=np.where(time>63.5,np.exp(-(time-63.5)*.55),1)[:,None]
fade=np.minimum(1,time/.06)*np.clip((DURATION-time)/.5,0,1)
music*=fade[:,None];sfx*=fade[:,None]
mix=np.tanh((music+sfx)*.96)
for name,data in [('music',music),('sound-design',sfx),('soundtrack',mix)]:write(out/f'{name}.wav',SR,np.int16(np.clip(data,-.99,.99)*32767))
print(f'Extended score: {DURATION}s, stereo48k, synchronized to new stunt timeline.')
