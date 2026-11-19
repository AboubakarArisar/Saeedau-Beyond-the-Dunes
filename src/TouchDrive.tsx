import {useEffect,useRef,useState,type PointerEvent} from 'react';

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
  brake:'M6 4h7a2 2 0 0 1 0 4H9v8h10v4H5V8a4 4 0 0 1 1-4Z',
};
export function TouchDrive({inputs}:{inputs:Map<number,DriveAction>}){
  const held=useRef(new Map<number,HTMLButtonElement>());
  function release(pointer:number){
    const button=held.current.get(pointer);
    held.current.delete(pointer);inputs.delete(pointer);
    if(button&&![...held.current.values()].includes(button))button.removeAttribute('data-held');
  }
  useEffect(()=>{
    const clear=()=>{for(const pointer of held.current.keys())release(pointer);inputs.clear();};
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
    <div className="touch-steering">{pad('left','Steer left','Left')}{pad('right','Steer right','Right')}</div>
    <div className="touch-pedals">{pad('brake','Handbrake','Handbrake')}{pad('reverse','Brake or reverse','Brake')}{pad('throttle','Accelerate','Drive')}</div>
  </div>;
}
