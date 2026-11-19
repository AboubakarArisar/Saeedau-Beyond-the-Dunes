import React, {useEffect, useRef, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {mount} from './scene';
import {checkpoints,stops,vehicles,type Vehicle} from './driving';
import {createGameAudio,defaults,preference,savePreference,type AudioSettings,type Motion} from './gameAudio';
import {Radio,shortcuts,type Shortcuts} from './Radio';
import {Credits} from './Credits';
import {RotateScreen,TouchDrive,touchDevice,useMedia,type DriveAction} from './TouchDrive';
import type {Season} from './seasons';
import {Garage,JourneySetup} from './JourneyMenus';
import {discoveries,homecomingTarget,modes,newRun,places,raceTime,record,recordKey,score,type Mode,type Records,type Run} from './run';
import '@fontsource-variable/manrope';
import './style.css';
import './title.css';
import './hud.css';
import {coinValue} from './coins';

const time=(seconds:number)=>{
 const tenths=Math.floor(seconds*10);
 return `${Math.floor(tenths/600)}:${((tenths%600)/10).toFixed(1).padStart(4,'0')}`;
};

function App(){
 const host=useRef<HTMLDivElement>(null);
 const previewFrame=useRef<HTMLDivElement>(null);
 const [menu,setMenu]=useState('home');
 const [stats,setStats]=useState([0,0]);
 const [coinCount,setCoinCount]=useState(0);
 const [coinAward,setCoinAward]=useState(0);
 const displayedCoins=useRef(0);
 const [failed,setFailed]=useState(false);
 const [vehicleAssets,setVehicleAssets]=useState<Partial<Record<Vehicle,'ready'|'error'>>>({});
 const [vehicle,setVehicle]=useState<Vehicle>(()=>{
  const saved=preference<Vehicle>('vehicle','jeep');
  return Object.hasOwn(vehicles,saved)?saved:'jeep';
 });
 const [season,setSeason]=useState<Season>('summer');
 const [mode,setMode]=useState<Mode>('journey');
 const [run,setRun]=useState<Run>(()=>newRun('journey'));
 const [records,setRecords]=useState<Records>(()=>preference('records',{}));
 const recordsRef=useRef(records);
 const savedRun=useRef(false);
 const settingsBack=useRef('home');
 const garageBack=useRef('home');
 const [leg,setLeg]=useState(0);
 const [remaining,setRemaining]=useState<number>(checkpoints[1]);
 const [announcement,setAnnouncement]=useState('');
 const previousLeg=useRef(0);
 const announcedOrigin=useRef(false);
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
 const options=useRef({paused:true,shadows,vehicle,title:true,mobile,reducedMotion,touch:touch.current,reset:0,recenter,season,mode,preview:false,garage:false,finish:false,previewFrame,previewAngle:0,previewZoom:0,
  vehicleLoad:(key:Vehicle,status:'ready'|'error')=>setVehicleAssets(previous=>({...previous,[key]:status})),
  coinPickup:(count:number)=>{
   const delta=count-displayedCoins.current;
   displayedCoins.current=count;
   setCoinCount(count);setCoinAward(Math.max(0,delta)*coinValue);
   if(delta>0)sound.current?.pickup();
  },
 });
 options.current.paused=menu!==''||rotate;
 options.current.shadows=shadows;
 options.current.vehicle=vehicle;
 options.current.title=menu==='home'||menu==='credits';
 options.current.mobile=mobile;
 options.current.reducedMotion=reducedMotion;
 options.current.recenter=recenter;
 options.current.season=season;
 options.current.mode=mode;
 options.current.preview=menu==='garage'||menu==='setup';
 options.current.garage=menu==='garage';
 useEffect(()=>{
  if(!portrait)setPortraitOverride(false);
  touch.current.clear();
 },[portrait]);
 useEffect(()=>{
  const pause=()=>{touch.current.clear();setMenu(current=>current||'pause');};
  const hidden=()=>{if(document.hidden)pause();};
  let timer:number|undefined;
  const blur=()=>{
   touch.current.clear();
   clearTimeout(timer);
   timer=window.setTimeout(()=>{
    if(document.hidden||(mobile&&!document.activeElement?.closest('.rotate-screen')&&!document.activeElement?.matches('[data-radio] iframe')))pause();
   },0);
  };
  window.addEventListener('blur',blur);document.addEventListener('visibilitychange',hidden);
  return ()=>{clearTimeout(timer);window.removeEventListener('blur',blur);document.removeEventListener('visibilitychange',hidden);};
 },[mobile]);
 useEffect(()=>{if (!host.current) return; try{return mount(host.current,(speed,position,progress,telemetry,currentRun)=>{
  motion.current=telemetry;
  const checkpoint=currentRun.leg;
  setRun(currentRun);
  setStats([Math.round(speed),Math.floor(progress*100)]);
  setLeg(checkpoint);
  setRemaining(Math.ceil(Math.abs((checkpoints[checkpoint+1]??position)-position)));
  if(currentRun.outcome&&!savedRun.current){
   savedRun.current=true;
   if(currentRun.outcome==='finished'){
    const {vehicle,season}=options.current;
    const next=record(recordsRef.current,recordKey(currentRun.mode,vehicle,season),currentRun);
    recordsRef.current=next;setRecords(next);savePreference('records',next);
   }
   touch.current.clear();
   setMenu('results');
  }
 },options.current);}catch(error){console.error(error);setFailed(true);}},[]);
 useEffect(()=>{
  const previous=previousLeg.current;
  previousLeg.current=leg;
  if(leg!==previous)setAnnouncement(leg>previous?leg===stops.length-1?'Welcome to Saeedau':stops[leg]:'');
  if(leg<previous)announcedOrigin.current=false;
 },[leg]);
 useEffect(()=>{
  if(!announcement)return;
  const timer=window.setTimeout(()=>setAnnouncement(''),3500);
  return ()=>clearTimeout(timer);
 },[announcement,leg]);
 useEffect(()=>{const key=(event:KeyboardEvent)=>{
  if(event.code!=='Escape'||event.repeat)return;
  if(document.activeElement instanceof HTMLElement)document.activeElement.blur();
  touch.current.clear();
  setMenu(current=>current===''?'pause':current==='pause'?'':current==='settings'?settingsBack.current:current==='garage'?garageBack.current:'home');
 }; window.addEventListener('keydown',key);return ()=>window.removeEventListener('keydown',key);},[]);
 useEffect(()=>{savePreference('vehicle',vehicle);},[vehicle]);
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
  if(!announcedOrigin.current&&leg===0){announcedOrigin.current=true;setAnnouncement(stops[0]);}
  setMenu('');
 }
 function startRun(){
  if(vehicle!=='jeep'&&vehicleAssets[vehicle]!=='ready')return;
  savedRun.current=false;
  announcedOrigin.current=false;
  previousLeg.current=0;
  options.current.finish=false;
  displayedCoins.current=0;setCoinCount(0);setCoinAward(0);
  touch.current.clear();
  options.current.reset++;
  setRun(newRun(mode));setStats([0,0]);setLeg(0);setRemaining(checkpoints[1]);
  setAnnouncement(stops[0]);announcedOrigin.current=true;
  enter();
 }
 function exitRun(){
  if(window.confirm('Leave this run and return to the main menu?')){
   touch.current.clear();setMenu('home');
  }
 }
 const scored=score(run);
 const best=records[recordKey(mode,vehicle,season)];
 const found=discoveries(run.discoveries);
 const nextDiscovery=places.find(place=>!found.includes(place));
 const preview={
  frame:previewFrame,vehicle,selectVehicle:setVehicle,
  assetStatus:vehicle==='jeep'?'ready' as const:vehicleAssets[vehicle]??'loading' as const,
  orbit:(delta:number)=>{
   const angle=options.current.previewAngle+delta;
   options.current.previewAngle=Math.atan2(Math.sin(angle),Math.cos(angle));
  },
  zoom:(delta:number)=>{
   options.current.previewZoom=Math.max(-.35,Math.min(.55,options.current.previewZoom+delta));
  },
 };
 return <main className={mobile?'touch-layout':undefined}>
  <div className="world" ref={host}/>
  <div className="game-interface" inert={rotate}>
  {failed?<section className="panel"><h1>WebGL unavailable</h1><p>Enable hardware acceleration and reload to start driving.</p></section>:menu==='home'?<section className="title-screen">
    <div className="title-copy">
      <h1>saeedau.</h1><p className="title-subtitle">beyond the dunes</p>
      <p className="title-description">a journey through the heart of thar.</p>
      <button className="start-journey" onClick={()=>setMenu('setup')}>start journey</button>
      <nav className="title-nav" aria-label="Main menu">{['Garage','Settings','Credits'].map(label=><button key={label} onClick={()=>{settingsBack.current=garageBack.current='home';setMenu(label.toLowerCase());}}>{label}</button>)}</nav>
    </div>
  </section>:menu==='credits'?<Credits back={()=>setMenu('home')}/>:menu==='setup'?
   <JourneySetup {...preview} mode={mode} selectMode={setMode} season={season} selectSeason={setSeason}
    back={()=>setMenu('home')} garage={()=>{garageBack.current='setup';setMenu('garage');}} start={startRun}/>:
   menu==='garage'?<Garage {...preview} back={()=>setMenu(garageBack.current)}/>:menu==='results'?<section className="panel run-panel results-panel">
   <small>{modes[run.mode].name}</small>
   <h1>{run.outcome==='timeout'?'Time expired':run.villageStage===3?'Homecoming complete':run.leg===7?'Welcome to Saeedau':'Expedition complete'}</h1>
   <p><strong>{scored.total.toLocaleString()} points</strong>{best&&<> · Personal best {best.score.toLocaleString()}</>}</p>
   <p>{run.coins} {run.coins===1?'coin':'coins'} · {scored.breakdown.Coins} coin points{best?.coins!==undefined&&<> · Best {best.coins}</>}</p>
   {run.mode==='race'&&<p>Adjusted time {time(raceTime(run))} · Driving time {time(run.seconds)}{best?.time!==undefined&&<> · Personal best {time(best.time)}</>}</p>}
   {run.mode==='challenge'&&<p>{run.leg} / 7 checkpoints · {time(run.remaining)} remaining</p>}
   {run.mode==='explorer'&&<p>{found.length} / {places.length} discoveries{found.length>0&&<> · {found.map(place=>place.name).join(', ')}</>}</p>}
   <dl className="run-breakdown">{Object.entries(scored.breakdown).filter(([label,value])=>label!=='Coins'&&value!==0).map(([label,value])=><React.Fragment key={label}><dt>{label}</dt><dd>{value}</dd></React.Fragment>)}</dl>
   <nav><button onClick={startRun}>Play again</button><button onClick={()=>setMenu('setup')}>Journey setup</button><button onClick={()=>setMenu('home')}>Main menu</button></nav>
  </section>:menu?<section className="panel run-panel">
   <small>THAR DESERT / UMERKOT TO SAEEDAU</small><h1>{menu==='pause'?'Journey paused':'Settings'}</h1>
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
   {menu==='pause'&&run.mode==='explorer'&&<details open><summary>Discoveries · {found.length} / {places.length}</summary><ul>{places.map(place=><li key={place.name}>{found.includes(place)?'✓ ':''}{place.name}</li>)}</ul></details>}
   <nav>{menu==='pause'?<><button onClick={enter}>Resume</button><button onClick={()=>{if(window.confirm('Restart this run?'))startRun();}}>Restart</button><button onClick={()=>{settingsBack.current='pause';setMenu('settings');}}>Settings</button>
    {run.mode==='explorer'&&<button onClick={()=>{options.current.finish=true;}}>Finish expedition</button>}
    {run.mode==='journey'&&run.leg===7&&<button onClick={()=>{options.current.finish=true;}}>Finish journey</button>}<button onClick={exitRun}>Main menu</button></>:<button onClick={()=>setMenu(settingsBack.current)}>Back</button>}</nav>
  </section>:<>
   <aside className="hud" aria-label="Driving dashboard">
    <div className="hud-speed"><strong>{stats[0]}</strong><span>km/h</span></div>
    <small className="hud-vehicle">{vehicles[vehicle].name}</small>
    <div className="hud-route">
     <span>{modes[run.mode].name} · {scored.total} pts</span>
     {run.mode==='race'&&<span className="hud-distance">{run.countdown>0?'Starting in '+Math.ceil(run.countdown):time(raceTime(run))}</span>}
     {run.mode==='challenge'&&<span className="hud-distance">{time(run.remaining)} remaining</span>}
     {run.mode==='explorer'?<>
      <span className="hud-distance">{found.length} / {places.length} discoveries · Goal 5</span>
      <span className="hud-distance">{nextDiscovery?.name??'All locations discovered'}</span>
     </>:<>
     <span className={leg===stops.length-1?'arrival-label':undefined}>{leg===stops.length-1?'Arrived in Saeedau':`${stops[leg]} → ${stops[leg+1]}`}</span>
     <span className="hud-distance">{leg===stops.length-1?(homecomingTarget(run)??'Markan Faqeer House reached'):
      `${remaining>=1000?(remaining/1000).toFixed(1)+' km':remaining+' m'} to ${stops[leg+1]}`}</span>
     {leg===7&&<span className="hud-distance">{['Continue beyond the welcome gate','Go right at the junction','Use the village stopping area','Finish the journey from Pause'][run.villageStage]}</span>}
     <div className="hud-progress"><progress aria-label="Journey progress" value={stats[1]} max="100"/><span>{stats[1]}%</span></div>
     </>}
    </div>
   </aside>
   <div className="hud-coins" aria-live="polite" aria-label={`Coins ${coinCount}`}>
    <svg viewBox="0 0 32 32" width="25" height="25" aria-hidden="true">
     <circle cx="16" cy="16" r="13" fill="#dfa644" stroke="#ffda83" strokeWidth="2"/>
     <circle cx="16" cy="16" r="10.5" fill="#f3c464" stroke="#b47522"/>
     <path d="M8 20q4-10 8-5 4-7 8 4m-16 1q5-5 8-3 4-4 8 2" fill="none" stroke="#8f561a" strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
    <span key={coinCount} className={coinAward?'coin-digits coin-digits-pickup':'coin-digits'} aria-hidden="true">{String(coinCount).padStart(3,'0')}</span>
    {coinAward>0&&<span key={'award-'+coinCount} className="coin-award" aria-hidden="true">+{coinAward}</span>}
   </div>
   <button className="pause" onClick={()=>setMenu('pause')}>Pause</button>
   {run.countdown>0&&<div className="race-countdown" role="status">{Math.ceil(run.countdown)}</div>}
   {announcement&&<aside className="checkpoint-toast" role="status"><small>{leg===stops.length-1?'Saeedau arrival':leg===0?'Journey begins':'Checkpoint reached'}</small>{announcement}</aside>}
   {mobile?<TouchDrive inputs={touch.current} reset={()=>{touch.current.clear();options.current.reset++;}}/>:
    <aside className="drive-help"><button aria-expanded={controls} onClick={()=>setControls(!controls)}>{controls?'Hide controls':'Controls'}</button>
      {controls&&<p>WASD or arrows to drive · Space handbrake · Drag to orbit · Scroll to zoom · R reset · Esc pause</p>}
    </aside>}
  </>}
  <Radio visible={!failed&&!rotate&&!menu} volume={settings.mute?0:settings.master*settings.music} music={settings.music}
   setMusic={value=>adjust('music',value)} bindings={bindings}/>
  </div>
  {rotate&&<RotateScreen proceed={()=>setPortraitOverride(true)}/>}
 </main>;
}

createRoot(document.getElementById('root')!).render(<App/>);
