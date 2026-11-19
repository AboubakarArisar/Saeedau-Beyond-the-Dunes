import {useEffect,useRef,useState} from 'react';
import {preference,savePreference} from './gameAudio';

export const steeringDefaults={method:'buttons' as 'buttons'|'wheel'|'tilt',tilt:1,deadZone:4,wheel:1};
const clamp=(value:number)=>Math.max(-1,Math.min(1,value));

export function tiltAngle(beta:number,gamma:number,angle:number){
  const radians=angle*Math.PI/180;
  return beta*Math.sin(radians)+gamma*Math.cos(radians);
}

export function tiltInput(delta:number,deadZone:number,sensitivity:number){
  return clamp(Math.sign(delta)*Math.max(0,Math.abs(delta)-deadZone)*sensitivity/28);
}

export function useSteering(active:boolean){
  const [settings,setSettings]=useState(()=>({...steeringDefaults,...preference('steering',steeringDefaults)}));
  const [sensor,setSensor]=useState<'idle'|'waiting'|'active'|'unavailable'>('idle');
  const analog=useRef(0);
  const sample=useRef<{angle:number;value:number;neutral:number}|undefined>(undefined);
  const canListen=sensor==='waiting'||sensor==='active';
  useEffect(()=>{savePreference('steering',settings);},[settings]);
  useEffect(()=>{
    analog.current=0;
    if(settings.method!=='tilt'||!canListen)return;
    const listeners=new AbortController(),signal=listeners.signal;
    let timeout:number|undefined;
    function arm(){
      clearTimeout(timeout);
      timeout=window.setTimeout(()=>{
        analog.current=0;sample.current=undefined;setSensor('unavailable');
      },2500);
    }
    function reset(){analog.current=0;sample.current=undefined;if(!document.hidden)arm();}
    function read(event:DeviceOrientationEvent){
      if(document.hidden||event.beta===null||event.gamma===null||
        !Number.isFinite(event.beta)||!Number.isFinite(event.gamma))return;
      const angle=screen.orientation?.angle??window.orientation??0;
      const value=tiltAngle(event.beta,event.gamma,angle);
      const current=sample.current;
      if(!current||current.angle!==angle)sample.current={angle,value,neutral:value};
      else current.value=value;
      const {neutral}=sample.current!;
      const delta=((value-neutral+540)%360)-180;
      const target=active?tiltInput(delta,settings.deadZone,settings.tilt):0;
      analog.current+=.22*(target-analog.current);
      setSensor('active');
      arm();
    }
    window.addEventListener('deviceorientation',read,{signal});
    window.addEventListener('blur',reset,{signal});
    document.addEventListener('visibilitychange',()=>{
      clearTimeout(timeout);reset();
    },{signal});
    arm();
    return ()=>{listeners.abort();clearTimeout(timeout);analog.current=0;};
  },[settings.method,settings.deadZone,settings.tilt,canListen,active]);

  async function enableTilt(){
    const sensorAPI=window.DeviceOrientationEvent as (typeof DeviceOrientationEvent&{
      requestPermission?:()=>Promise<string>
    })|undefined;
    try{
      if(!sensorAPI||(sensorAPI.requestPermission&&await sensorAPI.requestPermission()!=='granted')){
        setSensor('unavailable');return;
      }
      sample.current=undefined;analog.current=0;setSensor('waiting');
    }catch{setSensor('unavailable');}
  }
  function calibrate(){
    if(sample.current){
      sample.current.neutral=sample.current.value;analog.current=0;
    }
  }
  return {settings,setSettings,sensor,analog,enableTilt,calibrate,
    method:settings.method==='tilt'&&sensor!=='active'?'buttons':settings.method};
}
