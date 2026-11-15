export function createAudio(){
 let ctx=null;
 let master=null;
 let noiseBuf=null;
 function ensure(){
  if(ctx){
   if(ctx.state==='suspended')ctx.resume();
   return true;
  }
  try{
   ctx=new(window.AudioContext||window.webkitAudioContext)();
   master=ctx.createGain();
   master.gain.value=0.35;
   master.connect(ctx.destination);
   const len=Math.floor(ctx.sampleRate*0.5);
   noiseBuf=ctx.createBuffer(1,len,ctx.sampleRate);
   const data=noiseBuf.getChannelData(0);
   for(let i=0;i<len;i+=1)data[i]=Math.random()*2-1;
   return true;
  }catch{
   return false;
  }
 }
 function noise(dur,freq,gain,type='lowpass'){
  if(!ensure())return;
  const t=ctx.currentTime;
  const src=ctx.createBufferSource();
  src.buffer=noiseBuf;
  src.loop=true;
  const filter=ctx.createBiquadFilter();
  filter.type=type;
  filter.frequency.value=freq;
  const g=ctx.createGain();
  g.gain.setValueAtTime(gain,t);
  g.gain.exponentialRampToValueAtTime(0.001,t+dur);
  src.connect(filter).connect(g).connect(master);
  src.start(t);
  src.stop(t+dur+0.02);
 }
 function tone(freq,dur,gain,type='sine',slideTo=0,delay=0){
  if(!ensure())return;
  const t=ctx.currentTime+delay;
  const osc=ctx.createOscillator();
  osc.type=type;
  osc.frequency.setValueAtTime(freq,t);
  if(slideTo)osc.frequency.exponentialRampToValueAtTime(slideTo,t+dur);
  const g=ctx.createGain();
  g.gain.setValueAtTime(gain,t);
  g.gain.exponentialRampToValueAtTime(0.001,t+dur);
  osc.connect(g).connect(master);
  osc.start(t);
  osc.stop(t+dur+0.02);
 }
 return{
  unlock(){ensure();},shot(kind){
   if(kind==='pistol'){noise(0.09,2400,0.9,'bandpass');tone(160,0.08,0.5,'square',70);}
   else if(kind==='smg'){noise(0.07,3000,0.7,'bandpass');tone(190,0.06,0.4,'square',90);}
   else if(kind==='dmr'){noise(0.22,1400,1.0,'lowpass');tone(120,0.2,0.7,'square',45);}
   else{noise(0.12,2000,0.85,'bandpass');tone(150,0.1,0.55,'square',60);}
  },enemyShot(dist){
   const v=Math.max(0.08,0.6-dist*0.012);
   noise(0.09,1800,v,'bandpass');
  },dryClick(){tone(1200,0.04,0.25,'square');},pop(){noise(0.12,3200,0.8,'highpass');tone(900,0.1,0.35,'sine',300);},reload(){tone(500,0.05,0.3,'square');tone(700,0.05,0.3,'square',0,0.25);tone(900,0.06,0.3,'square',0,0.55);},hit(){tone(1400,0.06,0.35,'sine');},kill(){tone(880,0.09,0.4,'sine');tone(1320,0.14,0.4,'sine',0,0.09);},hurt(){noise(0.15,500,0.7,'lowpass');tone(90,0.15,0.5,'sine',50);},plantBeep(){tone(1100,0.08,0.3,'square');},defuseBeep(){tone(700,0.08,0.3,'square');},explosion(){noise(0.9,300,1.0,'lowpass');tone(70,0.8,0.8,'sine',30);},roundWin(){[523,659,784].forEach((f,i)=>tone(f,0.16,0.35,'triangle',0,i*0.12));},roundLose(){[392,330,262].forEach((f,i)=>tone(f,0.18,0.3,'triangle',0,i*0.13));},buy(){tone(660,0.07,0.3,'sine');tone(990,0.09,0.3,'sine',0,0.07);},};
}
