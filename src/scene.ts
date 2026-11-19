import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import type {Motion} from './gameAudio';
import type {DriveAction} from './TouchDrive';
import {isControl} from './Radio';
import {decorate,disposeEnvironment,loadEnvironment,type Environment} from './environment';
import { LENGTH, ROAD_WIDTH, checkpoints, junction, stops, ground, road, paved, start, advance, visit, vehicles, chaseProfiles, dampHeading, type Vehicle } from './driving';
import {Colliders,moveThrough} from './collision';
import {seasons,type Season} from './seasons';
import {checkpoint,discover,newRun,places,tick,type Mode,type Run} from './run';

export function mount(host: HTMLElement, report: (speed:number, position:number, progress:number, motion:Motion, run:Run) => void, options: {
  paused:boolean;shadows:boolean;vehicle:Vehicle;title:boolean;mobile:boolean;reducedMotion:boolean;
  touch:Map<number,DriveAction>;reset:number;recenter:boolean;season:Season;mode:Mode;preview:boolean;finish:boolean;
  garage:boolean;previewFrame:{current:HTMLDivElement|null};previewAngle:number;previewZoom:number;
  vehicleLoad:(vehicle:Vehicle,status:'ready'|'error')=>void;
}) {
  const scene = new T.Scene(); scene.fog = new T.FogExp2('#d1cdbd', .0022);
  const renderer = new T.WebGLRenderer({antialias:true}); renderer.setPixelRatio(Math.min(1.5, devicePixelRatio)); renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap; renderer.toneMapping = T.ACESFilmicToneMapping; host.append(renderer.domElement);
  const camera = new T.PerspectiveCamera(52,1,.15,850);
  const titleCamera=new T.PerspectiveCamera(43,1,.15,850);
  const previewCamera=new T.PerspectiveCamera(47,1,.15,850);
  const displayCar=start();
  const previewDistance=172;
  const previewCar={position:previewDistance,lateral:road(previewDistance),
    heading:Math.atan2(road(previewDistance+1)-road(previewDistance-1),2)};
  const previewProfiles={
    kekro:{radius:3.36,target:1.56,angle:2.35},
    jeep:{radius:2.27,target:1.02,angle:2.22},
    unique:{radius:1.24,target:.59,angle:2.08},
  };
  const previewAngles={journey:2.17,race:2.48,challenge:1.94,explorer:1.66};
  const contact=new T.Mesh(new T.PlaneGeometry(1,1),new T.ShaderMaterial({
    transparent:true,depthWrite:false,
    vertexShader:'varying vec2 tex; void main(){tex=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:'varying vec2 tex; void main(){float fade=1.-smoothstep(.06,.5,length(tex-.5));gl_FragColor=vec4(.06,.043,.027,fade*.39);}',
  }));
  contact.rotation.order='YXZ';
  contact.rotation.x=-Math.PI/2;
  contact.visible=false;
  scene.add(contact);
  const showroomFill=new T.PointLight('#ffe1bf',21,13);
  showroomFill.visible=false;
  scene.add(showroomFill);
  const ambient=new T.HemisphereLight('#dcecff','#b4906c',1.65);
  scene.add(ambient);
  const sun = new T.DirectionalLight('#ffebcf',2.5); sun.shadow.mapSize.set(1024,1024); Object.assign(sun.shadow.camera,{left:-25,right:25,top:25,bottom:-25,far:110}); sun.shadow.normalBias=.045; scene.add(sun,sun.target);
  const sky = new T.Mesh(new T.SphereGeometry(780,24,12),new T.ShaderMaterial({
    side:T.BackSide,depthWrite:false,
    uniforms:{horizon:{value:new T.Color()},zenith:{value:new T.Color()},glowStrength:{value:1},cloudCover:{value:0}},
    vertexShader:'varying vec3 direction; void main(){direction=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:`varying vec3 direction; uniform vec3 horizon,zenith; uniform float glowStrength,cloudCover; void main(){
      vec3 ray=normalize(direction);
      float height=max(ray.y,0.);
      vec3 color=mix(horizon,zenith,smoothstep(0.,.45,height));
      float clouds=sin(11.*ray.x+2.*sin(8.*ray.z))+sin(9.*ray.z-6.*ray.y)*.46;
      color=mix(color,horizon*.72,cloudCover*smoothstep(-.15,.88,clouds)*smoothstep(.02,.26,height));
      float glow=pow(max(dot(ray,normalize(vec3(-.57,.43,-.70))),0.),12.);
      gl_FragColor=vec4(color+vec3(.32,.19,.08)*glow*glowStrength,1.);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
  }));scene.add(sky);
  function mesh(geometry:T.BufferGeometry,color:string,parent:T.Object3D=scene) {const item=new T.Mesh(geometry,new T.MeshStandardMaterial({color,roughness:.91})); item.receiveShadow=true; parent.add(item); return item;}
  const span=320, chunks=new Map<number,T.Group>();
  const collisionChunks=new Map<number,Colliders>();
  let currentSeason:Season|undefined;
  const rainPoints=new Float32Array(180*6);
  const rainGeometry=new T.BufferGeometry();
  rainGeometry.setAttribute('position',new T.BufferAttribute(rainPoints,3).setUsage(T.DynamicDrawUsage));
  const rain=new T.LineSegments(rainGeometry,new T.LineBasicMaterial({color:'#dcebf5',transparent:true,opacity:.33,depthWrite:false}));
  rain.frustumCulled=false;rain.visible=false;scene.add(rain);
  let environment:Environment|undefined;
  function tuneVegetation(season:Season){
    for(const [name,plant] of environment??[])if(/^(Kandi|Khumbat|Karir|Khimp)/.test(name)){
      plant.material.color.set(seasons[season].foliage);
    }
  }
  loadEnvironment().then(assets=>{
    if(disposed){disposeEnvironment(assets);return;}
    environment=assets;
    tuneVegetation(options.season);
    for(const [key,group] of chunks)decorate(group,assets,key*span,(key+1)*span,collisionChunks.get(key)!);
    renderer.shadowMap.needsUpdate=true;
  }).catch(error=>console.error('Could not initialize Thar scenery',error));
  function surface(kind:'sand'|'asphalt'){
    const size=128,data=new Uint8Array(size*size*4);
    let seed=kind==='sand'?13:67;
    for(let row=0;row<size;row++)for(let column=0;column<size;column++){
      seed=(Math.imul(seed,1664525)+1013904223)>>>0;
      const grain=seed/4294967296-.5;
      const waves=Math.sin(row*Math.PI/8+1.15*Math.sin(column*Math.PI/32));
      const shade=kind==='sand'?216+grain*43+waves*3:174+grain*52+waves*2;
      const index=(row*size+column)*4;
      data.set([shade,shade,shade,255],index);
    }
    const texture=new T.DataTexture(data,size,size);texture.wrapS=texture.wrapT=T.RepeatWrapping;
    texture.generateMipmaps=true;texture.minFilter=T.LinearMipmapLinearFilter;texture.magFilter=T.LinearFilter;
    texture.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());texture.needsUpdate=true;
    return texture;
  }
  const sand=surface('sand'),asphalt=surface('asphalt');
  function textureSurface(item:T.Mesh,texture:T.Texture,scale:number){
    const points=item.geometry.attributes.position, uv=new Float32Array(points.count*2);
    for(let index=0;index<points.count;index++){
      uv[index*2]=points.getX(index)/scale;uv[index*2+1]=points.getZ(index)/scale;
    }
    item.geometry.setAttribute('uv',new T.BufferAttribute(uv,2));
    (item.material as T.MeshStandardMaterial).map=texture;
  }
  const dispose=(root:T.Object3D)=>root.traverse(item=>{if(item instanceof T.InstancedMesh){item.dispose();if(item.userData.sharedEnvironment)return;}if(item instanceof T.Mesh||item instanceof T.Points||item instanceof T.LineSegments){item.geometry.dispose();for(const material of Array.isArray(item.material)?item.material:[item.material]){if(material.map&&material.map!==sand&&material.map!==asphalt)material.map.dispose();material.dispose();}}});
  function chunk(segment:number){
    const group=new T.Group(),from=segment*span,to=from+span;
    const colliders=new Colliders();
    collisionChunks.set(segment,colliders);
    const terrain=new T.PlaneGeometry(440,span,110,80);terrain.rotateX(-Math.PI/2);terrain.translate(0,0,-from-span/2);
    const points=terrain.attributes.position;
    const tint=new Float32Array(points.count*3);
    const sandTone=new T.Color('#cbb18a'),earthTone=new T.Color('#a98d68'),greenTone=new T.Color('#999373'),color=new T.Color();
    for(let index=0;index<points.count;index++){
      const x=points.getX(index),distance=-points.getZ(index);
      points.setY(index,ground(x,distance)-.12);
      const mottling=.5+.26*Math.sin(x*.12+distance*.058)+.22*Math.cos(x*.29-distance*.14);
      color.copy(sandTone).lerp(earthTone,mottling).lerp(greenTone,Math.max(0,Math.sin(x*.056-distance*.031)-.48)*.7);
      color.toArray(tint,index*3);
    }
    terrain.setAttribute('color',new T.BufferAttribute(tint,3));
    terrain.computeVertexNormals();
    const soil=mesh(terrain,'#ffffff',group);
    soil.userData.land='soil';
    soil.material.color.set(seasons[options.season].soil);
    soil.material.vertexColors=true;
    textureSurface(soil,sand,5.8);
    soil.material.bumpMap=sand;soil.material.bumpScale=.12;
    if(from>=0&&from<LENGTH){
      const grassGeometry=new T.BufferGeometry();
      grassGeometry.setAttribute('position',new T.Float32BufferAttribute([
        -.1,0,0,.04,0,0,-.16,.38,.02, -.04,0,0,.09,0,0,.12,.54,.04,
        0,0,-.08,0,0,.08,.05,.45,-.16,
      ],3));
      grassGeometry.computeVertexNormals();
      const grass=new T.InstancedMesh(grassGeometry,new T.MeshStandardMaterial({side:T.DoubleSide,color:'#818e49'}),128);
      const tuft=new T.Object3D();
      for(let index=0;index<grass.count;index++){
        const patch=Math.floor(index/4),d=from+(patch+.5)*10+Math.sin(index*9)*2;
        const offset=(patch%2?1:-1)*(9+11*(1+Math.sin(patch*12+segment))+.55*(index%4));
        const x=road(d)+offset;
        tuft.position.set(x,ground(x,d)-.17,-d);
        tuft.rotation.y=index*2.4;
        tuft.scale.setScalar(.58+.49*Math.cos(index*13)**2);
        tuft.updateMatrix();grass.setMatrixAt(index,tuft.matrix);
      }
      grass.computeBoundingSphere();
      grass.userData.land='grass';
      grass.visible=options.season==='summer'||options.season==='monsoon';
      grass.material.color.set(options.season==='monsoon'?'#88994d':'#8d8b50');
      group.add(grass);
    }
    function strip(offset:number,width:number,color:string,ranges:number[][]){
      const vertices:number[]=[],indices:number[]=[];
      for(const [begin,end] of ranges){
        const count=Math.ceil((end-begin)/2);
        for(let index=0;index<=count;index++){
          const distance=begin+(end-begin)*index/count,base=vertices.length/3;
          for(const side of [-1,1]){
            const taper=1-T.MathUtils.smoothstep(distance,LENGTH+22,LENGTH+72);
            const lateral=road(distance)+(offset+side*width/2)*taper;
            const elevation=width<1?.103:width===ROAD_WIDTH?.075:.015;
            vertices.push(lateral,ground(lateral,distance)+elevation,-distance);
          }
          if(index)indices.push(base-2,base-1,base,base-1,base+1,base);
        }
      }
      const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(vertices,3));geometry.setIndex(indices);geometry.computeVertexNormals();
      const item=mesh(geometry,color,group);
      if(width===ROAD_WIDTH){
        item.userData.land='road';
        item.material.color.set(seasons[options.season].road);
        item.material.roughness=seasons[options.season].roughness;
      }
      if(width>=1)textureSurface(item,width===ROAD_WIDTH?asphalt:sand,width===ROAD_WIDTH?2.7:5.8);
    }
    if(from>=0&&from<LENGTH+72){
      const end=Math.min(to,LENGTH+72),range=[[from,end]];
      const leftEdge=from<=junction&&junction<end?[[from,junction-4],[junction+4,end]]:range;
      strip(-6.13,2,'#ac875f',leftEdge);strip(6.13,2,'#ac875f',range);
      strip(0,ROAD_WIDTH,'#5f5b56',range);strip(-4.94,.13,'#ddbc6c',leftEdge);strip(4.94,.13,'#ddbc6c',range);
      strip(0,.13,'#eadbb5',Array.from({length:Math.max(0,Math.floor((Math.min(end,LENGTH+24)-from)/16))},(_,index)=>[from+index*16+4,from+index*16+10]));
    }
    if(environment)decorate(group,environment,from,to,colliders);
    for(let d=Math.max(0,Math.ceil(from/12)*12);d<Math.min(to,LENGTH);d+=12){
      if(d>=junction-38&&d<=junction-14){
        const x=road(d)+7.4,y=ground(x,d);
        const angle=-Math.atan2(road(d+1)-road(d-1),2);
        const rail=mesh(new T.BoxGeometry(.21,.25,11.8),'#8b8981',group);
        rail.position.set(x,y+.72,-d);rail.rotation.y=angle;
        colliders.add({x,z:-d,width:.105,length:5.9,sin:Math.sin(angle),cos:Math.cos(angle)});
        for(const offset of [-3.5,3.5]){
          mesh(new T.BoxGeometry(.17,.85,.16),'#66655a',group).position.set(x+Math.sin(angle)*offset,y+.35,-d+Math.cos(angle)*offset);
        }
      }
      if(d>2800&&d%84===0){
        const x=road(d)+27*Math.sin(d);
        if(Math.abs(x-road(d))<10)continue;
        const rock=mesh(new T.DodecahedronGeometry(1),'#977d62',group);
        rock.scale.set(1.55,.85,1.1);rock.position.set(x,ground(x,d)+.29,-d);
        colliders.add({x,z:-d,width:1.37,length:.95,sin:0,cos:1});
      }
    }
    function roadsideSign(distance:number,offset:number,heading:string,lines:string[],width=6.2,gateway=false){
      if(distance<from||distance>=to)return;
      const lateral=road(distance)+offset,elevation=ground(lateral,distance),height=lines.length>1?2.15:1.65;
      const board=document.createElement('canvas');board.width=768;board.height=lines.length>1?272:208;
      const context=board.getContext('2d');
      if(context){
        context.fillStyle=gateway?'#753d2d':'#235247';context.fillRect(0,0,board.width,board.height);
        context.strokeStyle='#f4e5c5';context.lineWidth=5;context.strokeRect(12,12,744,board.height-24);
        context.fillStyle='#fff9e8';context.textAlign='center';context.textBaseline='middle';
        context.font='bold 42px system-ui';context.fillText(heading,384,52,680);
        context.font=lines.length===1?'bold 76px system-ui':'bold 47px system-ui';
        lines.forEach((line,index)=>context.fillText(line,384,lines.length===1?127:110+index*60,690));
        const texture=new T.CanvasTexture(board);texture.colorSpace=T.SRGBColorSpace;
        const sign=new T.Mesh(new T.BoxGeometry(width,height,.09),new T.MeshBasicMaterial({map:texture}));
        sign.position.set(lateral,elevation+(gateway?5.2:2.7),-distance);group.add(sign);
      }
      for(const post of [-1,1]){
        const x=lateral+post*width*(gateway?.47:.37),z=-distance-.13;
        const thickness=gateway?.66:.13,postHeight=gateway?4.55:3;
        mesh(new T.BoxGeometry(thickness,postHeight,thickness),gateway?'#a87555':'#66635a',group).position.set(x,ground(x,distance)+postHeight/2-.1,z);
        colliders.add({x,z,width:thickness/2,length:thickness/2,sin:0,cos:1});
      }
    }
    stops.forEach((name,index)=>roadsideSign(index===0?42:index===7?LENGTH-19:checkpoints[index]-12,
      index===7?0:9,'WELCOME TO',[name.toUpperCase()],index===7?15.8:6.2,index===7));
    roadsideSign(junction-3,-10,'JEELANI MOR JUNCTION',['← Khipro      ↑ Saeedau','Chhor ↓'],8.7);
    for(const place of places){
      if(place.distance<from||place.distance>=to||place.distance===junction)continue;
      const side=Math.sign(place.offset),track=mesh(new T.PlaneGeometry(Math.abs(place.offset)-6.4,3.25,14,3),'#b09976',group);
      track.geometry.rotateX(-Math.PI/2);
      track.geometry.translate(road(place.distance)+(place.offset+6.4*side)/2,0,-place.distance);
      const vertices=track.geometry.attributes.position;
      for(let index=0;index<vertices.count;index++)vertices.setY(index,ground(vertices.getX(index),-vertices.getZ(index))-.05);
      track.geometry.computeVertexNormals();textureSurface(track,sand,5.8);
      roadsideSign(place.distance-5,8.6*side,side<0?'← LOCAL STOP':'LOCAL STOP →',[place.name],4.6);
    }
    if(junction>=from&&junction<to){
      const sideRoad=new T.PlaneGeometry(42,7,22,4);
      sideRoad.rotateX(-Math.PI/2);
      sideRoad.translate(road(junction)-22,0,-junction);
      const points=sideRoad.attributes.position;
      for(let index=0;index<points.count;index++)points.setY(index,ground(points.getX(index),-points.getZ(index))+.06);
      sideRoad.computeVertexNormals();
      const item=mesh(sideRoad,seasons[options.season].road,group);
      item.userData.land='road';item.material.roughness=seasons[options.season].roughness;
      textureSurface(item,asphalt,2.7);
    }
    scene.add(group);chunks.set(segment,group);
  }
  let previousSegment=Infinity;
  function stream(distance:number){
    const segment=Math.floor(distance/span);
    if(segment===previousSegment)return;
    previousSegment=segment;
    renderer.shadowMap.needsUpdate=true;
    for(const [key,group] of chunks)if(Math.abs(key-segment)>2){scene.remove(group);dispose(group);chunks.delete(key);collisionChunks.delete(key);}
    for(let key=segment-2;key<=segment+2;key++)if(!chunks.has(key))chunk(key);
  }
  const jeep=new T.Group(); scene.add(jeep);
  function box(width:number,height:number,depth:number,color:string,x:number,y:number,z:number){const item=mesh(new T.BoxGeometry(width,height,depth),color,jeep);item.position.set(x,y,z);item.castShadow=true;return item;}
  box(1.57,.47,3.58,'#f6f1e3',0,.79,0); box(1.54,.23,1.24,'#f6f1e3',0,1.07,-1.1);box(1.67,.19,.19,'#292b2b',0,.52,1.83);box(1.67,.19,.19,'#292b2b',0,.52,-1.83);box(1.39,.13,.035,'#333532',0,.85,-1.8);
  for(const side of [-1,1]){box(.11,.38,1.5,'#f6f1e3',side*.74,1.08,.99);box(.045,.12,3.4,'#9f3325',side*.79,.88,0);box(.18,.13,.06,'#9c2521',side*.64,.84,1.81);box(.2,.2,.07,'#fff1cb',side*.59,.97,-1.81);box(.09,.66,.09,'#242728',side*.68,1.55,-.43);box(.09,.67,.09,'#242728',side*.68,1.48,.43);box(.09,.09,.96,'#242728',side*.68,1.81,0);box(.4,.46,.18,'#493b32',side*.34,1.26,.29);}
  box(1.35,.07,.08,'#222526',0,1.86,-.43);box(1.35,.07,.08,'#222526',0,1.81,.44);const glass=box(1.27,.49,.04,'#8dabb2',0,1.57,-.43);(glass.material as T.MeshStandardMaterial).transparent=true;(glass.material as T.MeshStandardMaterial).opacity=.48;glass.castShadow=false;
  const wheels:T.Mesh[]=[]; for(const x of [-.85,.85])for(const z of [-1.13,1.12]) {const tire=mesh(new T.CylinderGeometry(.39,.39,.24,20),'#242323',jeep);tire.geometry.rotateZ(Math.PI/2);tire.position.set(x,.41,z);tire.castShadow=true;wheels.push(tire);const hub=mesh(new T.CylinderGeometry(.19,.19,.252,12),'#9f9b8e',tire);hub.rotation.z=Math.PI/2;}
  const spare=mesh(new T.CylinderGeometry(.33,.33,.19,20),'#282727',jeep);spare.rotation.x=Math.PI/2;spare.position.set(.35,1.02,1.86);
  type VehicleModel={model:T.Group;tires:T.Object3D[];steerAxles:T.Object3D[]};
  const fleet:Record<Vehicle,VehicleModel>={
    jeep:{model:jeep,tires:wheels,steerAxles:[]},
    kekro:{model:new T.Group(),tires:[],steerAxles:[]},
    unique:{model:new T.Group(),tires:[],steerAxles:[]},
  };
  let disposed=false;
  const loader=new GLTFLoader();
  const files={jeep:'long-chassis',kekro:'kekro',unique:'unique70'} as const;
  for(const vehicle of Object.keys(files) as Vehicle[]){
    loader.load(import.meta.env.BASE_URL+'vehicles/'+files[vehicle]+'.glb',({scene:model})=>{
      if(disposed){dispose(model);return;}
      const tires:T.Object3D[]=[],steerAxles:T.Object3D[]=[];
      model.traverse(item=>{
        if(item.name.startsWith('Wheel_'))tires.push(item);
        if(item.name.startsWith('Steer_'))steerAxles.push(item);
        if(item instanceof T.Mesh){
          const materials=Array.isArray(item.material)?item.material:[item.material];
          item.castShadow=materials.every(material=>!material.transparent);
          item.receiveShadow=false;
        }
      });
      if(vehicle==='jeep'){scene.remove(jeep);dispose(jeep);}
      model.visible=false;
      scene.add(model);
      fleet[vehicle]={model,tires,steerAxles};
      options.vehicleLoad(vehicle,'ready');
      renderer.shadowMap.needsUpdate=true;
    },undefined,error=>{
      if(disposed)return;
      options.vehicleLoad(vehicle,'error');
      console.error('Could not load the '+vehicles[vehicle].name+' model',error);
    });
  }
  const dust=new T.Points(new T.BufferGeometry(),new T.PointsMaterial({color:'#dab584',size:.28,transparent:true,opacity:.35,depthWrite:false}));const particles=new Float32Array(90);dust.geometry.setAttribute('position',new T.BufferAttribute(particles,3));scene.add(dust);
  const keys=new Set<string>();
  let car=start(),orbit=0,zoom=0,last=performance.now(),lastReport=0,handle=0;
  let drag:number|undefined,returnAfter=0,followHeading=car.heading,followHeight=0;
  const down=(event:KeyboardEvent)=>{
    if(options.paused||isControl(event.target)){keys.clear();return;}
    if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(event.code))event.preventDefault();
    keys.add(event.code);
    if(event.code==='KeyR'&&!event.repeat)options.reset++;
  };
  const up=(event:KeyboardEvent)=>keys.delete(event.code);
  const release=(event?:PointerEvent)=>{
    if(event&&drag!==event.pointerId)return;
    drag=undefined;returnAfter=performance.now()+950;
  };
  const blur=()=>{keys.clear();release();};
  const pointer=(event:PointerEvent)=>{
    if(options.paused||drag!==undefined||event.button!==0)return;
    if(document.activeElement instanceof HTMLElement)document.activeElement.blur();
    drag=event.pointerId;renderer.domElement.setPointerCapture(event.pointerId);
  };
  const move=(event:PointerEvent)=>{
    if(event.pointerId===drag){orbit-=event.movementX*.007;orbit=Math.atan2(Math.sin(orbit),Math.cos(orbit));}
  };
  const wheel=(event:WheelEvent)=>{
    if(options.paused)return;
    event.preventDefault();zoom=T.MathUtils.clamp(zoom+event.deltaY*.009,-4,7);
  };
  const listeners=new AbortController(),signal=listeners.signal;
  window.addEventListener('keydown',down,{signal});window.addEventListener('keyup',up,{signal});window.addEventListener('blur',blur,{signal});
  renderer.domElement.addEventListener('pointerdown',pointer,{signal});
  renderer.domElement.addEventListener('pointerup',release,{signal});
  renderer.domElement.addEventListener('pointercancel',release,{signal});
  renderer.domElement.addEventListener('lostpointercapture',release,{signal});
  renderer.domElement.addEventListener('pointermove',move,{signal});
  renderer.domElement.addEventListener('wheel',wheel,{signal,passive:false});
  let pixelRatio=options.mobile?Math.min(1,devicePixelRatio):Math.min(1.5,devicePixelRatio);
  let frameAverage=16,qualityCheck=performance.now(),previewWidth=1,previewHeight=1;
  const resize=()=>{
    const width=host.clientWidth,height=host.clientHeight;
    if(!width||!height)return;
    renderer.setPixelRatio(pixelRatio);renderer.setSize(width,height);
    camera.aspect=titleCamera.aspect=previewCamera.aspect=width/height;camera.updateProjectionMatrix();
    titleCamera.setViewOffset(width,height,width<height?0:-width*.235,width<height?height*.17:0,width,height);
    previewWidth=width;previewHeight=height;
  };
  const observer=new ResizeObserver(resize);observer.observe(host);resize();
  const target=new T.Vector3();let first=true,previousTitle=options.title,reset=options.reset;
  let activeVehicle=options.vehicle;
  let run=newRun(options.mode),previousPreview=false,previousGarage=false,showroomAngle=0,showroomDistance=0;
  let previousPaused=options.paused;
  let steering=0,lastImpact=-Infinity;
  renderer.shadowMap.autoUpdate=false;
  let shadowVehicle:Vehicle|undefined,shadowParked:boolean|undefined;
  let shadowX=Infinity,shadowZ=Infinity,shadowHeading=Infinity;
  function frame(now:number){const elapsed=now-last,dt=Math.min(.18,elapsed/1000);last=now;
    const season=seasons[options.season];
    if(currentSeason!==options.season){
      currentSeason=options.season;
      sky.material.uniforms.horizon.value.set(season.horizon);
      sky.material.uniforms.zenith.value.set(season.zenith);
      sky.material.uniforms.glowStrength.value=currentSeason==='monsoon'?.13:1;
      sky.material.uniforms.cloudCover.value=currentSeason==='monsoon'?.68:0;
      const fog=scene.fog as T.FogExp2;
      fog.color.set(season.fog);fog.density=season.density;
      ambient.color.set(season.ambient);sun.intensity=season.light;
      tuneVegetation(currentSeason);
      for(const group of chunks.values())for(const item of group.children){
        if(item instanceof T.Mesh&&item.userData.land==='soil')item.material.color.set(season.soil);
        if(item instanceof T.Mesh&&item.userData.land==='grass'){
          item.visible=currentSeason==='summer'||currentSeason==='monsoon';
          item.material.color.set(currentSeason==='monsoon'?'#88994d':'#8d8b50');
        }
        if(item instanceof T.Mesh&&item.userData.land==='road'){
          item.material.color.set(season.road);item.material.roughness=season.roughness;
        }
      }
      renderer.shadowMap.needsUpdate=true;
    }
    const cameraDt=elapsed/1000;
    if(!document.hidden){
      frameAverage+=.055*(Math.min(elapsed,150)-frameAverage);
      if(now-qualityCheck>2400){
        const ceiling=Math.min(options.mobile?1:1.5,devicePixelRatio);
        const ratio=frameAverage>34?Math.max(Math.min(.65,ceiling),pixelRatio-.12):frameAverage<23?Math.min(ceiling,pixelRatio+.08):pixelRatio;
        if(ratio!==pixelRatio){pixelRatio=ratio;resize();}
        qualityCheck=now;
      }
    }
    if(previousTitle!==options.title){previousTitle=options.title;first=true;}
    if(reset!==options.reset){reset=options.reset;car=start();run=newRun(options.mode);steering=0;lastImpact=-Infinity;first=true;orbit=zoom=0;release();}
    if(activeVehicle!==options.vehicle){activeVehicle=options.vehicle;car.speed=0;if(!options.preview)first=true;orbit=zoom=0;release();}
    if(previousPreview!==options.preview||previousGarage!==options.garage){
      previousPreview=options.preview;previousGarage=options.garage;first=true;orbit=zoom=0;release();
      options.previewAngle=options.previewZoom=0;
    }
    const resumed=previousPaused&&!options.paused;
    if(previousPaused!==options.paused){
      previousPaused=options.paused;
      if(previousPaused){keys.clear();options.touch.clear();}
    }
    const touch=[...options.touch.values()];
    const steer=+(keys.has('KeyD')||keys.has('ArrowRight')||touch.includes('right'))-+(keys.has('KeyA')||keys.has('ArrowLeft')||touch.includes('left'));
    const throttle=keys.has('KeyW')||keys.has('ArrowUp')||touch.includes('throttle');
    const reverse=keys.has('KeyS')||keys.has('ArrowDown')||touch.includes('reverse');
    const parked=options.title;
    let travelled=0;
    if(options.finish&&run.mode==='explorer')run.outcome='finished';
    if(!options.paused&&!document.hidden&&!run.outcome){
      stream(car.position);
      const steps=Math.max(1,Math.ceil(dt*75)),stepTime=dt/steps,profile=vehicles[activeVehicle];
      const input={throttle,reverse,steer,brake:keys.has('Space')||touch.includes('brake')};
      for(let step=0;step<steps;step++){
        const clock=resumed?stepTime:elapsed/1000/steps;
        if(!tick(run,run.countdown>0?stepTime:clock)){
          if(run.outcome)break;
          continue;
        }
        steering=T.MathUtils.damp(steering,steer,12,stepTime);
        const {position,lateral}=car;
        advance(car,stepTime,{...input,steer:steering},activeVehicle,season.grip);
        const sin=Math.sin(car.heading),cos=Math.cos(car.heading);
        const movement=moveThrough({x:lateral+sin*profile.center,z:-position-cos*profile.center,
          width:profile.width,length:profile.length,sin:-sin,cos},car.lateral-lateral,position-car.position,collisionChunks.values());
        car.lateral=T.MathUtils.clamp(lateral+movement.dx,-110,110);
        car.position=T.MathUtils.clamp(position-movement.dz,0,LENGTH);
        travelled+=(car.lateral-lateral)*sin+(car.position-position)*cos;
        if(movement.impact>.0001){
          const impactSpeed=movement.impact/stepTime;
          if(impactSpeed>2&&now-lastImpact>950){
            run.impacts++;if(impactSpeed>=14)run.crashes++;
            lastImpact=now;
          }
          car.speed=Math.sign(car.speed)*Math.max(0,Math.abs(car.speed)-impactSpeed*.95);
        }
        if(!paved(car.lateral,car.position)&&Math.abs(car.speed)>.5)run.offRoad+=clock;
        checkpoint(run,visit(run.leg,car.position,car.lateral,run.mode==='race'||run.mode==='challenge'));
        run.progress=Math.max(run.progress,Math.min(checkpoints[run.leg+1]??LENGTH,car.position));
        discover(run,car);
        if(run.outcome)break;
      }
    }
    const shown=parked?displayCar:options.preview?previewCar:car;
    stream(shown.position);
    const visibleVehicle=parked?'jeep':activeVehicle;
    const {model,tires,steerAxles}=fleet[visibleVehicle];
    for(const entry of Object.values(fleet))entry.model.visible=entry.model===model;
    const y=ground(shown.lateral,shown.position);
    const detailed=visibleVehicle!=='jeep';
    const xSlope=Math.sin(shown.heading),zSlope=Math.cos(shown.heading);
    const pitch=detailed?Math.atan2(ground(shown.lateral+xSlope,shown.position+zSlope)-
      ground(shown.lateral-xSlope,shown.position-zSlope),2):0;
    model.position.set(shown.lateral,y+(detailed&&paved(shown.lateral,shown.position)?.075:0),-shown.position);
    model.rotation.set(pitch,-shown.heading,visibleVehicle==='unique'&&!options.paused?-steering*Math.min(.31,Math.abs(car.speed)*.023):0,'YXZ');
    for(const axle of steerAxles)axle.rotation.y=options.preview?0:-steering*(visibleVehicle==='unique'?.45:.36);
    for(const tire of tires)tire.rotation.x=(tire.rotation.x-travelled/vehicles[visibleVehicle].radius)%(2*Math.PI);
    if(parked){
      const drift=options.reducedMotion||options.mobile?0:Math.sin(now*.00025)*.14;
      const angle=shown.heading+.8+drift*.23;
      const distance=titleCamera.aspect<1?8.7:7.1;
      titleCamera.position.set(shown.lateral-Math.sin(angle)*distance,y+2.0+drift,-shown.position+Math.cos(angle)*distance);
      titleCamera.lookAt(shown.lateral,y+.98,-shown.position);
    }else if(options.preview){
      const area=options.previewFrame.current?.getBoundingClientRect();
      const width=previewWidth,height=previewHeight;
      const offsetX=area?(width-area.width)/2-area.left:0;
      const offsetY=area?(height-area.height)/2-area.top:0;
      if(previewCamera.view?.fullWidth!==width||previewCamera.view.fullHeight!==height||
        previewCamera.view.offsetX!==offsetX||previewCamera.view.offsetY!==offsetY){
        previewCamera.setViewOffset(width,height,offsetX,offsetY,width,height);
      }
      const profile=previewProfiles[activeVehicle];
      const compact=width<height||height<=500;
      const visibleRadius=Math.max(1,Math.min((area?.width??width)*(compact?.40:.48),(area?.height??height)*(compact?.44:.52)));
      const viewSlope=2*Math.tan(T.MathUtils.degToRad(previewCamera.fov/2))*visibleRadius/height;
      const fit=profile.radius*Math.hypot(1,1/viewSlope);
      const angle=shown.heading+(options.garage?profile.angle+options.previewAngle:previewAngles[options.mode]);
      const distance=fit*(options.garage?(detailed?1.09:1.16)-options.previewZoom*.29:1.06);
      showroomAngle=first||options.reducedMotion?angle:dampHeading(showroomAngle,angle,dt*2);
      showroomDistance=first||options.reducedMotion?distance:T.MathUtils.damp(showroomDistance,distance,12,dt);
      const framed=Math.max(fit,showroomDistance);
      previewCamera.position.set(shown.lateral-Math.sin(showroomAngle)*framed,y+profile.target+framed*.23,
        -shown.position+Math.cos(showroomAngle)*framed);
      previewCamera.lookAt(shown.lateral,y+profile.target,-shown.position);
      first=false;
    }else if(run.outcome==='finished'&&run.leg===stops.length-1){
      const distance=LENGTH-33,x=road(distance)-2.7;
      camera.position.set(x,ground(x,distance)+3.2,-distance);
      camera.lookAt(road(LENGTH-19),ground(road(LENGTH-19),LENGTH-19)+3.45,-(LENGTH-19));
    }else{
      if(options.recenter&&drag===undefined&&now>=returnAfter){
        orbit*=Math.exp(-Math.min(cameraDt,(now-returnAfter)/1000)*4);
      }
      followHeading=first?car.heading:dampHeading(followHeading,car.heading,cameraDt);
      const angle=followHeading+orbit,forwardX=Math.sin(angle),forwardZ=-Math.cos(angle);
      const profile=chaseProfiles[activeVehicle],distance=Math.max(profile.min,profile.distance+zoom);
      const x=car.lateral-forwardX*distance,z=-car.position-forwardZ*distance;
      const targetY=y+profile.target;
      let clearance=ground(x,-z)+.85;
      for(const fraction of [.25,.5,.75]){
        const terrain=ground(T.MathUtils.lerp(car.lateral,x,fraction),T.MathUtils.lerp(car.position,-z,fraction));
        clearance=Math.max(clearance,targetY+(terrain+.5-targetY)/fraction);
      }
      const height=Math.max(clearance,y+profile.height+(distance-profile.distance)*.22);
      followHeight=first?height:T.MathUtils.damp(followHeight,height,9,cameraDt);
      camera.position.set(x,Math.max(clearance,followHeight),z);
      target.set(car.lateral+forwardX*3.1,targetY,-car.position+forwardZ*3.1);
      camera.lookAt(target);first=false;
    }
    const view=parked?titleCamera:options.preview?previewCamera:camera;
    showroomFill.visible=options.preview;
    contact.visible=options.preview||detailed;
    if(contact.visible){
      const profile=vehicles[visibleVehicle];
      contact.position.set(shown.lateral+xSlope*profile.center,y+(paved(shown.lateral,shown.position)?.087:.012),
        -shown.position-zSlope*profile.center);
      contact.rotation.set(-Math.PI/2+pitch,-shown.heading,0);
      contact.scale.set(profile.width*3.2,profile.length*2.7,1);
    }
    if(options.preview){
      showroomFill.position.set(shown.lateral-3,y+4.4,-shown.position-3.3);
    }
    sky.position.copy(view.position);
    sun.position.set(shown.lateral-(parked?37:27),y+(parked?26:34),-shown.position-19);
    sun.color.set(season.sun);
    if(options.shadows&&(!sun.castShadow||shadowParked!==parked||shadowVehicle!==visibleVehicle||
      Math.hypot(shown.lateral-shadowX,shown.position-shadowZ)>.22||Math.abs(shown.heading-shadowHeading)>.025)){
      renderer.shadowMap.needsUpdate=true;
      shadowParked=parked;shadowVehicle=visibleVehicle;shadowX=shown.lateral;shadowZ=shown.position;shadowHeading=shown.heading;
    }
    sun.target.position.copy(model.position);sun.castShadow=options.shadows;
    dust.visible=!parked&&currentSeason!=='monsoon'&&Math.abs(car.speed)>3&&(!paved(car.lateral,car.position)||currentSeason==='dry'); if(dust.visible){for(let index=0;index<30;index++){const phase=(now*.001+index/30)%1, trail=1.5+phase*6;particles[index*3]=car.lateral-Math.sin(car.heading)*trail+Math.sin(index*51)*phase;particles[index*3+1]=y+.2+phase*.7;particles[index*3+2]=-car.position+Math.cos(car.heading)*trail;}dust.geometry.attributes.position.needsUpdate=true;dust.frustumCulled=false;}
    rain.visible=!parked&&currentSeason==='monsoon'&&!options.reducedMotion&&Math.floor(now/22000)%2===0;
    if(rain.visible){
      rain.position.copy(view.position);
      const count=options.mobile?75:180;
      rainGeometry.setDrawRange(0,count*2);
      for(let i=0;i<count;i++){
        const x=Math.sin(i*13.57)*16,z=Math.cos(i*27.12)*20;
        const drop=(((i*.618-now*.0017)%1+1)%1)*14-4;
        rainPoints.set([x,drop,z,x-.17,drop+.65,z+.06],i*6);
      }
      rainGeometry.attributes.position.needsUpdate=true;
    }
    renderer.render(scene,view);
    if(now-lastReport>100){
      const speed=Math.abs(car.speed)*3.6,progress=run.leg===stops.length-1?1:Math.min(.999,run.progress/LENGTH);
      report(speed,car.position,progress,{speed,throttle:throttle||reverse,sand:!paved(car.lateral,car.position),
        season:options.season,rain:rain.visible}, {...run});
      lastReport=now;
    }
    handle=requestAnimationFrame(frame);
  }
  handle=requestAnimationFrame(frame);
  return ()=>{disposed=true;cancelAnimationFrame(handle);observer.disconnect();listeners.abort();dispose(scene);if(environment)disposeEnvironment(environment);sand.dispose();asphalt.dispose();sun.shadow.dispose();renderer.dispose();renderer.domElement.remove();};
}
