import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {ground,road} from './driving';
import type {Colliders} from './collision';

type Stretch={from:number;to:number;side:-1|1};
const stretches:Stretch[]=[
  {from:1634,to:1690,side:1},
  {from:2944,to:3032,side:-1},{from:2944,to:3032,side:1},
  {from:4192,to:4280,side:1},
  {from:6144,to:6224,side:-1},{from:6144,to:6224,side:1},
];
const bay=4;
const height=.81;
const profile=[
  [.048,.495],[.018,.512],[-.061,.534],[-.071,.557],[-.061,.581],
  [.024,.629],[.031,.652],[.025,.677],[-.061,.72],[-.071,.744],
  [-.061,.769],[.019,.793],[.048,height],
] as const;

function railPoint(stretch:Stretch,distance:number){
  const endDistance=Math.min(distance-stretch.from,stretch.to-distance);
  const flare=.9*Math.max(0,1-endDistance/7)**2;
  const lateral=road(distance)+stretch.side*(7.42+flare);
  const tangent=Math.atan2(road(distance+.2)-road(distance-.2),.4);
  return {lateral,distance,y:ground(lateral,distance),nx:Math.cos(tangent)*stretch.side,nz:Math.sin(tangent)*stretch.side,tangent};
}

export function railSections(from:number,to:number){
  const sections=[];
  for(const stretch of stretches){
    if(stretch.from>=to||stretch.to<=from)continue;
    for(let begin=stretch.from;begin<stretch.to;begin+=bay){
      const end=Math.min(begin+bay,stretch.to);
      if(begin<from||begin>=to)continue;
      sections.push({stretch,begin,end,a:railPoint(stretch,begin),b:railPoint(stretch,end)});
    }
  }
  return sections;
}

export function railFootprint(section:ReturnType<typeof railSections>[number]){
  const {a,b}=section,dx=b.lateral-a.lateral,dz=b.distance-a.distance;
  const length=Math.hypot(dx,dz);
  return {x:(a.lateral+b.lateral)/2,z:-(a.distance+b.distance)/2,width:.17,length:length/2+.09,sin:-dx/length,cos:dz/length};
}

export function createGuardrails(){
  const galvanized=new T.MeshStandardMaterial({color:'#c4cbd0',roughness:.43,metalness:.37});
  const sheet=new T.MeshStandardMaterial({color:'#c3cbd1',roughness:.40,metalness:.38,vertexColors:true,side:T.DoubleSide});
  const pieces=[
    new T.BoxGeometry(.058,.90,.146).translate(.049,0,0),
    new T.BoxGeometry(.149,.90,.030).translate(0,0,-.059),
    new T.BoxGeometry(.149,.90,.030).translate(0,0,.059),
    new T.BoxGeometry(.14,.19,.18).translate(-.11,.225,0),
  ];
  const post=mergeGeometries(pieces)!;
  pieces.forEach(geometry=>geometry.dispose());
  const bolt=new T.CylinderGeometry(.019,.023,.017,6).rotateZ(Math.PI/2);
  const terminal=new T.CapsuleGeometry(.133,.14,2,8).scale(1.14,1,1);
  const hardware=new T.Object3D();
  const tint=new T.Color();

  function instances(group:T.Group,geometry:T.BufferGeometry,transforms:T.Matrix4[]){
    if(!transforms.length)return;
    const mesh=new T.InstancedMesh(geometry,galvanized,transforms.length);
    mesh.name='Guardrail hardware';
    mesh.userData.sharedEnvironment=true;
    transforms.forEach((matrix,index)=>mesh.setMatrixAt(index,matrix));
    mesh.computeBoundingSphere();
    mesh.receiveShadow=true;
    group.add(mesh);
  }

  return {
    add(group:T.Group,from:number,to:number,colliders:Colliders){
      const sections=railSections(from,to);
      if(!sections.length)return;
      const points:number[]=[],colors:number[]=[],indices:number[]=[];
      const posts:T.Matrix4[]=[],bolts:T.Matrix4[]=[],ends:T.Matrix4[]=[];
      function panel(a:ReturnType<typeof railPoint>,b:ReturnType<typeof railPoint>,depth:number,shade:number){
        const start=points.length/3;
        for(const sample of [a,b]){
          for(const [offset,h] of profile){
            points.push(sample.lateral+(offset+depth)*sample.nx,sample.y+h,-sample.distance+(offset+depth)*sample.nz);
            tint.setScalar(shade+.037*Math.sin(h*27+sample.distance*.9));
            colors.push(tint.r,tint.g,tint.b);
          }
        }
        for(let i=0;i<profile.length-1;i++){
          const k=start+i,n=k+profile.length;
          indices.push(k,k+1,n,k+1,n+1,n);
        }
      }
      function fitting(target:T.Matrix4[],point:ReturnType<typeof railPoint>,rise:number,offset:number,side:number){
        hardware.position.set(point.lateral+offset*point.nx,point.y+rise,-point.distance+offset*point.nz);
        hardware.rotation.set(0,-point.tangent+(side===-1?Math.PI:0),0);
        hardware.updateMatrix();
        target.push(hardware.matrix.clone());
      }
      for(const section of sections){
        const {stretch,begin,end,a,b}=section;
        colliders.add(railFootprint(section));
        panel(a,b,0,.79+.072*Math.sin(begin*.67));
        if(begin>stretch.from){
          panel(a,railPoint(stretch,begin+.20),-.013,.79+.072*Math.sin((begin-bay)*.67));
          for(const along of [.027,.075,.124,.172]){
            const joint=railPoint(stretch,begin+along);
            fitting(bolts,joint,.557,-.09,stretch.side);
            fitting(bolts,joint,.744,-.09,stretch.side);
          }
        }
        for(const distance of [begin,begin+bay/2]){
          const point=railPoint(stretch,distance);
          fitting(posts,point,.32,.16,stretch.side);
          fitting(bolts,point,.65,.011,stretch.side);
        }
        if(begin===stretch.from)fitting(ends,a,.65,-.015,stretch.side);
        if(end===stretch.to)fitting(ends,b,.65,-.015,stretch.side);
      }
      const geometry=new T.BufferGeometry();
      geometry.setAttribute('position',new T.Float32BufferAttribute(points,3));
      geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));
      geometry.setIndex(indices);
      geometry.computeVertexNormals();
      const rail=new T.Mesh(geometry,sheet);
      rail.name='Galvanized W-beam';
      rail.userData.sharedMaterial=true;
      rail.receiveShadow=true;
      group.add(rail);
      instances(group,post,posts);instances(group,bolt,bolts);instances(group,terminal,ends);
    },
    dispose(){post.dispose();bolt.dispose();terminal.dispose();galvanized.dispose();sheet.dispose();},
  };
}
