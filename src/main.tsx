import React, {useEffect, useRef, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {mount} from './scene';
import {stops,vehicles,type Vehicle} from './driving';
import {createGameAudio,defaults,preference,savePreference,type AudioSettings,type Motion} from './gameAudio';
import {isControl,Radio,shortcuts,type Shortcuts} from './Radio';
import './style.css';

function App(){
 const host=useRef<HTMLDivElement>(null);
 const [menu,setMenu]=useState('home');
 const [stats,setStats]=useState([0,0]);
 const [failed,setFailed]=useState(false);
 const [vehicle,setVehicle]=useState<Vehicle>('jeep');
 const [leg,setLeg]=useState(0);
 const [shadows,setShadows]=useState(()=>localStorage.getItem('saeedau.shadows')!=='false');
 const [settings,setSettings]=useState(()=>({...defaults,...preference('audio',defaults)}));
 const [bindings,setBindings]=useState(()=>({...shortcuts,...preference('radio.keys',shortcuts)}));
 const [keyError,setKeyError]=useState('');
 const sound=useRef<ReturnType<typeof createGameAudio>|null>(null);
 const motion=useRef<Motion>({speed:0,sand:false,throttle:false});
 const options=useRef({paused:true,shadows,vehicle});
 options.current.paused=menu!=='';
 options.current.shadows=shadows;
 options.current.vehicle=vehicle;
 useEffect(()=>{if (!host.current) return; try{return mount(host.current,(speed,progress,telemetry)=>{
  motion.current=telemetry;
  setStats([Math.round(speed),Math.floor(progress*100)]);
  setLeg(Math.floor(progress*(stops.length-1)));
 },options.current);}catch(error){console.error(error);setFailed(true);}},[]);
 useEffect(()=>{const key=(event:KeyboardEvent)=>{if(event.code==='Escape'&&!event.repeat&&!isControl(event.target))setMenu(current=>current?'':'pause');}; window.addEventListener('keydown',key);return ()=>window.removeEventListener('keydown',key);},[]);
 useEffect(()=>{savePreference('audio',settings);savePreference('radio.keys',bindings);},[settings,bindings]);
 useEffect(()=>()=>{sound.current?.dispose();sound.current=null;},[]);
 useEffect(()=>{
  const update=()=>sound.current?.update(settings,vehicle,motion.current,!menu&&!failed&&!document.hidden);
  update();
  const timer=window.setInterval(update,100);
  document.addEventListener('visibilitychange',update);
  return ()=>{clearInterval(timer);document.removeEventListener('visibilitychange',update);};
 },[settings,vehicle,menu,failed]);
 const adjust=<Key extends keyof AudioSettings>(key:Key,value:AudioSettings[Key])=>setSettings(previous=>({...previous,[key]:value}));
 function enter(){
  try{
   sound.current??=createGameAudio();
   void sound.current.resume().catch(error=>console.warn('Could not enable game audio',error));
  }catch(error){console.warn('Game sound is unavailable',error);}
  if(document.activeElement instanceof HTMLElement)document.activeElement.blur();
  setMenu('');
 }
 return <main>
  <div className="world" ref={host}/>
  {failed?<section className="panel"><h1>WebGL unavailable</h1><p>Enable hardware acceleration and reload to start driving.</p></section>:menu?<section className="panel">
   <small>THAR DESERT / UMERKOT TO SAEEDAU</small><h1>Saeedau<span>Beyond the Dunes</span></h1>
   {menu==='settings'&&<label><input type="checkbox" checked={shadows} onChange={event=>{setShadows(event.target.checked);localStorage.setItem('saeedau.shadows',String(event.target.checked));}}/> Dynamic shadows</label>}
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
   <nav>{['home','pause'].includes(menu)?<><button onClick={enter}>{menu==='pause'?'Resume':'Play'}</button>{['Garage','Settings','Credits'].map(label=><button key={label} onClick={()=>setMenu(label.toLowerCase())}>{label}</button>)}</>:<button onClick={()=>setMenu('home')}>Back</button>}</nav>
  </section>:<>
   <aside className="hud"><small>{vehicles[vehicle].name}</small><strong>{stats[0]}</strong> km/h <progress aria-label="Journey progress" value={stats[1]} max="100"/><small>{leg===stops.length-1?'Arrived in Saeedau':`${stops[leg]} → ${stops[leg+1]}`}</small><small>{stats[1]}% OF ROUTE</small></aside>
   <button className="pause" onClick={()=>setMenu('pause')}>Pause</button>
   <aside className="keys">WASD / arrows · Space handbrake · Drag to orbit · Scroll to zoom · R reset</aside>
  </>}
  <Radio visible={!failed&&(!menu||menu==='garage')} volume={settings.mute?0:settings.master*settings.music} music={settings.music}
   setMusic={value=>adjust('music',value)} bindings={bindings}/>
 </main>;
}

createRoot(document.getElementById('root')!).render(<App/>);
