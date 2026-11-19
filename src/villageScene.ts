import * as T from 'three';
import type {Colliders} from './collision';
import {ground,LENGTH,villageOrigin} from './driving';
import {villageHomes,villageJunction,villageRoads} from './village';

const origin=LENGTH+villageJunction;
type Sign=(x:number,d:number,heading:string,lines:string[],width:number,angle?:number)=>void;

export function buildVillage(group:T.Group,colliders:Colliders,sign:Sign,asphalt:string,roughness:number,
  texture?:(surface:T.Mesh<T.BufferGeometry,T.MeshStandardMaterial>,paved:boolean)=>void){
  for(const lane of villageRoads){
    for(const shoulder of [true,false]){
      const vertices:number[]=[],indices:number[]=[];
      lane.points.forEach(([x,d],index)=>{
        const [ax,ad]=lane.points[Math.max(0,index-1)], [bx,bd]=lane.points[Math.min(lane.points.length-1,index+1)];
        const length=Math.hypot(bx-ax,bd-ad),width=lane.width/2+(shoulder?1.05:0);
        for(const side of [-1,1]){
          const wx=villageOrigin+x+side*(bd-ad)*width/length,wd=origin+d-side*(bx-ax)*width/length;
          vertices.push(wx,ground(wx,wd)+(shoulder?.025:.075),-wd);
        }
        if(index){const j=index*2;indices.push(j-2,j-1,j,j-1,j+1,j);}
      });
      const geo=new T.BufferGeometry();
      geo.setAttribute('position',new T.Float32BufferAttribute(vertices,3));geo.setIndex(indices);geo.computeVertexNormals();
      const road=new T.Mesh(geo,new T.MeshStandardMaterial({color:shoulder?'#b99770':lane.paved?asphalt:'#aa8b66',
        roughness:lane.paved&&!shoulder?roughness:.96,side:T.DoubleSide}));
      if(lane.paved&&!shoulder)road.userData.land='road';
      texture?.(road,lane.paved&&!shoulder);
      road.receiveShadow=true;group.add(road);
    }
  }
  const batches=new Map<string,{shape:string;color:string;matrices:T.Matrix4[]}>();
  const transform=new T.Object3D();
  function piece(shape:string,color:string,x:number,d:number,w:number,l:number,h:number,base=0,solid=false){
    const wx=villageOrigin+x,wd=origin+d;
    const key=shape+color;
    let batch=batches.get(key);
    if(!batch){batch={shape,color,matrices:[]};batches.set(key,batch);}
    transform.position.set(wx,ground(wx,wd)+base+h/2-.055,-wd);
    transform.scale.set(w,h,l);transform.updateMatrix();batch.matrices.push(transform.matrix.clone());
    if(solid)colliders.add({x:wx,z:-wd,width:w/2,length:l/2,sin:0,cos:1});
  }
  const box=(color:string,x:number,d:number,w:number,l:number,h:number,base=0,solid=false)=>
    piece('box',color,x,d,w,l,h,base,solid);
  const mud=['#bd9973','#c7a381','#ac8362','#d1af8b'];
  const trim='#eee2c9',timber='#594438';
  function house(x:number,d:number,w:number,l:number,wall:string,roof:string,height:number){
    box(wall,x,d,w,l,height,0,true);box(roof,x,d,w+.45,l+.45,.27,height);
    box(timber,x,d-l/2-.025,1.05,.07,1.9);
    for(const offset of [-w*.32,w*.32]){
      box(timber,x+offset,d-l/2-.035,.95,.08,.9,1.03);
      box(trim,x+offset,d-l/2-.085,.065,.035,.82,1.07);
    }
  }
  function yard(x:number,d:number,w:number,l:number,gateSide:'front'|'west'='front'){
    const color='#a68160',gap=3.9,depth=.26;
    box(color,x,d+l/2,w,depth,.82,0,true);
    box(color,x+w/2,d,depth,l,.82,0,true);
    if(gateSide==='west'){
      box(color,x,d-l/2,w,depth,.82,0,true);
      for(const side of [-1,1])box(color,x-w/2,d+side*(l+gap)/4,depth,(l-gap)/2,.82,0,true);
      for(const side of [-1,1])box('#b68a67',x-w/2,d+side*gap/2,.53,.53,1.25,0,true);
    }else{
      box(color,x-w/2,d,depth,l,.82,0,true);
      for(const side of [-1,1]){
        box(color,x+side*(w+gap)/4,d-l/2,(w-gap)/2,depth,.82,0,true);
        box('#b68a67',x+side*gap/2,d-l/2,.53,.53,1.25,0,true);
      }
    }
  }
  // The three civic sites share open sand near the left road end.
  house(-142,103,17,8,'#dfd4bd','#b5a68d',3.7);
  box('#556d65',-142,98,5.5,2.5,.25,2.6);
  for(const side of [-1,1]){
    box('#65766d',-142+side*2.3,97.8,.19,.19,2.62,0,true);
    box('#f3d49a',-142+side*1.6,98.95,.28,.2,.18,2.25);
  }
  box('#b0a08a',-139,90,15,9,.035);
  for(const x of [-144,-140,-136])box('#efe0bf',x,90,.085,5,.022,.04);
  sign(-148,98,'SAEEDAU',['HOSPITAL'],6);
  house(-173,72,16,7,'#cfb58a','#a6886e',3.05);
  yard(-171,70,22,18);
  sign(-158,70,'SAEEDAU',['SCHOOL'],4.5,-Math.PI/2);
  house(-173,129,6.3,4.5,'#b6b199','#817e69',2.55);
  box('#777766',-164,128,5.4,3,.24,2.45);
  for(const x of [-166.2,-161.8])box(timber,x,128,.19,.19,2.45,0,true);
  box('#8a7865',-170,121,.33,.33,1.3,0,true);
  for(let i=0;i<5;i++)box(i%2?'#e8ddcc':'#9d4937',-170+i*.57,121,.57,.12,.14,1.14);
  sign(-163,120,'LANDMARK',['RANGERS CHECKPOINT'],6);
  sign(-3,23,'SAEEDAU JUNCTION',['← HOSPITAL · APPROX. 3 KM','SIDDIQUE FAQEER GOTH →'],9.4);
  sign(25,58,'VILLAGE APPROACH',['APPROX. 1 KM'],4.4);
  sign(54,96,'HIGH TRACK',['APPROX. 300 M'],4.2,-Math.PI/2);
  sign(96,112,'WELCOME TO',['SIDDIQUE FAQEER GOTH'],7.6,-Math.PI/2);
  box('#b59773',104,113,7.5,24,.045);

  villageHomes.forEach((home,index)=>{
    const {x,d,round}=home;
    if(round){
      const radius=2.05+index%3*.22;
      piece('cylinder',mud[index%4],x,d,radius*2,radius*2,2.25,0,true);
      piece('cone',index%2?'#98774f':'#a48456',x,d,radius*2.48,radius*2.48,1.84,2.18);
      box(timber,x,d-radius,.93,.15,1.55);
    }else{
      const markan='markan' in home;
      house(x,d,markan?8.3:6.1,markan?5.5:4.7,markan?'#d8b489':mud[index%4],markan?'#825e4b':'#a78768',markan?2.9:2.45);
      if(markan){
        box('#72553e',x,d-3.15,5.8,1.25,.24,2.18);
        box('#7c968b',x-4.19,d,.12,1.2,1.85,.15);
        sign(108,124,'HOME DESTINATION',['MARKAN FAQEER HOUSE'],6.5,-Math.PI/2);
      }
    }
    if(index===1)yard(x+1,d-1,15,13,'west');
    if(index===4||index===7)yard(x,d,12,12);
    box('#b29778',x-5.3,d-3.8,3.5,1.4,.035);
  });
  for(const {shape,color,matrices} of batches.values()){
    const geometry=shape==='cone'?new T.ConeGeometry(.5,1,16):shape==='cylinder'?
      new T.CylinderGeometry(.5,.5,1,16):new T.BoxGeometry(1,1,1);
    const mesh=new T.InstancedMesh(geometry,new T.MeshStandardMaterial({color,roughness:.89}),matrices.length);
    matrices.forEach((matrix,index)=>mesh.setMatrixAt(index,matrix));
    mesh.computeBoundingSphere();mesh.receiveShadow=true;group.add(mesh);
  }
}
