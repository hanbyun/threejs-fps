import*as THREE from'three';
export const WEAPONS={
 p9:{name:'P9',kind:'pistol',price:0,damage:34,headMult:2.0,mag:12,reserve:48,gap:0.17,auto:false,reload:1.4,spreadStill:0.006,spreadMove:0.03,kick:0.011,range:60},vex9:{name:'Vex-9',kind:'smg',price:1500,damage:26,headMult:2.0,mag:30,reserve:120,gap:0.085,auto:true,reload:1.8,spreadStill:0.012,spreadMove:0.038,kick:0.008,range:45},ar77:{name:'AR-77',kind:'rifle',price:2700,damage:38,headMult:2.5,mag:25,reserve:75,gap:0.11,auto:true,reload:2.2,spreadStill:0.004,spreadMove:0.026,kick:0.013,range:80},dm12:{name:'DM-12',kind:'dmr',price:4100,damage:78,headMult:2.5,mag:5,reserve:20,gap:0.55,auto:false,reload:2.8,spreadStill:0.001,spreadMove:0.02,kick:0.03,range:110},knife:{name:'Knife',kind:'knife',price:0,damage:45,headMult:1.8,mag:0,reserve:0,gap:0.45,auto:false,reload:0,spreadStill:0,spreadMove:0,kick:0.004,range:2.4},};
export const FRAG={name:'Frag',price:300,fuse:1.6,radius:6.5,damage:110};
export const FLASH={name:'Flash',price:200,fuse:1.4,radius:18,blind:2.2};
export const SMOKE={name:'Smoke',price:300,fuse:1.5,radius:3.5,linger:12};
export const ARMOR={name:'Plating',price:650,value:50};
const GRIP=new THREE.MeshStandardMaterial({color:new THREE.Color('#a5875a'),roughness:0.65,metalness:0.1});
const BODY=new THREE.MeshStandardMaterial({color:new THREE.Color('#8f8a7c'),roughness:0.4,metalness:0.45});
const SLIDE=new THREE.MeshStandardMaterial({color:new THREE.Color('#8f8a7c'),roughness:0.35,metalness:0.5});
const RIB=new THREE.MeshStandardMaterial({color:new THREE.Color('#b7b2a4'),roughness:0.3,metalness:0.5});
const FRAME=new THREE.MeshStandardMaterial({color:new THREE.Color('#b59a68'),roughness:0.55,metalness:0.15});
const BACKSTRAP=new THREE.MeshStandardMaterial({color:new THREE.Color('#6e5738'),roughness:0.6,metalness:0.1});
const SIGHT=new THREE.MeshStandardMaterial({color:new THREE.Color('#d5d1c4'),roughness:0.4,metalness:0.4});
const GUARD=new THREE.MeshStandardMaterial({color:new THREE.Color('#6f6a60'),roughness:0.5,metalness:0.4});
const BARREL=new THREE.MeshStandardMaterial({color:new THREE.Color('#57534a'),roughness:0.4,metalness:0.55});
const SERR=new THREE.MeshStandardMaterial({color:new THREE.Color('#453f36'),roughness:0.45,metalness:0.5});
const PORT=new THREE.MeshStandardMaterial({color:new THREE.Color('#2e2a24'),roughness:0.5,metalness:0.4});
const FIBER=new THREE.MeshBasicMaterial({color:new THREE.Color('#ffb13d')});
const ACCENT=new THREE.MeshStandardMaterial({color:new THREE.Color('#f0a830'),roughness:0.5,metalness:0.3});
const VM={x:0.20,y:-0.04,z:-0.44,scale:0.78};
function buildViewModel(kind){
 const model=new THREE.Group();
 const add=(w,h,d,x,y,z,mat,rx=0)=>{
  const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat||BODY);
  m.position.set(x,y,z);
  if(rx)m.rotation.x=rx;
  model.add(m);
  return m;
 };
 if(kind==='pistol'){
  add(0.05,0.045,0.26,0,0.012,-0.10,SLIDE);
  add(0.036,0.008,0.24,0,0.038,-0.10,RIB);
  add(0.054,0.038,0.006,0,0.012,0.005,SERR);
  add(0.054,0.038,0.006,0,0.012,0.016,SERR);
  add(0.054,0.038,0.006,0,0.012,0.027,SERR);
  add(0.006,0.018,0.055,0.025,0.02,-0.155,PORT);
  add(0.018,0.018,0.05,0,0.012,-0.245,BARREL);
  add(0.024,0.024,0.012,0,0.012,-0.268,BARREL);
  add(0.008,0.02,0.008,0,0.05,-0.205,SIGHT);
  add(0.011,0.011,0.011,0,0.062,-0.205,FIBER);
  add(0.009,0.016,0.009,-0.014,0.046,0.018,SIGHT);
  add(0.009,0.016,0.009,0.014,0.046,0.018,SIGHT);
  add(0.044,0.028,0.19,0,-0.026,-0.075,FRAME);
  add(0.008,0.032,0.007,0,-0.052,-0.135,GUARD);
  add(0.008,0.007,0.055,0,-0.066,-0.108,GUARD);
  add(0.007,0.022,0.009,0,-0.048,-0.102,GUARD);
  add(0.042,0.115,0.056,0,-0.095,0.032,GRIP,-0.28);
  add(0.044,0.09,0.008,0,-0.09,0.062,BACKSTRAP,-0.28);
  add(0.05,0.014,0.062,0,-0.148,0.047,BACKSTRAP,-0.28);
 }else if(kind==='smg'){
  add(0.08,0.1,0.4,0,0,-0.12);
  add(0.05,0.05,0.3,0,0.02,-0.4,GRIP);
  add(0.06,0.16,0.06,0,-0.11,0.02,GRIP);
  add(0.07,0.06,0.12,0,-0.03,0.08,GRIP);
 }else if(kind==='dmr'){
  add(0.08,0.1,0.55,0,0,-0.18);
  add(0.04,0.04,0.42,0,0.03,-0.5,GRIP);
  add(0.07,0.07,0.16,0,0.09,-0.1,GRIP);
  add(0.06,0.14,0.06,0,-0.1,0.06,GRIP);
  add(0.07,0.08,0.2,0,-0.02,0.24,GRIP);
  add(0.02,0.02,0.06,0,0.06,-0.28,ACCENT);
 }else if(kind==='knife'){
  add(0.02,0.05,0.3,0,-0.02,-0.22,new THREE.MeshStandardMaterial({color:new THREE.Color('#b8bcc2'),roughness:0.25,metalness:0.85}));
  add(0.05,0.06,0.12,0,-0.04,-0.02,GRIP);
 }else{
  add(0.08,0.1,0.48,0,0,-0.14);
  add(0.05,0.05,0.34,0,0.02,-0.44,GRIP);
  add(0.06,0.15,0.06,0,-0.11,0.0,GRIP);
  add(0.07,0.07,0.2,0,-0.02,0.26,GRIP);
  add(0.03,0.05,0.03,0,0.07,-0.36,ACCENT);
 }
 model.scale.setScalar(VM.scale);
 model.position.set(VM.x,VM.y,VM.z);
 return model;
}
function starTexture(){
 const canvas=document.createElement('canvas');
 canvas.width=128;
 canvas.height=128;
 const ctx=canvas.getContext('2d');
 ctx.clearRect(0,0,128,128);
 ctx.translate(64,64);
 ctx.fillStyle='#ffcf6e';
 ctx.beginPath();
 for(let i=0;i<8;i+=1){
  const r=i%2===0?62:12;
  const a=(i/8)*Math.PI*2;
  ctx[i===0?'moveTo':'lineTo'](Math.cos(a)*r,Math.sin(a)*r);
 }
 ctx.closePath();
 ctx.fill();
 ctx.fillStyle='#fff3c4';
 ctx.beginPath();
 ctx.arc(0,0,16,0,Math.PI*2);
 ctx.fill();
 const t=new THREE.CanvasTexture(canvas);
 t.colorSpace=THREE.SRGBColorSpace;
 return t;
}
export function createWeaponSet(camera){
 let current='p9';
 const def=()=>WEAPONS[current];
 const model=buildViewModel('pistol');
 camera.add(model);
 const vmLight=new THREE.PointLight(new THREE.Color('#ffe2b8'),0.8,0,1.5);
 vmLight.position.set(0.15,0.05,-0.25);
 camera.add(vmLight);
 const flash=new THREE.Mesh(new THREE.PlaneGeometry(0.22,0.22),new THREE.MeshBasicMaterial({map:starTexture(),color:new THREE.Color('#ffb13d'),transparent:true,opacity:0.9,depthWrite:false,side:THREE.DoubleSide}),);
 flash.position.set(VM.x,VM.y+0.009,VM.z-0.209);
 flash.visible=false;
 camera.add(flash);
 const flashLight=new THREE.PointLight(new THREE.Color('#ffb13d'),0,6);
 flashLight.position.set(VM.x,VM.y+0.01,VM.z-0.11);
 camera.add(flashLight);
 const state={mag:12,reserve:48,cooldown:0,reloadLeft:0,flash:0,kick:0};
 let bobPhase=0;
 let breathePhase=0;
 let swayX=0;
 let swayY=0;
 let drawT=0.4;
 function step(dt,lookX=0,speed=0){
  state.cooldown=Math.max(0,state.cooldown-dt);
  state.flash=Math.max(0,state.flash-dt);
  state.kick+=(0-state.kick)*Math.min(1,dt*12);
  drawT=Math.max(0,drawT-dt);
  bobPhase+=dt*speed*1.9;
  breathePhase+=dt*1.9;
  const bobAmt=Math.min(1,speed/5.4);
  const breathe=1-bobAmt;
  const swayTarget=Math.max(-1,Math.min(1,lookX*0.02));
  swayX+=(swayTarget-swayX)*Math.min(1,dt*10);
  swayY+=(0-swayY)*Math.min(1,dt*10);
  let dip=0;
  if(state.reloadLeft>0){
   const d=def();
   state.reloadLeft=Math.max(0,state.reloadLeft-dt);
   dip=Math.sin((1-state.reloadLeft/d.reload)*Math.PI);
   if(state.reloadLeft===0){
    const need=d.mag-state.mag;
    const take=Math.min(need,state.reserve);
    state.mag+=take;
    state.reserve-=take;
   }
  }
  const draw=drawT/0.4;
  const idleX=Math.cos(breathePhase*0.83)*0.002*breathe;
  const idleY=Math.sin(breathePhase)*0.003*breathe;
  const idleRoll=Math.sin(breathePhase*0.5)*0.004*breathe;
  model.position.x=VM.x-swayX*0.035+Math.sin(bobPhase)*0.008*bobAmt+idleX-dip*0.02;
  model.position.y=VM.y+Math.abs(Math.sin(bobPhase))*0.012*bobAmt+swayY*0.02+idleY+state.kick*0.12-dip*0.085-draw*draw*0.14;
  model.position.z=VM.z+state.kick;
  model.rotation.x=state.kick*3.0+dip*0.5+draw*0.35;
  model.rotation.y=-swayX*0.10;
  model.rotation.z=-0.07-swayX*0.06+Math.sin(bobPhase)*0.012*bobAmt+idleRoll+dip*0.18+draw*0.1;
  flash.visible=state.flash>0;
  flash.rotation.z=state.flash*28;
  flashLight.intensity=state.flash>0?22:0;
 }
 return{
  state,step,current:()=>current,def,equip(id){
   if(!WEAPONS[id]||id===current)return false;
   current=id;
   model.clear();
   [...buildViewModel(def().kind).children].forEach((c)=>model.add(c));
   const d=def();
   state.mag=d.mag;
   state.reserve=d.reserve;
   state.cooldown=0;
   state.reloadLeft=0;
   drawT=0.4;
   return true;
  },ready(){
   return state.mag>0&&state.cooldown===0&&state.reloadLeft===0;
  },pullTrigger(){
   state.cooldown=def().gap;
   state.flash=0.06;
   state.kick=0.05+def().kick;
  },takeRound(){
   if(state.mag<=0)return false;
   state.mag-=1;
   return true;
  },reload(){
   const d=def();
   if(state.reloadLeft>0||state.mag===d.mag||state.reserve===0)return false;
   state.reloadLeft=d.reload;
   return true;
  },spread(speed){
   const d=def();
   return d.spreadStill+Math.min(1,speed/5.4)*d.spreadMove;
  },refill(){
   const d=def();
   state.mag=d.mag;
   state.reserve=d.reserve;
   state.cooldown=0;
   state.reloadLeft=0;
   state.flash=0;
   state.kick=0;
  },muzzlePos(out){
   out.set(VM.x,VM.y+0.009,VM.z-0.209);
   return camera.localToWorld(out);
  },};
}
