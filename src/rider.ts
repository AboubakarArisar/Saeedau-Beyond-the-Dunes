import * as T from 'three';

export function rigRider(mesh:T.Object3D,steer:T.Object3D){
  function bone(name:string){
    const node=mesh.getObjectByName(name);
    if(!node)throw new Error('Incomplete Unique 70 rider rig: '+name);
    return node;
  }
  const body=bone('RiderBody'),head=bone('RiderHead');
  const arms=['L','R'].map((side,index)=>({
    sign:index===0?-1:1,upper:bone('RiderUpper'+side),fore:bone('RiderFore'+side),hand:bone('RiderHand'+side),
  }));
  const up=new T.Vector3(0,1,0),shoulder=new T.Vector3(),grip=new T.Vector3(),elbow=new T.Vector3();
  const axis=new T.Vector3(),bend=new T.Vector3(),dir=new T.Vector3();
  function aim(node:T.Object3D,a:T.Vector3,b:T.Vector3,rest:number){
    dir.subVectors(b,a);
    const length=dir.length();
    node.position.copy(a);
    node.quaternion.setFromUnitVectors(up,dir.normalize());
    node.scale.y=length/rest;
  }
  return (dt:number,now:number,acceleration:number,turn:number,reduced:boolean)=>{
    const pitch=T.MathUtils.clamp(-acceleration*.018,-.095,.11)+(reduced?0:Math.sin(now*2.1)*.012);
    body.rotation.x=T.MathUtils.damp(body.rotation.x,pitch,9,dt);
    body.rotation.z=T.MathUtils.damp(body.rotation.z,turn*.075,10,dt);
    head.rotation.x=-body.rotation.x*.55;
    head.rotation.y=-turn*.13;
    for(const arm of arms){
      const {sign,upper,fore,hand}=arm;
      shoulder.set(sign*.145,.325,-.164).applyEuler(body.rotation).add(body.position);
      grip.set(sign*.30,.116,.051).applyQuaternion(steer.quaternion).add(steer.position);
      axis.subVectors(grip,shoulder);
      const reach=axis.length();
      axis.normalize();
      const length=Math.max(.64,reach+.011),a=length*.52,b=length*.48;
      const projection=(a*a-b*b+reach*reach)/(2*reach);
      bend.set(sign*.55,-1,0).addScaledVector(axis,-bend.dot(axis)).normalize();
      elbow.copy(shoulder).addScaledVector(axis,projection).addScaledVector(bend,Math.sqrt(Math.max(0,a*a-projection*projection)));
      aim(upper,shoulder,elbow,.28);
      aim(fore,elbow,grip,.265);
      hand.position.copy(grip);
      hand.rotation.set(Math.PI/2,steer.rotation.y,0,'YXZ');
    }
  };
}
