import {useEffect,useRef,useState,type RefObject,type PointerEvent} from 'react';

export const touchDevice='(any-pointer: coarse)';
export type DriveAction='left'|'right'|'throttle'|'reverse'|'brake';

export function useMedia(query:string){
  const [matches,setMatches]=useState(()=>window.matchMedia(query).matches);
  useEffect(()=>{
    const media=window.matchMedia(query);
    const sync=()=>setMatches(media.matches);
    media.addEventListener('change',sync);sync();
    return ()=>media.removeEventListener('change',sync);
  },[query]);
  return matches;
}

const portraitQuery='(orientation: portrait)';
const readPortrait=()=>window.innerWidth===window.innerHeight?
  window.matchMedia(portraitQuery).matches:window.innerHeight>window.innerWidth;

export function usePortrait(){
  const [portrait,setPortrait]=useState(readPortrait);
  useEffect(()=>{
    const media=window.matchMedia(portraitQuery),sync=()=>setPortrait(readPortrait());
    media.addEventListener('change',sync);
    window.addEventListener('resize',sync);sync();
    return ()=>{media.removeEventListener('change',sync);window.removeEventListener('resize',sync);};
  },[]);
  return portrait;
}

export async function requestLandscape(){
  const orientation=screen.orientation as (ScreenOrientation&{lock?:(mode:'landscape')=>Promise<void>})|undefined;
  if(!orientation?.lock)return false;
  try{await orientation.lock('landscape');return true;}
  catch(error){console.info('Landscape lock unavailable',error);return false;}
}

export function RotateScreen(){
  const [message,setMessage]=useState('');
  return <section className="rotate-screen" role="dialog" aria-modal="true" aria-labelledby="rotate-title">
    <svg width="100" height="76" viewBox="0 0 100 76" fill="none" aria-hidden="true">
      <g className="rotate-phone" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
        <rect x="33" y="11" width="34" height="54" rx="6"/>
        <path d="M46 17h8m-7 42h6"/>
      </g>
      <path d="M72 11a32 32 0 0 1 19 26m0 0-8-7m8 7 6-9M9 39a32 32 0 0 0 19 26m-19-26 8 7m-8-7-6 9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
    <h1 id="rotate-title">Rotate your phone</h1>
    <p>Turn your device sideways for the best driving experience.</p>
    <button autoFocus onClick={async()=>{if(!await requestLandscape())setMessage('Turn your device manually to continue.');}}>Try landscape</button>
    {message&&<small role="status">{message}</small>}
  </section>;
}

const icons:Record<DriveAction,string>={
  left:'m15 5-7 7 7 7',right:'m9 5 7 7-7 7',
  throttle:'M9 3h6l2 17H7L9 3Zm1.5 5h3m-3.5 4h4m-4.5 4h5',
  reverse:'M5 7h14l1 10H4L5 7Zm3 4h8m-8 3h8',
  brake:'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM10 16V8h3a2.25 2.25 0 0 1 0 4.5h-3',
};
export function TouchDrive({inputs,method,wheelSensitivity,analog}:{inputs:Map<number,DriveAction>;method:string;wheelSensitivity:number;analog:RefObject<number>}){
  const wheel=useRef<{id:number;angle:number;rotation:number}|null>(null);
  const [rotation,setRotation]=useState(0);
  function angle(event:PointerEvent<HTMLButtonElement>){
    const box=event.currentTarget.getBoundingClientRect();
    return Math.atan2(event.clientX-box.x-box.width/2,box.y+box.height/2-event.clientY);
  }
  function releaseWheel(pointer?:number){
    if(!wheel.current||(pointer!==undefined&&pointer!==wheel.current.id))return;
    wheel.current=null;analog.current=0;setRotation(0);
  }
  const held=useRef(new Map<number,HTMLButtonElement>());
  function release(pointer:number){
    releaseWheel(pointer);
    const button=held.current.get(pointer);
    held.current.delete(pointer);inputs.delete(pointer);
    if(button&&![...held.current.values()].includes(button))button.removeAttribute('data-held');
  }
  useEffect(()=>{
    const clear=()=>{releaseWheel();for(const pointer of held.current.keys())release(pointer);inputs.clear();};
    const ended=(event:globalThis.PointerEvent)=>release(event.pointerId);
    window.addEventListener('blur',clear);
    window.addEventListener('pointerup',ended);
    window.addEventListener('pointercancel',ended);
    document.addEventListener('visibilitychange',clear);
    return ()=>{
      clear();
      window.removeEventListener('blur',clear);
      window.removeEventListener('pointerup',ended);
      window.removeEventListener('pointercancel',ended);
      document.removeEventListener('visibilitychange',clear);
    };
  },[inputs]);
  const ended=(event:PointerEvent<HTMLButtonElement>)=>release(event.pointerId);
  const pad=(action:DriveAction,label:string,caption:string)=><button type="button" aria-label={label} className={'touch-'+action}
    onPointerDown={event=>{
      event.preventDefault();
      if(event.button!==0)return;
      const button=event.currentTarget;
      try{button.setPointerCapture(event.pointerId);}
      catch(error){console.info('Touch capture unavailable',error);}
      inputs.set(event.pointerId,action);
      held.current.set(event.pointerId,button);
      button.dataset.held='true';
    }} onPointerUp={ended} onPointerCancel={ended} onLostPointerCapture={ended}>
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" aria-hidden="true"><path d={icons[action]} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
    <span>{caption}</span>
  </button>;
  return <div className="touch-drive" aria-label="Touch driving controls">
    {method==='tilt'?<>
      <div className="touch-pedals">{pad('brake','Handbrake','Handbrake')}{pad('reverse','Brake or reverse','Brake')}</div>
      <div className="touch-pedals">{pad('throttle','Accelerate','Drive')}</div>
    </>:<>
    <div className="touch-steering">{method==='wheel'?<button type="button" className="touch-wheel" aria-label="Steering wheel"
      data-held={rotation!==0} onPointerDown={event=>{
        if(wheel.current||event.button!==0)return;
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        wheel.current={id:event.pointerId,angle:angle(event),rotation:0};
      }} onPointerMove={event=>{
        const held=wheel.current;
        if(!held||held.id!==event.pointerId)return;
        const next=angle(event),delta=next-held.angle;
        held.angle=next;
        held.rotation=Math.max(-115,Math.min(115,held.rotation+Math.atan2(Math.sin(delta),Math.cos(delta))*180/Math.PI));
        analog.current=Math.max(-1,Math.min(1,held.rotation*wheelSensitivity/90));setRotation(held.rotation);
      }} onPointerUp={ended} onPointerCancel={ended} onLostPointerCapture={ended}>
      <svg viewBox="0 0 64 64" width="64" height="64" aria-hidden="true" style={{rotate:rotation+'deg'}}>
        <circle cx="32" cy="32" r="26" fill="#1b1a19" stroke="currentColor" strokeWidth="7"/>
        <path d="M8 27l24 7 24-7M32 34v23" stroke="currentColor" strokeWidth="7" fill="none"/>
        <circle cx="32" cy="33" r="7" fill="#dfb06c"/>
      </svg>
    </button>:<>{pad('left','Steer left','Left')}{pad('right','Steer right','Right')}</>}</div>
    <div className="touch-pedals">{pad('brake','Handbrake','Handbrake')}{pad('reverse','Brake or reverse','Brake')}{pad('throttle','Accelerate','Drive')}</div>
    </>}
  </div>;
}
