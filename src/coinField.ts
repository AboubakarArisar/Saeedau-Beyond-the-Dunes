import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {coinsBetween,type Coin} from './coins';
import {ground,paved} from './driving';

function coinGeometry(){
  const rim=new T.LatheGeometry([
    new T.Vector2(0,-.046),new T.Vector2(.226,-.046),new T.Vector2(.259,-.037),
    new T.Vector2(.284,-.021),new T.Vector2(.284,.021),new T.Vector2(.259,.037),
    new T.Vector2(.226,.046),new T.Vector2(0,.046),
  ],32).rotateX(Math.PI/2);
  const body=rim.toNonIndexed();
  rim.dispose();
  const emblem=new T.Shape();
  emblem.moveTo(-.163,-.085);emblem.quadraticCurveTo(-.077,.090,-.009,.026);
  emblem.quadraticCurveTo(.076,.15,.168,-.044);emblem.lineTo(.16,-.071);
  emblem.quadraticCurveTo(.074,.059,-.005,-.024);emblem.quadraticCurveTo(-.098,.018,-.163,-.085);
  const plate=new T.ExtrudeGeometry(emblem,{depth:.009,bevelEnabled:false,curveSegments:6}).translate(0,0,.046);
  const back=plate.clone().rotateY(Math.PI);
  const parts=[body,plate,back];
  const gold=['#ffd054','#c8831a','#c8831a'];
  parts.forEach((part,index)=>{
    const color=new T.Color(gold[index]);
    const values=new Float32Array(part.attributes.position.count*3);
    for(let i=0;i<values.length;i+=3)color.toArray(values,i);
    part.setAttribute('color',new T.BufferAttribute(values,3));
  });
  const result=mergeGeometries(parts)!;
  parts.forEach(part=>part.dispose());
  return result;
}

export function createCoinField(){
  const capacity=48;
  const mesh=new T.InstancedMesh(coinGeometry(),new T.MeshStandardMaterial({
    vertexColors:true,metalness:.57,roughness:.32,emissive:'#633100',emissiveIntensity:.24,
  }),capacity);
  mesh.name='Saeedau coin field';
  mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
  mesh.count=0;
  mesh.frustumCulled=false;
  const transform=new T.Object3D();
  let animations:{coin:Coin;time:number}[]=[];
  let index=0;
  function show(coin:Coin,now:number,reduced:boolean,progress=0){
    if(index>=capacity)return;
    const phase=coin.id*.21;
    const floor=ground(coin.lateral,coin.distance)+(paved(coin.lateral,coin.distance)?.075:0);
    transform.position.set(coin.lateral,floor+.69+(reduced?0:Math.sin(now*2.9+phase)*.066)+progress*.51,-coin.distance);
    transform.rotation.set(0,reduced?.48+phase%1:now*2.0+phase+progress*2.3,0);
    transform.scale.setScalar(1+progress*.28-progress**3*1.28);
    transform.updateMatrix();mesh.setMatrixAt(index++,transform.matrix);
  }
  return {
    mesh,
    pickup(coin:Coin,now:number){animations.push({coin,time:now});},
    reset(){animations=[];},
    update(distance:number,now:number,visible:boolean,reduced:boolean,collected:ReadonlySet<number>,blocked:ReadonlySet<number>){
      mesh.visible=visible;
      if(!visible)return;
      index=0;
      for(const coin of coinsBetween(distance-26,distance+148)){
        if(!collected.has(coin.id)&&!blocked.has(coin.id))show(coin,now,reduced);
      }
      animations=animations.filter(item=>now-item.time<.31);
      if(!reduced)for(const item of animations)show(item.coin,now,false,(now-item.time)/.31);
      mesh.count=index;
      mesh.instanceMatrix.needsUpdate=true;
    },
  };
}
