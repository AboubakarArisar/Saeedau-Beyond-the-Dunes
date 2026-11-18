import {useEffect,useState,type PointerEvent} from 'react';

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

export async function requestLandscape(){
  const orientation=screen.orientation as (ScreenOrientation&{lock?:(mode:'landscape')=>Promise<void>})|undefined;
  if(!orientation?.lock)return false;
  let enteredFullscreen=false;
  try{
    if(!document.fullscreenElement&&document.fullscreenEnabled){await document.documentElement.requestFullscreen();enteredFullscreen=true;}
    await orientation.lock('landscape');
    return true;
  }catch(error){
    if(enteredFullscreen&&document.fullscreenElement)await document.exitFullscreen().catch(exitError=>console.info('Fullscreen could not be exited',exitError));
    console.info('Landscape lock unavailable',error);
    return false;
  }
}

export function RotateScreen({proceed}:{proceed:()=>void}){
  const [message,setMessage]=useState('');
  return <section className="rotate-screen" role="dialog" aria-modal="true" aria-labelledby="rotate-title">
    <svg width="100" height="76" viewBox="0 0 100 76" fill="none" aria-hidden="true">
      <rect x="32" y="9" width="36" height="58" rx="6" stroke="currentColor" strokeWidth="2.5" transform="rotate(-32 50 38)"/>
      <path d="M73 12a30 30 0 0 1 17 29m0 0-7-7m7 7 6-9M9 36a30 30 0 0 0 17 29m-17-29 7 7m-7-7-6 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
    <h1 id="rotate-title">rotate your phone.</h1>
    <p>Saeedau is best played in landscape.</p>
    <button autoFocus onClick={async()=>{if(!await requestLandscape())setMessage('Automatic rotation is unavailable. Rotate manually or continue in portrait.');}}>Try landscape</button>
    <button className="rotate-fallback" onClick={proceed}>Continue in portrait</button>
    {message&&<small role="status">{message}</small>}
  </section>;
}

export function TouchDrive({inputs,reset}:{inputs:Map<number,DriveAction>;reset:()=>void}){
  useEffect(()=>()=>inputs.clear(),[inputs]);
  const release=(event:PointerEvent<HTMLButtonElement>)=>{
    inputs.delete(event.pointerId);
    event.currentTarget.removeAttribute('data-held');
  };
  const pad=(action:DriveAction,label:string,caption:string)=><button type="button" aria-label={label}
    onPointerDown={event=>{
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      inputs.set(event.pointerId,action);
      event.currentTarget.dataset.held='true';
    }} onPointerUp={release} onPointerCancel={release} onLostPointerCapture={release}>{caption}</button>;
  return <div className="touch-drive" aria-label="Touch driving controls">
    <div>{pad('left','Steer left','←')}{pad('right','Steer right','→')}</div>
    <div>{pad('brake','Handbrake','handbrake')}{pad('reverse','Brake or reverse','reverse')}{pad('throttle','Accelerate','go')}</div>
    <button className="touch-reset" onClick={reset}>Reset</button>
  </div>;
}
