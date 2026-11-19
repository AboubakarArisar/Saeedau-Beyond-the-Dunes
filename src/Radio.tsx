import {useEffect,useRef,useState} from 'react';
import {preference,savePreference} from './gameAudio';
import {readSoundtrack} from './tharRadio';
import './radio.css';

type Track={id:number;name:string;artist?:string;url:string};
type Source='local'|'builtin';
const soundtrackPath=import.meta.env.BASE_URL+'audio/thar-radio/';
type Repeat='off'|'all'|'one';
const clock=(seconds:number)=>Number.isFinite(seconds)?Math.floor(seconds/60)+':'+String(Math.floor(seconds%60)).padStart(2,'0'):'0:00';
export const shortcuts={panel:'m',play:'p',next:'n',previous:'b'};
export type Shortcuts=typeof shortcuts;
export const isControl=(target:EventTarget|null)=>target instanceof Element&&!!target.closest('button,input,select,textarea,a,[contenteditable]:not([contenteditable="false"]),[data-radio]');

export function Radio({mobile,visible,volume,music,setMusic,bindings}:{mobile:boolean;visible:boolean;volume:number;music:number;setMusic:(value:number)=>void;bindings:Shortcuts}){
  const [source,setSource]=useState<Source>(()=>preference<string>('radio.source','builtin')==='local'?'local':'builtin');
  const [desktopExpanded,setDesktopExpanded]=useState(()=>preference('radio.expanded',false));
  const [mobileExpanded,setMobileExpanded]=useState(false);
  const expanded=mobile?mobileExpanded:desktopExpanded;
  const [shuffle,setShuffle]=useState(()=>preference('radio.shuffle',false));
  const [repeat,setRepeat]=useState<Repeat>(()=>preference('radio.repeat','off'));
  const [personalTracks,setPersonalTracks]=useState<Track[]>([]);
  const [builtInTracks,setBuiltInTracks]=useState<Track[]>([]);
  const [soundtrackState,setSoundtrackState]=useState<'loading'|'ready'|'error'>('loading');
  const [soundtrackRetry,setSoundtrackRetry]=useState(0);
  const [selection,setSelection]=useState<{local?:number;builtin?:number}>({});
  const [muted,setMuted]=useState(()=>preference('radio.muted',false));
  const [localPlaying,setLocalPlaying]=useState(false);
  const [localTime,setLocalTime]=useState([0,0]);
  const [localError,setLocalError]=useState('');
  const audio=useRef<HTMLAudioElement>(null);
  const urls=useRef(new Set<string>()), nextId=useRef(0), loaded=useRef<number|undefined>(undefined);
  const heard=useRef(new Set<number>());
  const autoplay=useRef(true),seeking=useRef(false);
  const effectiveVolume=muted?0:volume;

  const tracks=source==='builtin'?builtInTracks:personalTracks;
  const selected=selection[source];
  const current=tracks.find(track=>track.id===selected);

  useEffect(()=>{savePreference('radio.source',source);savePreference('radio.expanded',desktopExpanded);savePreference('radio.shuffle',shuffle);savePreference('radio.repeat',repeat);},[source,desktopExpanded,shuffle,repeat]);
  useEffect(()=>{savePreference('radio.muted',muted);},[muted]);
  useEffect(()=>{
    const request=new AbortController();
    fetch(soundtrackPath+'manifest.json',{signal:request.signal}).then(response=>{
      if(!response.ok)throw new Error('Soundtrack manifest request failed');
      return response.json();
    }).then(value=>{
      if(request.signal.aborted)return;
      const entries=readSoundtrack(value);
      setBuiltInTracks(entries.map(({title,artist,file},index)=>({id:-index-1,name:title,artist,url:soundtrackPath+encodeURIComponent(file)})));
      setSoundtrackState('ready');
    }).catch(()=>{
      if(!request.signal.aborted)setSoundtrackState('error');
    });
    return ()=>request.abort();
  },[soundtrackRetry]);
  useEffect(()=>{
    const element=audio.current,owned=urls.current;
    return ()=>{element?.pause();element?.removeAttribute('src');element?.load();for(const url of owned)URL.revokeObjectURL(url);owned.clear();};
  },[]);
  useEffect(()=>{
    if(audio.current)audio.current.volume=effectiveVolume;
  },[effectiveVolume]);

  function selectSource(value:Source){
    if(value===source)return;
    autoplay.current=false;clearAudio();setSource(value);
  }
  function togglePanel(){(mobile?setMobileExpanded:setDesktopExpanded)(!expanded);}
  function play(track:Track,automatic=false){
    if(!automatic)autoplay.current=false;
    const element=audio.current;
    if(!element)return;
    setLocalError('');
    heard.current.add(track.id);
    if(loaded.current!==track.id||element.error){
      element.pause();
      loaded.current=track.id;element.src=track.url;
      setSelection(previous=>({...previous,[source]:track.id}));setLocalTime([0,0]);
    }
    void element.play().then(()=>{autoplay.current=false;}).catch(error=>{
      if(error.name==='NotAllowedError'&&automatic)return;
      if(loaded.current===track.id&&error.name!=='AbortError')setLocalError(source==='builtin'?
        'Could not play this soundtrack track. Try again or choose another track.':
        'Cannot play this file. Try a supported, uncorrupted audio file.');
    });
  }
  useEffect(()=>{
    const first=builtInTracks[0];
    if(!first||source!=='builtin'||!autoplay.current)return;
    if(effectiveVolume>0)play(first,true);
    else setSelection(previous=>previous.builtin===undefined?{...previous,builtin:first.id}:previous);
    const listeners=new AbortController();
    const retry=()=>{
      if(autoplay.current&&effectiveVolume>0)play(first,true);
      listeners.abort();
    };
    window.addEventListener('click',retry,{signal:listeners.signal});
    window.addEventListener('keydown',retry,{signal:listeners.signal});
    return ()=>listeners.abort();
  },[builtInTracks,source,effectiveVolume]);
  useEffect(()=>{
    const listeners=new AbortController();
    const finish=()=>{if(seeking.current){seeking.current=false;syncTime();}};
    for(const type of ['pointerup','pointercancel','blur'])window.addEventListener(type,finish,{signal:listeners.signal});
    return ()=>listeners.abort();
  },[]);
  function toggle(){
    if(current){if(audio.current?.paused)play(current);else audio.current?.pause();}
    else if(tracks.length)play(tracks[0]);
  }
  function move(direction:number,ended=false){
    if(!tracks.length)return;
    if(ended&&repeat==='one'&&current&&audio.current){audio.current.currentTime=0;play(current);return;}
    const index=tracks.findIndex(track=>track.id===selected);
    if(shuffle&&direction>0){
      let alternatives=tracks.filter(track=>track.id!==selected&&(!ended||!heard.current.has(track.id)));
      if(ended&&!alternatives.length){
        if(repeat==='off')return;
        heard.current.clear();
        alternatives=tracks.filter(track=>track.id!==selected);
        if(!alternatives.length&&current&&audio.current){audio.current.currentTime=0;play(current);return;}
      }
      if(alternatives.length){play(alternatives[Math.floor(Math.random()*alternatives.length)]);return;}
    }
    if(ended&&repeat==='off'&&index===tracks.length-1)return;
    play(tracks[(index<0?(direction>0?0:tracks.length-1):index+direction+tracks.length)%tracks.length]);
  }
  function clearAudio(){
    loaded.current=undefined;audio.current?.pause();audio.current?.removeAttribute('src');audio.current?.load();
    setLocalTime([0,0]);setLocalPlaying(false);setLocalError('');
  }
  function remove(ids:number[]){
    if(selected!==undefined&&ids.includes(selected)){
      clearAudio();setSelection(previous=>({...previous,local:undefined}));
    }
    for(const track of tracks)if(ids.includes(track.id)){URL.revokeObjectURL(track.url);urls.current.delete(track.url);heard.current.delete(track.id);}
    setPersonalTracks(personalTracks.filter(track=>!ids.includes(track.id)));
  }
  useEffect(()=>{
    const key=(event:KeyboardEvent)=>{
      if(!visible||event.repeat||event.altKey||event.ctrlKey||event.metaKey||isControl(event.target))return;
      const value=event.key.toLowerCase();
      if(value===bindings.panel)togglePanel();
      else if(value===bindings.play)toggle();
      else if(value===bindings.next)move(1);
      else if(value===bindings.previous)move(-1);
    };
    window.addEventListener('keydown',key);return ()=>window.removeEventListener('keydown',key);
  });
  const playing=localPlaying;
  const soundtrackMessage={
    loading:'Loading Thar soundtrack…',error:'Could not load the Thar soundtrack.',
    ready:builtInTracks.length?'Ready to play':'No tracks are included yet.',
  }[soundtrackState];
  const trackTitle=(track:Track)=>track.artist?track.name+' · '+track.artist:track.name;
  const title=current?trackTitle(current):source==='builtin'?soundtrackMessage:'Choose music from this device';
  const time=localTime;
  function syncTime(){const element=audio.current;if(element&&!seeking.current)setLocalTime([element.currentTime,Number.isFinite(element.duration)?element.duration:0]);}
  return <>
    <audio ref={audio} preload="none" onPlay={()=>setLocalPlaying(true)} onPause={()=>setLocalPlaying(false)}
      onTimeUpdate={syncTime} onLoadedMetadata={syncTime} onEnded={()=>{
        setLocalPlaying(false);
        if(loaded.current!==undefined&&loaded.current===selected)move(1,true);
      }}
      onError={()=>{if(loaded.current!==undefined){setLocalPlaying(false);setLocalError(source==='builtin'?
        'This soundtrack track could not be loaded. Try Next or select another track.':
        'This file cannot be decoded by your browser.');}}}/>
    {visible&&(mobile&&!expanded?<aside data-radio className="radio radio-mini" aria-label="Thar Radio"><button className="radio-icon" aria-label="Expand" title="Thar Radio" aria-expanded={false} onClick={togglePanel}>
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <path d="M9 18V5l11-2v13M9 9l11-2"/><ellipse cx="6" cy="18" rx="3" ry="2"/><ellipse cx="17" cy="16" rx="3" ry="2"/>
      </svg>
    </button>
      <span className="radio-title" title={title}>{current?.name??'Thar Radio'}</span>
      <button className="radio-icon" disabled={!tracks.length} onClick={toggle} aria-label={playing?'Pause music':'Play music'}>{playing?'Ⅱ':'▶'}</button>
    </aside>:<aside data-radio className={'radio'+(expanded?' radio-expanded':'')} aria-label="Thar Radio">
      <header><span>THAR RADIO <small>{{local:'MY MUSIC',builtin:'SOUNDTRACK'}[source]}</small></span>
        <button aria-expanded={expanded} onClick={togglePanel}>{expanded?'Collapse':'Expand'}</button></header>
      <div className="radio-title" title={title}>{title}</div>
      {expanded&&<div className="radio-sources" aria-label="Music source">
        <button aria-pressed={source==='builtin'} onClick={()=>selectSource('builtin')}>Thar Soundtrack</button>
        <button aria-pressed={source==='local'} onClick={()=>selectSource('local')}>My Music</button>
      </div>}
      {expanded&&source==='builtin'&&soundtrackState==='error'&&<p role="status">{soundtrackMessage} <button onClick={()=>{
        setSoundtrackState('loading');setSoundtrackRetry(value=>value+1);
      }}>Retry soundtrack</button></p>}
      {expanded&&<div className="radio-transport">
        <button disabled={!tracks.length} onClick={()=>move(-1)}>Previous</button>
        <button disabled={!tracks.length} onClick={toggle}>{playing?'Pause music':'Play music'}</button>
        <button disabled={!tracks.length} onClick={()=>move(1)}>Next</button>
      </div>}
      {!expanded&&tracks.length>0&&<button className="compact-play" onClick={toggle}>{playing?'Pause music':'Play music'}</button>}
      {expanded&&<>
        <div className="radio-time">
          <span>{clock(time[0])}</span>
          <input type="range" aria-label="Seek" min="0" max={time[1]||1} step=".1" value={time[0]} disabled={!time[1]}
            onPointerDown={()=>{seeking.current=true;}} onChange={event=>{if(audio.current){
              const value=Number(event.target.value);audio.current.currentTime=value;setLocalTime([value,time[1]]);
            }}}/>
          <span>{clock(time[1])}</span>
        </div>
        <label className="radio-volume">Music volume <input type="range" min="0" max="1" step=".01" value={music} onChange={event=>setMusic(Number(event.target.value))}/></label>
        <button aria-pressed={muted} onClick={()=>setMuted(!muted)}>Mute radio</button>
      </>}
      {expanded&&<>
        <div className="radio-transport">
          <button aria-pressed={shuffle} onClick={()=>{heard.current.clear();if(selected!==undefined)heard.current.add(selected);setShuffle(!shuffle);}}>Shuffle</button>
          <label>Repeat <select value={repeat} onChange={event=>setRepeat(event.target.value as Repeat)}><option value="off">Off</option><option value="one">One</option><option value="all">All</option></select></label>
          {source==='local'&&<button disabled={!tracks.length} onClick={()=>remove(tracks.map(track=>track.id))}>Clear playlist</button>}
        </div>
        {source==='local'&&<label className="radio-file">Add music files <input type="file" multiple accept="audio/*,.mp3,.wav,.ogg,.m4a,.aac,.flac" onChange={event=>{
          const files=Array.from(event.target.files??[]);
          const valid=files.filter(file=>file.type.startsWith('audio/')||/\.(mp3|wav|ogg|m4a|aac|flac|opus|webm)$/i.test(file.name));
          setLocalError(valid.length<files.length?'Unrecognized files were not added.':'');
          const added=valid.map(file=>{const url=URL.createObjectURL(file);urls.current.add(url);return {id:nextId.current++,name:file.name.replace(/\.[^.]+$/,''),url};});
          setPersonalTracks(previous=>[...previous,...added]);event.target.value='';
        }}/></label>}
        <ol className="radio-queue">{tracks.map(track=><li key={track.id}>
          <button aria-current={track.id===selected?'true':undefined} onClick={()=>play(track)} title={trackTitle(track)}>{trackTitle(track)}</button>
          {source==='local'&&<button aria-label={'Remove '+track.name} onClick={()=>remove([track.id])}>×</button>}
        </li>)}</ol>
        {source==='local'&&<small>Files stay on this device. Select them again after reloading.</small>}
      </>}
      {localError&&<p role="status">{localError}</p>}
    </aside>)}
  </>;
}
