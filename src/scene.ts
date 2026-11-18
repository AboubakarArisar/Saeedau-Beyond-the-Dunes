import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import type {Motion} from './gameAudio';
import type {DriveAction} from './TouchDrive';
import {isControl} from './Radio';
import {decorate,disposeEnvironment,loadEnvironment,type Environment} from './environment';
import { LENGTH, LEG, stops, ground, road, start, advance, vehicles, chaseProfiles, dampHeading, type Vehicle } from './driving';

export function mount(host: HTMLElement, report: (speed: number, progress: number, motion:Motion) => void, options: {
  paused:boolean;shadows:boolean;vehicle:Vehicle;title:boolean;mobile:boolean;reducedMotion:boolean;
  touch:Map<number,DriveAction>;reset:number;recenter:boolean;
}) {
  const scene = new T.Scene(); scene.fog = new T.FogExp2('#d1cdbd', .0022);
  const renderer = new T.WebGLRenderer({antialias:true}); renderer.setPixelRatio(Math.min(1.5, devicePixelRatio)); renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap; renderer.toneMapping = T.ACESFilmicToneMapping; host.append(renderer.domElement);
  const camera = new T.PerspectiveCamera(52,1,.15,850);
  const titleCamera=new T.PerspectiveCamera(43,1,.15,850);
  const displayCar=start();
  scene.add(new T.HemisphereLight('#dcecff','#b4906c',1.65));
  const sun = new T.DirectionalLight('#ffebcf',2.5); sun.shadow.mapSize.set(1024,1024); Object.assign(sun.shadow.camera,{left:-25,right:25,top:25,bottom:-25,far:110}); sun.shadow.normalBias=.045; scene.add(sun,sun.target);
  const sky = new T.Mesh(new T.SphereGeometry(780,24,12),new T.ShaderMaterial({
    side:T.BackSide,depthWrite:false,
    vertexShader:'varying vec3 direction; void main(){direction=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:`varying vec3 direction; void main(){
      vec3 ray=normalize(direction);
      float height=max(ray.y,0.);
      vec3 color=mix(vec3(.69,.72,.71),vec3(.24,.49,.72),smoothstep(0.,.45,height));
      float glow=pow(max(dot(ray,normalize(vec3(-.57,.43,-.70))),0.),12.);
      gl_FragColor=vec4(color+vec3(.32,.19,.08)*glow,1.);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
  }));scene.add(sky);
  function mesh(geometry:T.BufferGeometry,color:string,parent:T.Object3D=scene) {const item=new T.Mesh(geometry,new T.MeshStandardMaterial({color,roughness:.91})); item.receiveShadow=true; parent.add(item); return item;}
  const span=320, chunks=new Map<number,T.Group>();
  let environment:Environment|undefined;
  loadEnvironment().then(assets=>{
    if(disposed){disposeEnvironment(assets);return;}
    environment=assets;
    for(const [key,group] of chunks)decorate(group,assets,key*span,(key+1)*span);
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
  const dispose=(root:T.Object3D)=>root.traverse(item=>{if(item instanceof T.InstancedMesh){item.dispose();if(item.userData.sharedEnvironment)return;}if(item instanceof T.Mesh||item instanceof T.Points){item.geometry.dispose();for(const material of Array.isArray(item.material)?item.material:[item.material]){if(material.map&&material.map!==sand&&material.map!==asphalt)material.map.dispose();material.dispose();}}});
  function chunk(segment:number){
    const group=new T.Group(),from=segment*span,to=from+span;
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
    soil.material.vertexColors=true;
    textureSurface(soil,sand,5.8);
    soil.material.bumpMap=sand;soil.material.bumpScale=.12;
    function strip(offset:number,width:number,color:string,ranges:number[][]){
      const vertices:number[]=[],indices:number[]=[];
      for(const [begin,end] of ranges){
        const count=Math.ceil((end-begin)/4);
        for(let index=0;index<=count;index++){
          const distance=begin+(end-begin)*index/count,base=vertices.length/3;
          for(const side of [-1,1]){
            const lateral=road(distance)+offset+side*width/2;
            const elevation=width<1?.103:width===9?.075:.015;
            vertices.push(lateral,ground(lateral,distance)+elevation,-distance);
          }
          if(index)indices.push(base-2,base-1,base,base-1,base+1,base);
        }
      }
      const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(vertices,3));geometry.setIndex(indices);geometry.computeVertexNormals();
      const item=mesh(geometry,color,group);
      if(width>=1)textureSurface(item,width===9?asphalt:sand,width===9?2.7:5.8);
    }
    if(from>=0&&from<LENGTH){
      strip(-5.08,1.4,'#ac875f',[[from,to]]);strip(5.08,1.4,'#ac875f',[[from,to]]);
      strip(0,9,'#5f5b56',[[from,to]]);strip(-4,.10,'#ddbc6c',[[from,to]]);strip(4,.10,'#ddbc6c',[[from,to]]);
      strip(0,.13,'#eadbb5',Array.from({length:span/16},(_,index)=>[from+index*16+4,from+index*16+10]));
    }
    if(environment)decorate(group,environment,from,to);
    stops.forEach((name,index)=>{
      const distance=index*LEG;
      if(distance<from||distance>=to)return;
      const lateral=road(distance)+6,elevation=ground(lateral,distance);
      const board=document.createElement('canvas');board.width=512;board.height=128;
      const context=board.getContext('2d');
      if(context){
        context.fillStyle='#24554b';context.fillRect(0,0,512,128);context.strokeStyle='#f9eac7';context.lineWidth=6;context.strokeRect(8,8,496,112);context.fillStyle='#ffffff';context.font='bold 42px sans-serif';context.textAlign='center';context.textBaseline='middle';context.fillText(name,256,65,470);
        const texture=new T.CanvasTexture(board);texture.colorSpace=T.SRGBColorSpace;
        const sign=new T.Mesh(new T.BoxGeometry(3.8,.95,.06),new T.MeshBasicMaterial({map:texture}));sign.position.set(lateral,elevation+2.4,-distance);group.add(sign);
      }
      mesh(new T.BoxGeometry(.13,2,.13),'#6b6456',group).position.set(lateral,elevation+1,-distance);
    });
    scene.add(group);chunks.set(segment,group);
  }
  let previousSegment=Infinity;
  function stream(distance:number){
    const segment=Math.floor(distance/span);
    if(segment===previousSegment)return;
    previousSegment=segment;
    for(const [key,group] of chunks)if(Math.abs(key-segment)>2){scene.remove(group);dispose(group);chunks.delete(key);}
    for(let key=segment-2;key<=segment+2;key++)if(!chunks.has(key))chunk(key);
  }
  const jeep=new T.Group(); scene.add(jeep);
  function box(width:number,height:number,depth:number,color:string,x:number,y:number,z:number){const item=mesh(new T.BoxGeometry(width,height,depth),color,jeep);item.position.set(x,y,z);item.castShadow=true;return item;}
  box(1.57,.47,3.58,'#f6f1e3',0,.79,0); box(1.54,.23,1.24,'#f6f1e3',0,1.07,-1.1);box(1.67,.19,.19,'#292b2b',0,.52,1.83);box(1.67,.19,.19,'#292b2b',0,.52,-1.83);box(1.39,.13,.035,'#333532',0,.85,-1.8);
  for(const side of [-1,1]){box(.11,.38,1.5,'#f6f1e3',side*.74,1.08,.99);box(.045,.12,3.4,'#9f3325',side*.79,.88,0);box(.18,.13,.06,'#9c2521',side*.64,.84,1.81);box(.2,.2,.07,'#fff1cb',side*.59,.97,-1.81);box(.09,.66,.09,'#242728',side*.68,1.55,-.43);box(.09,.67,.09,'#242728',side*.68,1.48,.43);box(.09,.09,.96,'#242728',side*.68,1.81,0);box(.4,.46,.18,'#493b32',side*.34,1.26,.29);}
  box(1.35,.07,.08,'#222526',0,1.86,-.43);box(1.35,.07,.08,'#222526',0,1.81,.44);const glass=box(1.27,.49,.04,'#8dabb2',0,1.57,-.43);(glass.material as T.MeshStandardMaterial).transparent=true;(glass.material as T.MeshStandardMaterial).opacity=.48;glass.castShadow=false;
  const wheels:T.Mesh[]=[]; for(const x of [-.85,.85])for(const z of [-1.13,1.12]) {const tire=mesh(new T.CylinderGeometry(.39,.39,.24,20),'#242323',jeep);tire.geometry.rotateZ(Math.PI/2);tire.position.set(x,.41,z);tire.castShadow=true;wheels.push(tire);const hub=mesh(new T.CylinderGeometry(.19,.19,.252,12),'#9f9b8e',tire);hub.rotation.z=Math.PI/2;}
  const spare=mesh(new T.CylinderGeometry(.33,.33,.19,20),'#282727',jeep);spare.rotation.x=Math.PI/2;spare.position.set(.35,1.02,1.86);
  function alternate(vehicle:'kekro'|'unique'){
    const model=new T.Group();scene.add(model);
    const part=(size:[number,number,number],position:[number,number,number],color:string)=>{
      const object=mesh(new T.BoxGeometry(...size),color,model);object.position.set(...position);object.castShadow=true;return object;
    };
    const tires:T.Mesh[]=[],radius=vehicles[vehicle].radius;
    const truck=vehicle==='kekro';
    for(const lateral of truck?[-1,1]:[0])for(const depth of truck?[-1.45,1.38]:[-.73,.67]){
      const tire=mesh(new T.CylinderGeometry(radius,radius,truck?.32:.09,24),'#242322',model);tire.geometry.rotateZ(Math.PI/2);tire.position.set(lateral,radius,depth);tire.castShadow=true;tires.push(tire);
      const rim=mesh(new T.CylinderGeometry(radius*.64,radius*.64,truck?.33:.095,16),'#b4aaa0',tire);rim.rotation.z=Math.PI/2;
    }
    if(truck){
      part([2,.37,4.5],[0,.78,0],'#656457');
      part([1.92,1.15,1.43],[0,1.53,-1.32],'#2e746b');
      part([1.72,.43,.04],[0,1.73,-2.05],'#86a9aa');
      part([1.99,.12,1.56],[0,2.12,-1.32],'#d2ba76');
      part([1.95,.16,2.55],[0,1,.82],'#a27a4e');
      for(const side of [-1,1]){
        part([.1,.57,2.55],[side*.93,1.28,.82],'#42736b');
        part([.22,.13,.06],[side*.69,.85,2.26],'#a02f25');
        part([.23,.2,.06],[side*.73,1.17,-2.06],'#fff2ca');
      }
      part([1.94,.47,.12],[0,1.29,2.1],'#3c6a61');
    }else{
      part([.18,.25,1.05],[0,.55,0],'#3b3b38');
      part([.3,.24,.51],[0,.83,-.27],'#a52b25');
      part([.27,.1,.52],[0,.85,.26],'#292829');
      for(const side of [-1,1]){
        part([.055,.67,.055],[side*.075,.61,-.65],'#bdb6a9').rotation.x=.23;
        part([.045,.43,.045],[side*.09,.49,.45],'#a4a097').rotation.x=1;
      }
      part([.57,.045,.055],[0,1.07,-.53],'#55524b');
      part([.17,.14,.11],[0,.94,-.65],'#fff3d1');
      part([.14,.07,.055],[0,.78,.56],'#bb2f25');
      part([.07,.09,.69],[.14,.42,.29],'#b5aaa0');
    }
    return {model,tires};
  }
  const fleet:Record<Vehicle,{model:T.Group;tires:T.Object3D[]}>={
    jeep:{model:jeep,tires:wheels},kekro:alternate('kekro'),unique:alternate('unique'),
  };
  let disposed=false;
  new GLTFLoader().load(import.meta.env.BASE_URL+'vehicles/long-chassis.glb',({scene:model})=>{
    if(disposed){dispose(model);return;}
    const tires:T.Object3D[]=[];
    model.traverse(item=>{
      if(item.name.startsWith('Wheel_'))tires.push(item);
      if(item instanceof T.Mesh){
        item.castShadow=!item.material.transparent;
        item.receiveShadow=false;
      }
    });
    scene.remove(jeep);dispose(jeep);scene.add(model);
    fleet.jeep={model,tires};
  },undefined,error=>{console.error('Could not load the Long Chassis model',error);});
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
  let frameAverage=16,qualityCheck=performance.now();
  const resize=()=>{
    const width=host.clientWidth,height=host.clientHeight;
    if(!width||!height)return;
    renderer.setPixelRatio(pixelRatio);renderer.setSize(width,height);
    camera.aspect=titleCamera.aspect=width/height;camera.updateProjectionMatrix();
    titleCamera.setViewOffset(width,height,width<height?0:-width*.235,width<height?height*.17:0,width,height);
  };
  const observer=new ResizeObserver(resize);observer.observe(host);resize();
  const target=new T.Vector3();let first=true,previousTitle=options.title,reset=options.reset;
  let activeVehicle=options.vehicle;
  function frame(now:number){const elapsed=now-last,dt=Math.min(.045,elapsed/1000);last=now;
    const cameraDt=elapsed/1000;
    if(options.mobile&&!document.hidden){
      frameAverage+=.055*(Math.min(elapsed,150)-frameAverage);
      if(now-qualityCheck>2400){
        const ratio=frameAverage>34?Math.max(.6,pixelRatio-.12):frameAverage<23?Math.min(1,devicePixelRatio,pixelRatio+.08):pixelRatio;
        if(ratio!==pixelRatio){pixelRatio=ratio;resize();}
        qualityCheck=now;
      }
    }
    if(previousTitle!==options.title){previousTitle=options.title;first=true;}
    if(reset!==options.reset){reset=options.reset;car=start();first=true;orbit=zoom=0;keys.clear();release();options.touch.clear();}
    if(activeVehicle!==options.vehicle){activeVehicle=options.vehicle;car.speed=0;first=true;orbit=zoom=0;release();}
    const touch=[...options.touch.values()];
    const steer=+(keys.has('KeyD')||keys.has('ArrowRight')||touch.includes('right'))-+(keys.has('KeyA')||keys.has('ArrowLeft')||touch.includes('left'));
    const throttle=keys.has('KeyW')||keys.has('ArrowUp')||touch.includes('throttle');
    const reverse=keys.has('KeyS')||keys.has('ArrowDown')||touch.includes('reverse');
    const parked=options.title;
    if(!options.paused&&!document.hidden)advance(car,dt,{throttle,reverse,steer,brake:keys.has('Space')||touch.includes('brake')},activeVehicle);
    const shown=parked?displayCar:car;
    stream(shown.position);
    const {model,tires}=fleet[parked?'jeep':activeVehicle];
    for(const entry of Object.values(fleet))entry.model.visible=entry.model===model;
    const y=ground(shown.lateral,shown.position);model.position.set(shown.lateral,y,-shown.position);model.rotation.set(0,-shown.heading,activeVehicle==='unique'&&!options.paused?-steer*Math.min(.35,Math.abs(car.speed)*.025):0,'YXZ');
    if(!options.paused)for(const tire of tires)tire.rotation.x-=car.speed*dt/vehicles[activeVehicle].radius;
    if(parked){
      const drift=options.reducedMotion||options.mobile?0:Math.sin(now*.00025)*.14;
      const angle=shown.heading+.8+drift*.23;
      const distance=titleCamera.aspect<1?8.7:7.1;
      titleCamera.position.set(shown.lateral-Math.sin(angle)*distance,y+2.0+drift,-shown.position+Math.cos(angle)*distance);
      titleCamera.lookAt(shown.lateral,y+.98,-shown.position);
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
    const view=parked?titleCamera:camera;
    sky.position.copy(view.position);
    sun.position.set(shown.lateral-(parked?37:27),y+(parked?26:34),-shown.position-19);
    sun.color.set(parked?'#ffe0b5':'#ffebcf');
    sun.target.position.copy(model.position);sun.castShadow=options.shadows;
    dust.visible=!parked&&Math.abs(car.speed)>3; if(dust.visible){for(let index=0;index<30;index++){const phase=(now*.001+index/30)%1, trail=1.5+phase*6;particles[index*3]=car.lateral-Math.sin(car.heading)*trail+Math.sin(index*51)*phase;particles[index*3+1]=y+.2+phase*.7;particles[index*3+2]=-car.position+Math.cos(car.heading)*trail;}dust.geometry.attributes.position.needsUpdate=true;dust.frustumCulled=false;}
    renderer.render(scene,view);
    if(now-lastReport>100){const speed=Math.abs(car.speed)*3.6;report(speed,car.position/LENGTH,{speed,throttle:throttle||reverse,sand:Math.abs(car.lateral-road(car.position))>4});lastReport=now;}
    handle=requestAnimationFrame(frame);
  }
  handle=requestAnimationFrame(frame);
  return ()=>{disposed=true;cancelAnimationFrame(handle);observer.disconnect();listeners.abort();dispose(scene);if(environment)disposeEnvironment(environment);sand.dispose();asphalt.dispose();sun.shadow.dispose();renderer.dispose();renderer.domElement.remove();};
}
