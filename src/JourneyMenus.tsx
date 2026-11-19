import {useRef,type PointerEvent,type RefObject} from 'react';
import {vehicles,type Vehicle} from './driving';
import {modes,type Mode} from './run';
import {journeyLocations,type JourneySelection} from './customJourney';
import type {Season} from './seasons';
import './journey-menus.css';

const fleet=['kekro','jeep','unique'] as const;
const modeOrder=['journey','race','challenge','explorer','custom'] as const;
const vehicleCopy={
  kekro:{name:'Kekro',description:'Local transport / Tharparkar',handling:'Steady'},
  jeep:{name:'Long Chassis',description:'The classic desert ride',handling:'Balanced'},
  unique:{name:'Unique 70',description:'The everyday explorer',handling:'Agile'},
};
const modeCopy={
  custom:{tagline:'Your start. Your destination.',icon:'M8 5H6a3 3 0 0 0 0 6h11a3 3 0 0 1 0 6h-5m0 0 3-3m-3 3 3 3M8 2l3 3-3 3'},
  journey:{tagline:'The road is yours.',icon:'M6 20 10 4m8 16L14 4m-2 5v3m0 3v3'},
  race:{tagline:'Race against time.',icon:'M4 21V4m0 1c4-4 8 4 15 0v10c-7 4-11-4-15 0m7-11v10m4-9v10M4 10c4-4 8 4 15 0'},
  challenge:{tagline:'Every second counts.',icon:'M9 2h6m-3 10 3-3m3-5 2 2m0 7a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z'},
  explorer:{tagline:'Discover the unseen Thar.',icon:'M20 12a8 8 0 1 1-16 0 8 8 0 0 1 16 0ZM15 9l-1.6 4.4L9 15l1.6-4.4L15 9Z'},
};
const seasonChoices=[['summer','Summer'],['winter','Winter'],['monsoon','Monsoon'],['dry','Dry']] as const;

function Arrow({left=false}:{left?:boolean}){
  return <svg viewBox="0 0 24 24" width="24" height="24" fill="none" aria-hidden="true">
    <path d={left?'m14 5-7 7 7 7':'m10 5 7 7-7 7'} stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>;
}

function VehicleSelector({vehicle,change}:{vehicle:Vehicle;change:(amount:number)=>void}){
  const start=useRef<number|null>(null);
  return <div className="vehicle-carousel" role="group" aria-label="Vehicle selection"
    onTouchStart={event=>{start.current=event.touches[0].clientX;}}
    onTouchEnd={event=>{
      const delta=event.changedTouches[0].clientX-(start.current??event.changedTouches[0].clientX);
      start.current=null;
      if(Math.abs(delta)>40)change(delta<0?1:-1);
    }} onTouchCancel={()=>{start.current=null;}}>
    <button className="showroom-arrow" aria-label="Previous vehicle" onClick={()=>change(-1)}><Arrow left/></button>
    <div className="vehicle-current" aria-live="polite">
      <strong>{vehicleCopy[vehicle].name}</strong>
      <span className="vehicle-indicator" role="img" aria-label={`Vehicle ${fleet.indexOf(vehicle)+1} of ${fleet.length}`}>
        {fleet.map(key=><i key={key} data-active={key===vehicle}/>)}
      </span>
    </div>
    <button className="showroom-arrow" aria-label="Next vehicle" onClick={()=>change(1)}><Arrow/></button>
  </div>;
}

type PreviewProps={frame:RefObject<HTMLDivElement|null>;orbit:(delta:number)=>void;zoom:(delta:number)=>void;assetStatus:'ready'|'loading'|'error'};
const assetMessage={ready:'',loading:'Loading vehicle…',error:'Vehicle unavailable. Choose another vehicle or reload.'};
function Showroom({frame,orbit,zoom,assetStatus}:PreviewProps){
  const pointers=useRef(new Map<number, {x:number;y:number}>());
  const pinchDistance=()=>{
    const [a,b]=pointers.current.values();
    return a&&b?Math.hypot(a.x-b.x,a.y-b.y):0;
  };
  function move(event:PointerEvent<HTMLDivElement>){
    const previous=pointers.current.get(event.pointerId);
    if(!previous)return;
    const before=pinchDistance();
    pointers.current.set(event.pointerId,{x:event.clientX,y:event.clientY});
    if(before)zoom((pinchDistance()-before)*.004);
    else orbit((event.clientX-previous.x)*-.009);
  }
  const release=(event:PointerEvent<HTMLDivElement>)=>{pointers.current.delete(event.pointerId);};
  return <div className="showroom" ref={frame} role="region" aria-label="Interactive 3D vehicle preview" aria-describedby="showroom-hint" tabIndex={0}
    onPointerDown={event=>{
      if(event.button!==0||pointers.current.size>=2)return;
      event.currentTarget.setPointerCapture(event.pointerId);
      pointers.current.set(event.pointerId,{x:event.clientX,y:event.clientY});
    }} onPointerMove={move} onPointerUp={release} onPointerCancel={release} onLostPointerCapture={release}
    onWheel={event=>zoom(-event.deltaY*.0018)}
    onKeyDown={event=>{
      if(event.key==='ArrowLeft'||event.key==='ArrowRight')orbit(event.key==='ArrowLeft'?.25:-.25);
      else if(event.key==='+'||event.key==='=')zoom(.14);
      else if(event.key==='-')zoom(-.14);
      else return;
      event.preventDefault();event.stopPropagation();
    }}>{assetStatus!=='ready'&&<p role="status">{assetMessage[assetStatus]}</p>}</div>
}

type MenuProps=PreviewProps&{vehicle:Vehicle;selectVehicle:(vehicle:Vehicle)=>void;back:()=>void};
function cycle(vehicle:Vehicle,delta:number){
  return fleet[(fleet.indexOf(vehicle)+delta+fleet.length)%fleet.length];
}

export function JourneySetup({vehicle,selectVehicle,back,frame,assetStatus,mode,selectMode,season,selectSeason,garage,start,selection,selectJourney,validJourney}:MenuProps&{
  selection:JourneySelection;selectJourney:(selection:JourneySelection)=>void;validJourney:boolean;
  mode:Mode;selectMode:(mode:Mode)=>void;season:Season;selectSeason:(season:Season)=>void;garage:()=>void;start:()=>void;
}){
  return <section className={'journey-menu journey-setup'+(mode==='custom'?' custom-setup':'')} aria-labelledby="journey-heading">
    <header className="journey-top">
      <button className="journey-link" onClick={back}><Arrow left/> Back</button>
      <button className="journey-link" onClick={garage}>Garage <Arrow/></button>
    </header>
    <div className="journey-intro">
      <h1 id="journey-heading">Choose your journey</h1>
      <div className="journey-objective" key={mode} aria-live="polite">
        <p>{modeCopy[mode].tagline}</p><span>{modes[mode].objective}</span>
      </div>
      {mode==='custom'&&<div className="journey-destinations">
        {(['from','to'] as const).map(field=><div className={'journey-location journey-'+field} key={field}>
          <label className="journey-label" htmlFor={'custom-'+field}>{field==='from'?'From':'To'}</label>
          <select id={'custom-'+field} value={selection[field]} onChange={event=>selectJourney({...selection,[field]:event.target.value})}>
            {journeyLocations.map(location=><option key={location}>{location}</option>)}
          </select>
        </div>)}
        <button type="button" aria-label="Swap destinations" title="Swap destinations" onClick={()=>selectJourney({from:selection.to,to:selection.from})}>⇄</button>
        {!validJourney&&<p role="status">{selection.from===selection.to?'Choose two different locations.':'No drivable route connects these locations.'}</p>}
      </div>}
    </div>
    <div className="showroom setup-showroom" ref={frame}>{assetStatus!=='ready'&&<p role="status">{assetMessage[assetStatus]}</p>}</div>
    <div className="mode-track" role="group" aria-label="Game mode">
      {modeOrder.map((key,index)=><button key={key} data-mode={key} aria-pressed={mode===key} onClick={()=>selectMode(key)}>
        <span className="mode-symbol" aria-hidden="true"><span>{String(index+1).padStart(2,'0')}</span>
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" aria-hidden="true"><path d={modeCopy[key].icon} stroke="currentColor" strokeWidth="1.45" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </span>
        <strong>{modes[key].name}</strong><span className="mode-tagline">{modeCopy[key].tagline}</span>
      </button>)}
    </div>
    <footer className="journey-actions">
      <div className="season-rail" role="group" aria-label="Season">
        <span className="journey-label">Season</span>
        <div>{seasonChoices.map(([key,name])=><button key={key} aria-pressed={season===key} onClick={()=>selectSeason(key)}>{name}</button>)}</div>
      </div>
      <VehicleSelector vehicle={vehicle} change={delta=>selectVehicle(cycle(vehicle,delta))}/>
      <button className="journey-start" disabled={assetStatus!=='ready'||(mode==='custom'&&!validJourney)} onClick={start}>Start {modes[mode].name}<Arrow/></button>
    </footer>
  </section>;
}

export function Garage({vehicle,selectVehicle,back,frame,orbit,zoom,assetStatus}:MenuProps){
  const profile=vehicles[vehicle],copy=vehicleCopy[vehicle];
  const change=(delta:number)=>selectVehicle(cycle(vehicle,delta));
  return <section className="journey-menu garage-showroom" aria-label="Garage" onKeyDown={event=>{
    if(event.key!=='ArrowLeft'&&event.key!=='ArrowRight')return;
    event.preventDefault();change(event.key==='ArrowLeft'?-1:1);
  }}>
    <header className="journey-top">
      <button className="journey-link" onClick={back} autoFocus><Arrow left/> Back</button>
      <span className="journey-label">Garage</span>
    </header>
    <div className="garage-info" key={vehicle}>
      <h1>{copy.name}</h1><p>{copy.description}</p>
      <dl className="garage-specs">
        <div><dt>Top speed</dt><dd>{Math.round(profile.top*3.6)} <small>km/h</small></dd></div>
        <div><dt>Acceleration</dt><dd>{profile.acceleration} <small>m/s²</small></dd></div>
        <div><dt>Braking</dt><dd>{profile.braking} <small>m/s²</small></dd></div>
        <div><dt>Handling</dt><dd>{copy.handling}</dd></div>
      </dl>
    </div>
    <Showroom frame={frame} orbit={orbit} zoom={zoom} assetStatus={assetStatus}/>
    <footer className="garage-footer">
      <VehicleSelector vehicle={vehicle} change={change}/>
      <p id="showroom-hint"><span>Drag to rotate · Scroll to zoom</span><span>Drag to rotate · Pinch to zoom</span>
        <span className="showroom-keys"> · Focus preview for arrow keys and + / −</span>
      </p>
    </footer>
  </section>;
}
