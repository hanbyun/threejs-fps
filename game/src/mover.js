import*as THREE from'three';
const RADIUS=0.34;
const STAND_HEIGHT=1.72;
const CROUCH_HEIGHT=1.12;
const STAND_EYE=1.6;
const CROUCH_EYE=1.02;
const WALK_SPEED=5.4;
const CROUCH_SPEED=2.5;
const GROUND_ACCEL=42;
const AIR_ACCEL=9;
const FRICTION=9;
const GRAVITY=20;
const JUMP_SPEED=6.4;
export function createBody(colliders,x,z,ramps=[]){
 const body={
  position:new THREE.Vector3(x,0,z),velocity:new THREE.Vector3(),yaw:0,pitch:0,eye:STAND_EYE,onGround:true,crouching:false,height:STAND_HEIGHT,};
 const probe=new THREE.Box3();
 function floorAt(x,z){
  let floor=0;
  for(const r of ramps){
   const rx=x-r.x;
   const rz=z-r.z;
   const along=rx*r.dx+rz*r.dz;
   const across=-rx*r.dz+rz*r.dx;
   if(Math.abs(across)<=r.width/2+RADIUS&&along>=-r.run/2&&along<=r.run/2){
    const h=((along+r.run/2)/r.run)*r.rise;
    if(h>floor)floor=h;
   }
  }
  return floor;
 }
 function overlaps(x,y,z,height,lift){
  probe.min.set(x-RADIUS,y+lift,z-RADIUS);
  probe.max.set(x+RADIUS,y+height-lift,z+RADIUS);
  for(const collider of colliders)if(probe.intersectsBox(collider))return collider;
  return null;
 }
 function tryStepUp(x,z,height){
  const hit=overlaps(x,body.position.y,z,height,0.04);
  if(!hit)return false;
  const rise=hit.max.y-body.position.y;
  if(rise<=0||rise>0.35)return false;
  if(overlaps(x,hit.max.y,z,height,0.02))return false;
  body.position.y=hit.max.y;
  body.velocity.y=0;
  body.onGround=true;
  return true;
 }
 function step(dt,wish,speed,jump,crouch){
  if(crouch&&!body.crouching){
   body.crouching=true;
   body.height=CROUCH_HEIGHT;
  }else if(!crouch&&body.crouching&&!overlaps(body.position.x,body.position.y,body.position.z,STAND_HEIGHT,0.02)){
   body.crouching=false;
   body.height=STAND_HEIGHT;
  }
  const eyeTarget=body.crouching?CROUCH_EYE:STAND_EYE;
  body.eye+=(eyeTarget-body.eye)*Math.min(1,dt*12);
  const maxSpeed=body.crouching?CROUCH_SPEED:speed;
  const blend=Math.min(1,(body.onGround?GROUND_ACCEL:AIR_ACCEL)*dt/maxSpeed);
  body.velocity.x+=(wish.x*maxSpeed-body.velocity.x)*blend;
  body.velocity.z+=(wish.z*maxSpeed-body.velocity.z)*blend;
  if(body.onGround&&wish.lengthSq()===0){
   const damp=Math.max(0,1-FRICTION*dt);
   body.velocity.x*=damp;
   body.velocity.z*=damp;
  }
  if(jump&&body.onGround){
   body.velocity.y=JUMP_SPEED;
   body.onGround=false;
  }
  body.velocity.y-=GRAVITY*dt;
  const nextX=body.position.x+body.velocity.x*dt;
  if(!overlaps(nextX,body.position.y,body.position.z,body.height,0.04))body.position.x=nextX;
  else if(!tryStepUp(nextX,body.position.z,body.height))body.velocity.x=0;
  else body.position.x=nextX;
  const nextZ=body.position.z+body.velocity.z*dt;
  if(!overlaps(body.position.x,body.position.y,nextZ,body.height,0.04))body.position.z=nextZ;
  else if(!tryStepUp(body.position.x,nextZ,body.height))body.velocity.z=0;
  else body.position.z=nextZ;
  body.position.y+=body.velocity.y*dt;
  body.onGround=false;
  const hit=overlaps(body.position.x,body.position.y,body.position.z,body.height,0);
  if(hit&&body.velocity.y<=0){
   body.position.y=hit.max.y;
   body.velocity.y=0;
   body.onGround=true;
  }else if(hit){
   body.position.y=hit.min.y-body.height;
   body.velocity.y=0;
  }
  const slope=floorAt(body.position.x,body.position.z);
  if(body.velocity.y<=0&&body.position.y<=slope+0.05){
   body.position.y=slope;
   body.velocity.y=0;
   body.onGround=true;
  }
  if(body.position.y<0){
   body.position.y=0;
   body.velocity.y=0;
   body.onGround=true;
  }
  body.velocity.y=Math.max(-30,body.velocity.y);
 }
 function groundSpeed(){
  return Math.hypot(body.velocity.x,body.velocity.z);
 }
 return{body,step,groundSpeed,WALK_SPEED};
}
