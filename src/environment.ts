import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {ground,checkpoints,development,road} from './driving';

export async function loadEnvironment(){
  const loader=new GLTFLoader();
  const bundles=await Promise.allSettled(['houses','vegetation','roadside','settlement'].map(folder=>
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
    if(distance<from||distance>=to)return;
    const lateral=road(distance)+offset;
    const inset=name.startsWith('Parked')?.125:.15;
    transform.position.set(lateral,ground(lateral,distance)-inset,-distance);
    transform.rotation.y=angle;
    transform.scale.setScalar(scale);
    transform.updateMatrix();
    const batch=near?nearMatrices:matrices;
    const list=batch.get(name)??[];
    list.push(transform.matrix.clone());
    batch.set(name,list);
  };
  for(let index=0;index<92;index++){
    const distance=from+random()*(to-from);
    const offset=(random()<.5?-1:1)*(6.3+random()**1.8*146);
    if(offset>5&&offset<18&&checkpoints.some((anchor,index)=>{
      const sign=index===0?42:index===checkpoints.length-1?anchor+15:anchor-12;
      return distance>=sign-50&&distance<=sign+6;
    }))continue;
    if(Math.abs(offset)<19&&random()<development(distance)*.7)continue;
    if(Math.abs(offset)>35&&Math.sin(distance*.051+offset*.15)>.46)continue;
    const kind=index<22?(index%3?'Kandi':'Khumbat'):(index%3?'Khimp':'Karir');
    place(kind+index%3,distance,offset,(index<22?.61:.36)+random()*.62,random()*Math.PI*2);
  }
  checkpoints.forEach((anchor,index)=>{
    if(anchor+100<from||anchor-90>=to)return;
    if(index<4){
      const groups=index===0?9:index===1?7:index===2?4:3;
      for(let shop=0;shop<groups;shop++){
        const side=shop%2===0?-1:1;
        const distance=anchor+(index===0?24:-45)+shop*(index===0?9:13);
        const offset=side*(10+shop%3*2.9);
        place('Market'+shop%3,distance,offset,.9+shop%3*.11,side*Math.PI/2+(shop%3-1)*.11,true);
        if(shop%2===0)place('ParkedBike',distance+3,offset-side*3.1,.95,side*.65,true);
        if(shop%3===1)place('Wall',distance+4.4,offset+side*3,.95,.44,true);
      }
      place('TeaStall',anchor+(index===0?31:-18),-15.5,1.04,-1.45,true);
      if(index<2)place('ParkedJeep',anchor+(index===0?39:-20),10.5,1,.39,true);
    }
    for(const [variant,distance,offset,size,angle] of [
      [0,31,14,1.15,-.7],[1,38,21,1.08,-.9],[2,27,23,.95,.2],
      [1,54,19,1.09,-1.1],[0,60,27,.89,-.35],[2,56,32,1.11,.77],
    ])if(index>=3||variant===2)place('Chounra'+variant,anchor+(index===7?-82:0)+distance,offset+(index<3?10:0),size,angle,true);
    for(const [distance,offset,angle] of [[27,10,.5],[31,9,.4],[38,11,-.25],[44,13,-.45],[49,15,-.3],[55,14,.4],[60,14,.45]]){
      place('Wall',anchor+(index===7?-82:0)+distance,offset,1,angle,true);
    }
    if(index>=3)place('TeaStall',anchor+(index===7?-78:72),-11,1.05,-1.12,true);
    place('Charpai',anchor+70,-8.7,.92,1.15,true);
    place('Charpai',anchor+34,16,.94,-.63,true);
    place('ClayPot',anchor+71,-9.4,1.05,.5,true);
    place('ClayPot',anchor+32,13.1,.76,-.2,true);
    for(const [kind,distance,offset,scale] of [
      ['Kandi0',35,17,1.35],['Kandi1',47,-12,1.35],['Khumbat0',60,24,1.35],
      ['Kandi2',76,-15,1.19],['Karir1',24,-8,.85],['Khimp2',28,7.3,.73],['Khimp1',68,-7.3,.68],
    ] as const)place(kind,anchor+distance,offset,scale,random()*Math.PI*2,true);
    if(index>=2){
      place('Trough',anchor+(index===7?-30:75),18,1,.4,true);
      for(let goat=0;goat<3;goat++)place('Goat',anchor+(index===7?-40:78)+goat*3,20+goat%2*2,.86+goat*.12,random()*6,true);
    }
    if(index===7){
      place('Chounra1',anchor+23,-15,1.2,1.05,true);
      place('Chounra2',anchor+31,16,1.24,-1.1,true);
      place('Chounra0',anchor+38,-21,1.08,1.32,true);
      place('Kandi1',anchor+27,-13,1.3,1,true);
      place('Wall',anchor+28,-10,1,.55,true);
    }
  });
  const wires:number[]=[];
  for(let distance=Math.max(12,12+Math.ceil((from-12)/44)*44);distance<Math.min(2980,to);distance+=44){
    const offset=-8.9;
    place('Utility',distance,offset,1,0);
    if(distance<950)place('Streetlamp',distance+5,7.4,1,Math.PI);
    if(distance+44>=2980)continue;
    const startX=road(distance)+offset,endX=road(distance+44)+offset;
    const startY=ground(startX,distance)+5.99,endY=ground(endX,distance+44)+5.99;
    for(const cable of [-.53,.53]){
      const point=(t:number)=>[T.MathUtils.lerp(startX,endX,t)+cable,T.MathUtils.lerp(startY,endY,t)-.78*4*t*(1-t),-distance-t*44];
      for(let step=0;step<5;step++)wires.push(...point(step/5),...point((step+1)/5));
    }
  }
  if(wires.length){
    const geometry=new T.BufferGeometry();
    geometry.setAttribute('position',new T.Float32BufferAttribute(wires,3));
    group.add(new T.LineSegments(geometry,new T.LineBasicMaterial({color:'#49473f'})));
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
