import React, {useEffect, useRef, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {mount} from './scene';
import {LEG,LENGTH,stops,vehicles,type Vehicle} from './driving';
import {createGameAudio,defaults,preference,savePreference,type AudioSettings,type Motion} from './gameAudio';
import {isControl,Radio,shortcuts,type Shortcuts} from './Radio';
import {RotateScreen,TouchDrive,touchDevice,useMedia,type DriveAction} from './TouchDrive';
import '@fontsource-variable/manrope';
import './style.css';
import './title.css';
import './hud.css';

function App(){
 const host=useRef<HTMLDivElement>(null);
 const [menu,setMenu]=useState('home');
 const [stats,setStats]=useState([0,0]);
 const [failed,setFailed]=useState(false);
 const [vehicle,setVehicle]=useState<Vehicle>('jeep');
 const [leg,setLeg]=useState(0);
 const [remaining,setRemaining]=useState(LEG);
 const [recenter,setRecenter]=useState(()=>preference('camera.recenter',true));
 const [controls,setControls]=useState(false);
 const mobile=useMedia(touchDevice),portrait=useMedia('(orientation: portrait)');
 const reducedMotion=useMedia('(prefers-reduced-motion: reduce)');
 const [portraitOverride,setPortraitOverride]=useState(false);
 const rotate=mobile&&portrait&&!portraitOverride&&!menu&&!failed;
 const touch=useRef(new Map<number,DriveAction>());
 const [shadows,setShadows]=useState(()=>preference('shadows',!matchMedia(touchDevice).matches));
 const [settings,setSettings]=useState(()=>({...defaults,...preference('audio',defaults)}));
 const [bindings,setBindings]=useState(()=>({...shortcuts,...preference('radio.keys',shortcuts)}));
 const [keyError,setKeyError]=useState('');
 const sound=useRef<ReturnType<typeof createGameAudio>|null>(null);
 const motion=useRef<Motion>({speed:0,sand:false,throttle:false});
 const options=useRef({paused:true,shadows,vehicle,title:true,mobile,reducedMotion,touch:touch.current,reset:0,recenter});
 options.current.paused=menu!==''||rotate;
 options.current.shadows=shadows;
 options.current.vehicle=vehicle;
 options.current.title=menu==='home';
 options.current.mobile=mobile;
 options.current.reducedMotion=reducedMotion;
 options.current.recenter=recenter;
 useEffect(()=>{
  if(!portrait)setPortraitOverride(false);
  touch.current.clear();
 },[portrait]);
 useEffect(()=>{
  const pause=()=>{touch.current.clear();if(mobile)setMenu(current=>current||'pause');};
  const hidden=()=>{if(document.hidden)pause();};
  let timer:number|undefined;
  const blur=()=>{
   touch.current.clear();
   clearTimeout(timer);
   timer=window.setTimeout(()=>{
    if(document.hidden||(!document.activeElement?.closest('.rotate-screen')&&!document.activeElement?.matches('[data-radio] iframe')))pause();
   },0);
  };
  window.addEventListener('blur',blur);document.addEventListener('visibilitychange',hidden);
  return ()=>{clearTimeout(timer);window.removeEventListener('blur',blur);document.removeEventListener('visibilitychange',hidden);};
 },[mobile]);
 useEffect(()=>{if (!host.current) return; try{return mount(host.current,(speed,progress,telemetry)=>{
  motion.current=telemetry;
  setStats([Math.round(speed),Math.floor(progress*100)]);
  setLeg(Math.floor(progress*(stops.length-1)));
  const position=progress*LENGTH;
  setRemaining(Math.ceil(Math.max(0,Math.min(LENGTH,(Math.floor(position/LEG)+1)*LEG)-position)));
 },options.current);}catch(error){console.error(error);setFailed(true);}},[]);
 useEffect(()=>{const key=(event:KeyboardEvent)=>{if(event.code==='Escape'&&!event.repeat&&!isControl(event.target))setMenu(current=>current?'':'pause');}; window.addEventListener('keydown',key);return ()=>window.removeEventListener('keydown',key);},[]);
 useEffect(()=>{savePreference('audio',settings);savePreference('radio.keys',bindings);},[settings,bindings]);
 useEffect(()=>()=>{sound.current?.dispose();sound.current=null;},[]);
 useEffect(()=>{
  const update=()=>sound.current?.update(settings,vehicle,motion.current,!menu&&!failed&&!rotate&&!document.hidden);
  update();
  const timer=window.setInterval(update,100);
  document.addEventListener('visibilitychange',update);
  return ()=>{clearInterval(timer);document.removeEventListener('visibilitychange',update);};
 },[settings,vehicle,menu,failed,rotate]);
 const adjust=<Key extends keyof AudioSettings>(key:Key,value:AudioSettings[Key])=>setSettings(previous=>({...previous,[key]:value}));
 function enter(){
  try{
   sound.current??=createGameAudio();
   void sound.current.resume().catch(error=>console.warn('Could not enable game audio',error));
  }catch(error){console.warn('Game sound is unavailable',error);}
  if(document.activeElement instanceof HTMLElement)document.activeElement.blur();
  setMenu('');
 }
 return <main className={mobile?'touch-layout':undefined}>
  <div className="world" ref={host}/>
  <div className="game-interface" inert={rotate}>
  {failed?<section className="panel"><h1>WebGL unavailable</h1><p>Enable hardware acceleration and reload to start driving.</p></section>:menu==='home'?<section className="title-screen">
    <div className="title-copy">
      <h1>saeedau.</h1><p className="title-subtitle">beyond the dunes</p>
      <p className="title-description">a journey through the heart of thar.</p>
      <button className="start-journey" onClick={enter}>start journey</button>
      <nav className="title-nav" aria-label="Main menu">{['Garage','Settings','Credits'].map(label=><button key={label} onClick={()=>setMenu(label.toLowerCase())}>{label}</button>)}</nav>
    </div>
  </section>:menu?<section className="panel">
   <small>THAR DESERT / UMERKOT TO SAEEDAU</small><h1>Saeedau<span>Beyond the Dunes</span></h1>
   {menu==='settings'&&<label><input type="checkbox" checked={shadows} onChange={event=>{setShadows(event.target.checked);localStorage.setItem('saeedau.shadows',String(event.target.checked));}}/> Dynamic shadows</label>}
   {menu==='settings'&&<p><label><input type="checkbox" checked={recenter} onChange={event=>{setRecenter(event.target.checked);savePreference('camera.recenter',event.target.checked);}}/> Recenter chase camera after orbiting</label></p>}
   {menu==='settings'&&<fieldset className="audio-settings"><legend>Audio</legend>
    {(['master','music','engine','environment'] as const).map(key=><label key={key}>{key[0].toUpperCase()+key.slice(1)} volume
     <input type="range" min="0" max="1" step=".01" value={settings[key]} onChange={event=>adjust(key,Number(event.target.value))}/>
    </label>)}
    <label><input type="checkbox" checked={settings.mute} onChange={event=>adjust('mute',event.target.checked)}/> Mute all audio</label>
    <details><summary>Radio shortcuts</summary>
     {(Object.keys(shortcuts) as (keyof Shortcuts)[]).map(key=><label key={key}>{key}
      <input aria-label={'Shortcut '+key} maxLength={1} value={bindings[key]} onFocus={event=>event.target.select()} onChange={event=>{
       const value=event.target.value.toLowerCase();
       if(value&&(!/^[a-z]$/.test(value)||'wasdr'.includes(value)||Object.entries(bindings).some(([action,letter])=>action!==key&&letter===value))){
        setKeyError('Use an unused letter, excluding W, A, S, D and R.');return;
       }
       setKeyError('');setBindings(previous=>({...previous,[key]:value}));
      }}/>
     </label>)}
     {keyError&&<p role="status">{keyError}</p>}
     <button onClick={()=>{setBindings(shortcuts);setKeyError('');}}>Restore defaults</button>
    </details>
   </fieldset>}
   {menu==='garage'&&<nav aria-label="Vehicle selection">{(Object.keys(vehicles) as Vehicle[]).map(key=><button key={key} aria-pressed={vehicle===key} onClick={()=>setVehicle(key)}>{vehicles[key].name}</button>)}</nav>}
   {menu==='credits'&&<p>An independent driving game set in Pakistan’s Thar Desert. The route is condensed and fictionalized, not intended for navigation.</p>}
   <nav>{menu==='pause'?<><button onClick={enter}>Resume</button>{['Garage','Settings','Credits'].map(label=><button key={label} onClick={()=>setMenu(label.toLowerCase())}>{label}</button>)}</>:<button onClick={()=>setMenu('home')}>Back</button>}</nav>
  </section>:<>
   <aside className="hud" aria-label="Driving dashboard">
    <div className="hud-speed"><strong>{stats[0]}</strong><span>km/h</span></div>
    <small className="hud-vehicle">{vehicles[vehicle].name}</small>
    <div className="hud-route">
     <span className={leg===stops.length-1?'arrival-label':undefined}>{leg===stops.length-1?'Arrived in Saeedau':`${stops[leg]} → ${stops[leg+1]}`}</span>
     <span className="hud-distance">{leg===stops.length-1?'Journey complete':`${remaining>=1000?(remaining/1000).toFixed(1)+' km':remaining+' m'} to ${stops[leg+1]}`}</span>
     <div className="hud-progress"><progress aria-label="Journey progress" value={stats[1]} max="100"/><span>{stats[1]}%</span></div>
    </div>
   </aside>
   <button className="pause" onClick={()=>setMenu('pause')}>Pause</button>
   {mobile?<TouchDrive inputs={touch.current} reset={()=>{options.current.reset++;}}/>:
    <aside className="drive-help"><button aria-expanded={controls} onClick={()=>setControls(!controls)}>{controls?'Hide controls':'Controls'}</button>
      {controls&&<p>WASD or arrows to drive · Space handbrake · Drag to orbit · Scroll to zoom · R reset · Esc pause</p>}
    </aside>}
  </>}
  <Radio visible={!failed&&!rotate&&(!menu||menu==='garage')} volume={settings.mute?0:settings.master*settings.music} music={settings.music}
   setMusic={value=>adjust('music',value)} bindings={bindings}/>
  </div>
  {rotate&&<RotateScreen proceed={()=>setPortraitOverride(true)}/>}
 </main>;
}

createRoot(document.getElementById('root')!).render(<App/>);
