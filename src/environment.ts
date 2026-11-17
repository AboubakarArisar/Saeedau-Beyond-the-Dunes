import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {ground, LEG, LENGTH, road} from './driving';

export async function loadEnvironment(){
  const loader=new GLTFLoader();
  const bundles=await Promise.allSettled(['houses','vegetation','roadside'].map(folder=>
    loader.loadAsync(import.meta.env.BASE_URL+`assets/${folder}/kit.glb`)));
  const assets=new Map<string,T.Mesh<T.BufferGeometry,T.MeshStandardMaterial>>();
  for(const result of bundles){
    if(result.status==='rejected'){
      console.error('Could not load an environment kit',result.reason);
      continue;
    }
    result.value.scene.traverse(item=>{
      if(item instanceof T.Mesh&&item.material instanceof T.MeshStandardMaterial){
        item.material.side=T.DoubleSide;
        assets.set(item.name,item);
      }
    });
  }
  return assets;
}

export type Environment=Awaited<ReturnType<typeof loadEnvironment>>;

export function disposeEnvironment(assets:Environment){
  const materials=new Set<T.Material>();
  for(const item of assets.values()){
    item.geometry.dispose();
    materials.add(item.material);
  }
  for(const material of materials)material.dispose();
}

export function decorate(group:T.Group, assets:Environment, from:number, to:number){
  const matrices=new Map<string,T.Matrix4[]>();
  const nearMatrices=new Map<string,T.Matrix4[]>();
  const transform=new T.Object3D();
  let seed=7769+from*163;
  const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
  const place=(name:string,distance:number,offset:number,scale:number,angle:number,near=false)=>{
    const lateral=road(distance)+offset;
    transform.position.set(lateral,ground(lateral,distance)-.065,-distance);
    transform.rotation.y=angle;
    transform.scale.setScalar(scale);
    transform.updateMatrix();
    const batch=near?nearMatrices:matrices;
    const list=batch.get(name)??[];
    list.push(transform.matrix.clone());
    batch.set(name,list);
  };
  for(let index=0;index<106;index++){
    const distance=from+random()*(to-from);
    const offset=(random()<.5?-1:1)*(6.3+random()**1.8*146);
    if(Math.abs(offset)>35&&Math.sin(distance*.051+offset*.15)>.46)continue;
    const kind=index<22?(index%3?'Kandi':'Khumbat'):(index%3?'Khimp':'Karir');
    place(kind+index%3,distance,offset,(index<22?.61:.36)+random()*.62,random()*Math.PI*2);
  }
  for(let anchor=0;anchor<=LENGTH;anchor+=LEG){
    if(anchor<from||anchor>=to)continue;
    for(const [variant,distance,offset,size,angle] of [
      [0,31,14,1.15,-.7],[1,38,21,1.08,-.9],[2,27,23,.95,.2],
      [1,54,19,1.09,-1.1],[0,60,27,.89,-.35],[2,56,32,1.11,.77],
    ])place('Chounra'+variant,anchor+distance,offset,size,angle,true);
    for(const [distance,offset,angle] of [[27,10,.5],[31,9,.4],[38,11,-.25],[44,13,-.45],[49,15,-.3],[55,14,.4],[60,14,.45]]){
      place('Wall',anchor+distance,offset,1,angle,true);
    }
    place('TeaStall',anchor+72,-11,1.05,1.12,true);
    place('Charpai',anchor+70,-8.7,.92,1.15,true);
    place('Charpai',anchor+34,16,.94,-.63,true);
    place('ClayPot',anchor+71,-9.4,1.05,.5,true);
    place('ClayPot',anchor+32,13.1,.76,-.2,true);
    for(const [kind,distance,offset,scale] of [
      ['Kandi0',35,17,1.35],['Kandi1',47,-12,1.35],['Khumbat0',60,24,1.35],
      ['Kandi2',76,-15,1.19],['Karir1',24,-8,.85],['Khimp2',28,7.3,.73],['Khimp1',68,-7.3,.68],
    ] as const)place(kind,anchor+distance,offset,scale,random()*Math.PI*2,true);
  }
  for(const batch of [matrices,nearMatrices]){
    for(const [name,transforms] of batch){
      const template=assets.get(name);
      if(!template)continue;
      const instances=new T.InstancedMesh(template.geometry,template.material,transforms.length);
      instances.userData.sharedEnvironment=true;
      transforms.forEach((matrix,index)=>instances.setMatrixAt(index,matrix));
      instances.computeBoundingSphere();
      instances.castShadow=batch===nearMatrices;
      group.add(instances);
    }
  }
}
