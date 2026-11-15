import*as THREE from'three';
const TRACER_POOL=24;
const SPARK_POOL=16;
const DUST_POOL=12;
export function createEffects(scene){
 const tracers=[];
 for(let i=0;i<TRACER_POOL;i+=1){
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.BufferAttribute(new Float32Array(6),3));
  const mat=new THREE.LineBasicMaterial({color:0xffc266,transparent:true,opacity:0});
  const line=new THREE.Line(geo,mat);
  line.visible=false;
  line.frustumCulled=false;
  scene.add(line);
  tracers.push({line,life:0});
 }
 const sparks=[];
 const sparkGeo=new THREE.OctahedronGeometry(0.06);
 for(let i=0;i<SPARK_POOL;i+=1){
  const mat=new THREE.MeshBasicMaterial({color:0xffd27a,transparent:true,opacity:0});
  const mesh=new THREE.Mesh(sparkGeo,mat);
  mesh.visible=false;
  scene.add(mesh);
  sparks.push({mesh,life:0,vel:new THREE.Vector3()});
 }
 const boom=new THREE.Mesh(new THREE.SphereGeometry(1,20,14),new THREE.MeshBasicMaterial({color:0xff7a2a,transparent:true,opacity:0,depthWrite:false}),);
 boom.visible=false;
 scene.add(boom);
 const boomLight=new THREE.PointLight(0xff8a30,0,30);
 scene.add(boomLight);
 let boomLife=0;
 const dusts=[];
 const dustGeo=new THREE.SphereGeometry(0.32,10,8);
 for(let i=0;i<DUST_POOL;i+=1){
  const mat=new THREE.MeshBasicMaterial({color:0x8a7a68,transparent:true,opacity:0,depthWrite:false});
  const mesh=new THREE.Mesh(dustGeo,mat);
  mesh.visible=false;
  scene.add(mesh);
  dusts.push({mesh,life:0,max:1});
 }
 const muzzleLight=new THREE.PointLight(0xffb13d,0,9);
 scene.add(muzzleLight);
 let muzzleLife=0;
 const SHELL_POOL=10;
 const shells=[];
 const shellGeo=new THREE.BoxGeometry(0.03,0.03,0.07);
 const shellMat=new THREE.MeshStandardMaterial({color:new THREE.Color('#c9a227'),roughness:0.35,metalness:0.8});
 for(let i=0;i<SHELL_POOL;i+=1){
  const mesh=new THREE.Mesh(shellGeo,shellMat);
  mesh.visible=false;
  scene.add(mesh);
  shells.push({mesh,life:0,vel:new THREE.Vector3(),spin:0});
 }
 let shellIdx=0;
 const SMOKE_POOL=8;
 const smokes=[];
 const smokeGeo=new THREE.SphereGeometry(1,12,10);
 for(let i=0;i<SMOKE_POOL;i+=1){
  const mat=new THREE.MeshBasicMaterial({color:0xcfc8bd,transparent:true,opacity:0,depthWrite:false});
  const mesh=new THREE.Mesh(smokeGeo,mat);
  mesh.visible=false;
  scene.add(mesh);
  smokes.push({mesh,life:0,max:1});
 }
 let smokeIdx=0;
 const MOTE_COUNT=140;
 const moteBase=new Float32Array(MOTE_COUNT*3);
 const motePhase=new Float32Array(MOTE_COUNT);
 {
  const geo=new THREE.BufferGeometry();
  const pos=new Float32Array(MOTE_COUNT*3);
  for(let i=0;i<MOTE_COUNT;i+=1){
   moteBase[i*3]=(Math.random()*2-1)*30;
   moteBase[i*3+1]=0.3+Math.random()*4.6;
   moteBase[i*3+2]=(Math.random()*2-1)*20;
   motePhase[i]=Math.random()*Math.PI*2;
   pos.set([moteBase[i*3],moteBase[i*3+1],moteBase[i*3+2]],i*3);
  }
  geo.setAttribute('position',new THREE.BufferAttribute(pos,3));
  const mat=new THREE.PointsMaterial({
   color:0xffd9a0,size:0.09,transparent:true,opacity:0.45,depthWrite:false,sizeAttenuation:true,});
  const motes=new THREE.Points(geo,mat);
  motes.frustumCulled=false;
  scene.add(motes);
  var moteGeo=geo;
 }
 const EMBER_COUNT=60;
 const emberOrigin=new Float32Array(EMBER_COUNT*3);
 const emberSpeed=new Float32Array(EMBER_COUNT);
 const emberPhase=new Float32Array(EMBER_COUNT);
 const emberSpots=[[27.5,-16.5],[17.5,-12.5],[-29,-16.5],[9,16]];
 {
  const geo=new THREE.BufferGeometry();
  const pos=new Float32Array(EMBER_COUNT*3);
  for(let i=0;i<EMBER_COUNT;i+=1){
   const s=emberSpots[i%emberSpots.length];
   emberOrigin[i*3]=s[0]+(Math.random()-0.5)*1.6;
   emberOrigin[i*3+1]=0.2+Math.random()*0.6;
   emberOrigin[i*3+2]=s[1]+(Math.random()-0.5)*1.6;
   emberSpeed[i]=0.5+Math.random()*0.9;
   emberPhase[i]=Math.random()*Math.PI*2;
   pos.set([emberOrigin[i*3],emberOrigin[i*3+1],emberOrigin[i*3+2]],i*3);
  }
  geo.setAttribute('position',new THREE.BufferAttribute(pos,3));
  const mat=new THREE.PointsMaterial({
   color:0xff7a2a,size:0.12,transparent:true,opacity:0.8,depthWrite:false,sizeAttenuation:true,blending:THREE.AdditiveBlending,});
  const embers=new THREE.Points(geo,mat);
  embers.frustumCulled=false;
  scene.add(embers);
  var emberGeo=geo;
 }
 let ambientTime=0;
 function footstep(point){
  const d=dusts[dustIdx];
  dustIdx=(dustIdx+1)%DUST_POOL;
  d.mesh.position.set(point.x,0.12,point.z);
  d.mesh.scale.setScalar(0.32);
  d.mesh.material.color.setHex(0x9a8874);
  d.mesh.material.opacity=0.28;
  d.mesh.visible=true;
  d.base=0.32;d.grow=0.3;d.op0=0.28;
  d.max=0.4;
  d.life=0.4;
 }
 function muzzleSmoke(point){
  const d=dusts[dustIdx];
  dustIdx=(dustIdx+1)%DUST_POOL;
  d.mesh.position.copy(point);
  d.mesh.scale.setScalar(0.08);
  d.mesh.material.color.setHex(0xcfc8bd);
  d.mesh.material.opacity=0.15;
  d.mesh.visible=true;
  d.base=0.08;d.grow=0.12;d.op0=0.15;
  d.max=0.6;
  d.life=0.6;
 }
 const tmpDir=new THREE.Vector3();
 const tmpMid=new THREE.Vector3();
 let cam=null;
 scene.traverse((o)=>{if(o.isCamera)cam=o;});
 let tracerIdx=0;
 let sparkIdx=0;
 let dustIdx=0;
 function dust(point){
  for(let n=0;n<2;n+=1){
   const d=dusts[dustIdx];
   dustIdx=(dustIdx+1)%DUST_POOL;
   d.mesh.position.copy(point);
   d.mesh.position.x+=(Math.random()-0.5)*0.2;
   d.mesh.position.y+=Math.random()*0.15;
   d.mesh.position.z+=(Math.random()-0.5)*0.2;
   d.mesh.scale.setScalar(0.5);
   d.mesh.material.opacity=0.45;
   d.mesh.visible=true;
   d.base=0.5;d.grow=0.7;d.op0=0.45;
   d.max=0.55+Math.random()*0.25;
   d.life=d.max;
  }
 }
 function muzzleFlash(point){
  muzzleLight.position.copy(point);
  muzzleLight.intensity=26;
  muzzleLife=0.06;
 }
 function tracer(from,to,color=0xffc266){
  const t=tracers[tracerIdx];
  tracerIdx=(tracerIdx+1)%TRACER_POOL;
  tmpDir.subVectors(to,from);
  const len=tmpDir.length();
  if(len<0.1)return;
  const pos=t.line.geometry.attributes.position;
  pos.setXYZ(0,from.x,from.y,from.z);
  pos.setXYZ(1,to.x,to.y,to.z);
  pos.needsUpdate=true;
  t.line.material.color.setHex(color);
  t.line.material.opacity=0.75;
  t.line.visible=true;
  t.life=0.07;
 }
 function impact(point,color=0xffd27a){
  dust(point);
  for(let n=0;n<3;n+=1){
   const s=sparks[sparkIdx];
   sparkIdx=(sparkIdx+1)%SPARK_POOL;
   s.mesh.position.copy(point);
   s.vel.set((Math.random()-0.5)*4,Math.random()*3+1,(Math.random()-0.5)*4);
   s.mesh.material.color.setHex(color);
   s.mesh.material.opacity=1;
   s.mesh.visible=true;
   s.life=0.25+Math.random()*0.15;
  }
 }
 function explosion(point){
  boom.position.copy(point);
  boom.scale.setScalar(0.5);
  boom.material.opacity=0.85;
  boom.visible=true;
  boomLight.position.copy(point);
  boomLight.position.y+=1;
  boomLight.intensity=60;
  boomLife=0.5;
 }
 function shell(from,right){
  const s=shells[shellIdx];
  shellIdx=(shellIdx+1)%SHELL_POOL;
  s.mesh.position.copy(from);
  s.vel.set(right.x*1.4+(Math.random()-0.5)*0.4,1.6+Math.random()*0.6,right.z*1.4+(Math.random()-0.5)*0.4);
  s.spin=(Math.random()-0.5)*18;
  s.mesh.visible=true;
  s.life=1.1;
 }
 function smokeCloud(point,seconds=12){
  for(let n=0;n<5;n+=1){
   const s=smokes[smokeIdx];
   smokeIdx=(smokeIdx+1)%SMOKE_POOL;
   s.mesh.position.set(point.x+(Math.random()-0.5)*2.4,point.y+0.9+Math.random()*1.2,point.z+(Math.random()-0.5)*2.4,);
   s.mesh.scale.setScalar(1.6+Math.random()*0.9);
   s.mesh.material.opacity=0.55;
   s.mesh.visible=true;
   s.max=seconds;
   s.life=seconds;
  }
 }
 function step(dt){
  ambientTime+=dt;
  {
   const pos=moteGeo.attributes.position;
   for(let i=0;i<MOTE_COUNT;i+=1){
    const p=motePhase[i];
    let px=moteBase[i*3]+Math.sin(ambientTime*0.13+p*2)*0.6;
    let py=moteBase[i*3+1]+Math.sin(ambientTime*0.3+p)*0.4;
    let pz=moteBase[i*3+2]+Math.cos(ambientTime*0.11+p)*0.5;
    if(cam){
     const dx=px-cam.position.x;
     const dy=py-cam.position.y;
     const dz=pz-cam.position.z;
     const d2=dx*dx+dy*dy+dz*dz;
     if(d2<4){
      const k=2/(Math.sqrt(d2)||0.001);
      px=cam.position.x+dx*k;
      py=cam.position.y+dy*k;
      pz=cam.position.z+dz*k;
     }
    }
    pos.setXYZ(i,px,py,pz);
   }
   pos.needsUpdate=true;
   const epos=emberGeo.attributes.position;
   for(let i=0;i<EMBER_COUNT;i+=1){
    const rise=((ambientTime*emberSpeed[i]+emberPhase[i])%3.2);
    let px=emberOrigin[i*3]+Math.sin(ambientTime*0.8+emberPhase[i])*0.25;
    let py=emberOrigin[i*3+1]+rise;
    let pz=emberOrigin[i*3+2]+Math.cos(ambientTime*0.6+emberPhase[i])*0.2;
    if(cam){
     const dx=px-cam.position.x;
     const dy=py-cam.position.y;
     const dz=pz-cam.position.z;
     const d2=dx*dx+dy*dy+dz*dz;
     if(d2<4){
      const k=2/(Math.sqrt(d2)||0.001);
      px=cam.position.x+dx*k;
      py=cam.position.y+dy*k;
      pz=cam.position.z+dz*k;
     }
    }
    epos.setXYZ(i,px,py,pz);
   }
   epos.needsUpdate=true;
  }
  for(const t of tracers){
   if(t.life<=0)continue;
   t.life-=dt;
   t.line.material.opacity=Math.max(0,t.life/0.07)*0.75;
   if(t.life<=0)t.line.visible=false;
  }
  for(const s of sparks){
   if(s.life<=0)continue;
   s.life-=dt;
   s.mesh.position.addScaledVector(s.vel,dt);
   s.vel.y-=12*dt;
   s.mesh.material.opacity=Math.max(0,s.life/0.4);
   if(s.life<=0)s.mesh.visible=false;
  }
  if(boomLife>0){
   boomLife-=dt;
   const k=1-boomLife/0.5;
   boom.scale.setScalar(0.5+k*6);
   boom.material.opacity=Math.max(0,0.85*(1-k));
   boomLight.intensity=Math.max(0,60*(1-k));
   if(boomLife<=0){boom.visible=false;boomLight.intensity=0;}
  }
  for(const d of dusts){
   if(d.life<=0)continue;
   d.life-=dt;
   const k=1-d.life/d.max;
   d.mesh.scale.setScalar((d.base??0.5)+k*(d.grow??1.6));
   d.mesh.material.opacity=Math.max(0,(d.op0??0.45)*(1-k));
   d.mesh.position.y+=dt*0.25;
   if(d.life<=0)d.mesh.visible=false;
  }
  if(muzzleLife>0){
   muzzleLife-=dt;
   muzzleLight.intensity=Math.max(0,26*(muzzleLife/0.06));
   if(muzzleLife<=0)muzzleLight.intensity=0;
  }
  for(const s of shells){
   if(s.life<=0)continue;
   s.life-=dt;
   s.vel.y-=12*dt;
   s.mesh.position.addScaledVector(s.vel,dt);
   s.mesh.rotation.x+=s.spin*dt;
   s.mesh.rotation.z+=s.spin*0.7*dt;
   if(s.mesh.position.y<0.03){
    s.mesh.position.y=0.03;
    s.vel.set(0,0,0);
    s.spin=0;
   }
   if(s.life<=0)s.mesh.visible=false;
  }
  for(const s of smokes){
   if(s.life<=0)continue;
   s.life-=dt;
   const k=1-s.life/s.max;
   s.mesh.scale.setScalar(1.6+k*1.4);
   s.mesh.material.opacity=Math.max(0,0.55*(1-k*k));
   if(s.life<=0)s.mesh.visible=false;
  }
 }
 return{tracer,impact,explosion,dust,footstep,muzzleSmoke,muzzleFlash,shell,smokeCloud,step};
}
