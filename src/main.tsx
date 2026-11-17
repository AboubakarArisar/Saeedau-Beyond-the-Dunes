import React, {useEffect, useRef, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {mount} from './scene';
import {stops,vehicles,type Vehicle} from './driving';
import './style.css';

function App(){
 const host=useRef<HTMLDivElement>(null);
 const [menu,setMenu]=useState('home');
 const [stats,setStats]=useState([0,0]);
 const [failed,setFailed]=useState(false);
 const [vehicle,setVehicle]=useState<Vehicle>('jeep');
 const [leg,setLeg]=useState(0);
 const [shadows,setShadows]=useState(()=>localStorage.getItem('saeedau.shadows')!=='false');
 const options=useRef({paused:true,shadows,vehicle});
 options.current.paused=menu!=='';
 options.current.shadows=shadows;
 options.current.vehicle=vehicle;
 useEffect(()=>{if (!host.current) return; try{return mount(host.current,(speed,progress)=>{
  setStats([Math.round(speed),Math.floor(progress*100)]);
  setLeg(Math.floor(progress*(stops.length-1)));
 },options.current);}catch(error){console.error(error);setFailed(true);}},[]);
 useEffect(()=>{const key=(event:KeyboardEvent)=>{if(event.code==='Escape'&&!event.repeat)setMenu(current=>current?'':'pause');}; window.addEventListener('keydown',key);return ()=>window.removeEventListener('keydown',key);},[]);
 return <main>
  <div className="world" ref={host}/>
  {failed?<section className="panel"><h1>WebGL unavailable</h1><p>Enable hardware acceleration and reload to start driving.</p></section>:menu?<section className="panel">
   <small>THAR DESERT / UMERKOT TO SAEEDAU</small><h1>Saeedau<span>Beyond the Dunes</span></h1>
   {menu==='settings'&&<label><input type="checkbox" checked={shadows} onChange={event=>{setShadows(event.target.checked);localStorage.setItem('saeedau.shadows',String(event.target.checked));}}/> Dynamic shadows</label>}
   {menu==='garage'&&<nav aria-label="Vehicle selection">{(Object.keys(vehicles) as Vehicle[]).map(key=><button key={key} aria-pressed={vehicle===key} onClick={()=>setVehicle(key)}>{vehicles[key].name}</button>)}</nav>}
   {menu==='credits'&&<p>An independent driving game set in Pakistan’s Thar Desert. The route is condensed and fictionalized, not intended for navigation.</p>}
   <nav>{['home','pause'].includes(menu)?<><button onClick={()=>setMenu('')}>{menu==='pause'?'Resume':'Play'}</button>{['Garage','Settings','Credits'].map(label=><button key={label} onClick={()=>setMenu(label.toLowerCase())}>{label}</button>)}</>:<button onClick={()=>setMenu('home')}>Back</button>}</nav>
  </section>:<>
   <aside className="hud"><small>{vehicles[vehicle].name}</small><strong>{stats[0]}</strong> km/h <progress aria-label="Journey progress" value={stats[1]} max="100"/><small>{leg===stops.length-1?'Arrived in Saeedau':`${stops[leg]} → ${stops[leg+1]}`}</small><small>{stats[1]}% OF ROUTE</small></aside>
   <button className="pause" onClick={()=>setMenu('pause')}>Pause</button>
   <aside className="keys">WASD / arrows · Space handbrake · Drag to orbit · Scroll to zoom · R reset</aside>
  </>}
 </main>;
}

createRoot(document.getElementById('root')!).render(<App/>);
