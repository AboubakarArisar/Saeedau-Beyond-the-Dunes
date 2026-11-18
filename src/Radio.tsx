import {useEffect,useRef,useState} from 'react';
import {preference,savePreference} from './gameAudio';
import {loadYouTube,playlist,playlistUrl,type Player} from './youtubeRadio';
import './radio.css';

type Track={id:number;name:string;url:string};
type Source='youtube'|'local';
type Repeat='off'|'all'|'one';
const clock=(seconds:number)=>Number.isFinite(seconds)?Math.floor(seconds/60)+':'+String(Math.floor(seconds%60)).padStart(2,'0'):'0:00';
export const shortcuts={panel:'m',play:'p',next:'n',previous:'b'};
export type Shortcuts=typeof shortcuts;
export const isControl=(target:EventTarget|null)=>target instanceof Element&&!!target.closest('button,input,select,textarea,a,[contenteditable]:not([contenteditable="false"]),[data-radio]');

export function Radio({visible,volume,music,setMusic,bindings}:{visible:boolean;volume:number;music:number;setMusic:(value:number)=>void;bindings:Shortcuts}){
  const [source,setSource]=useState<Source>(()=>preference('radio.source','local'));
  const [expanded,setExpanded]=useState(()=>preference('radio.expanded',false));
  const [shuffle,setShuffle]=useState(()=>preference('radio.shuffle',false));
  const [repeat,setRepeat]=useState<Repeat>(()=>preference('radio.repeat','off'));
  const [tracks,setTracks]=useState<Track[]>([]);
  const [selected,setSelected]=useState<number>();
  const [localPlaying,setLocalPlaying]=useState(false);
  const [localTime,setLocalTime]=useState([0,0]);
  const [localError,setLocalError]=useState('');
  const [ytError,setYtError]=useState('');
  const [ytState,setYtState]=useState({playing:false,time:0,duration:0,index:-1,url:''});
  const [ready,setReady]=useState(false);
  const [retry,setRetry]=useState(0);
  const playDeadline=useRef<number|undefined>(undefined);
  const audio=useRef<HTMLAudioElement>(null), player=useRef<Player|null>(null), embed=useRef<HTMLDivElement>(null);
  const urls=useRef(new Set<string>()), nextId=useRef(0), loaded=useRef<number|undefined>(undefined);
  const heard=useRef(new Set<number>());
  const latestVolume=useRef(volume);latestVolume.current=volume;
  const current=tracks.find(track=>track.id===selected);
  const showYouTube=visible&&expanded&&source==='youtube';
  useEffect(()=>{savePreference('radio.source',source);savePreference('radio.expanded',expanded);savePreference('radio.shuffle',shuffle);savePreference('radio.repeat',repeat);},[source,expanded,shuffle,repeat]);
  useEffect(()=>{
    const element=audio.current,owned=urls.current;
    return ()=>{element?.pause();element?.removeAttribute('src');element?.load();for(const url of owned)URL.revokeObjectURL(url);owned.clear();};
  },[]);
  useEffect(()=>{
    if(audio.current)audio.current.volume=volume;
    if(ready)player.current?.setVolume(Math.round(volume*100));
  },[volume,ready]);
  useEffect(()=>{
    if(!showYouTube||!embed.current)return;
    const host=embed.current, placeholder=document.createElement('div');
    host.replaceChildren(placeholder);
    let disposed=false, inView=false, instance:Player|undefined, timer:number|undefined, poll:number|undefined;
    const observer=new IntersectionObserver(([entry])=>{
      inView=entry.intersectionRatio>=.5;
      if(!inView)player.current?.pauseVideo();
    },{threshold:.5});
    observer.observe(host);
    setYtError('');setReady(false);setYtState({playing:false,time:0,duration:0,index:-1,url:''});
    const refresh=()=>{
      const currentPlayer=player.current;
      if(!disposed&&currentPlayer){
        setYtState({playing:currentPlayer.getPlayerState()===1,time:currentPlayer.getCurrentTime()||0,
          duration:currentPlayer.getDuration()||0,index:currentPlayer.getPlaylistIndex()??-1,url:currentPlayer.getVideoUrl()||''});
      }
    };
    const fail=(message:string)=>{if(!disposed)setYtError(message);};
    loadYouTube().then(api=>{
      if(disposed)return;
      timer=window.setTimeout(()=>fail('YouTube did not respond. Try opening the playlist on YouTube.'),12000);
      instance=new api.Player(placeholder,{width:'100%',height:'100%',playerVars:{
        listType:'playlist',list:playlist,origin:window.location.origin,playsinline:1,autoplay:0,
      },events:{
        onReady:({target})=>{
          if(disposed)return;
          clearTimeout(timer);target.setVolume(Math.round(latestVolume.current*100));player.current=target;
          if(document.hidden)target.pauseVideo();
          setReady(true);setYtError('');refresh();poll=window.setInterval(refresh,750);
        },
        onStateChange:({target,data})=>{
          if(disposed)return;
          if(data===1){
            clearTimeout(playDeadline.current);
            if(document.hidden||!inView)target.pauseVideo();else setYtError('');
          }
          refresh();
        },
        onError:({data})=>{clearTimeout(playDeadline.current);fail(`YouTube track unavailable (${data}). Try Next or open the playlist on YouTube.`);},
        onAutoplayBlocked:()=>{clearTimeout(playDeadline.current);fail('Browser blocked playback. Press Play inside the YouTube player.');},
      }});
    }).catch(()=>fail('YouTube could not connect. Try opening the playlist on YouTube.'));
    const visibility=()=>{if(document.hidden)player.current?.pauseVideo();};
    document.addEventListener('visibilitychange',visibility);
    return ()=>{
      disposed=true;observer.disconnect();document.removeEventListener('visibilitychange',visibility);
      clearTimeout(timer);clearTimeout(playDeadline.current);clearInterval(poll);player.current?.pauseVideo();player.current=null;
      instance?.destroy();host.replaceChildren();
    };
  },[showYouTube,retry]);
  function selectSource(value:Source){
    if(value===source)return;
    audio.current?.pause();player.current?.pauseVideo();setSource(value);
  }
  function togglePanel(){
    if(expanded)player.current?.pauseVideo();
    setExpanded(!expanded);
  }
  function play(track:Track){
    const element=audio.current;
    if(!element)return;
    player.current?.pauseVideo();setLocalError('');
    heard.current.add(track.id);
    if(loaded.current!==track.id){
      loaded.current=track.id;element.src=track.url;setSelected(track.id);setLocalTime([0,0]);
    }
    void element.play().catch(error=>{
      if(loaded.current===track.id&&error.name!=='AbortError')setLocalError('Cannot play this file. Try a supported, uncorrupted audio file.');
    });
  }
  function toggle(){
    if(source==='youtube'){
      const currentPlayer=player.current;
      if(showYouTube&&ready&&currentPlayer){
        clearTimeout(playDeadline.current);
        if(currentPlayer.getPlayerState()===1){currentPlayer.pauseVideo();return;}
        setYtError('');
        currentPlayer.playVideo();
        playDeadline.current=window.setTimeout(()=>{
          if(player.current===currentPlayer&&currentPlayer.getPlayerState()!==1)
            setYtError('Playback did not start. Try Play inside the YouTube player or open the playlist on YouTube.');
        },8000);
      }
    }else if(current){if(audio.current?.paused)play(current);else audio.current?.pause();}
    else if(tracks.length)play(tracks[0]);
  }
  function move(direction:number,ended=false){
    if(source==='youtube'){
      if(showYouTube&&ready){if(direction>0)player.current?.nextVideo();else player.current?.previousVideo();}
      return;
    }
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
  function remove(ids:number[]){
    if(selected!==undefined&&ids.includes(selected)){
      audio.current?.pause();audio.current?.removeAttribute('src');audio.current?.load();
      loaded.current=undefined;setSelected(undefined);setLocalTime([0,0]);setLocalError('');
    }
    for(const track of tracks)if(ids.includes(track.id)){URL.revokeObjectURL(track.url);urls.current.delete(track.url);heard.current.delete(track.id);}
    setTracks(tracks.filter(track=>!ids.includes(track.id)));
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
  const playing=source==='local'?localPlaying:ytState.playing&&showYouTube;
  const title=source==='local'?current?.name??'Choose music from this device':ytState.index>=0&&showYouTube?'Playlist track '+(ytState.index+1):'Thari & Sindhi playlist';
  const time=source==='local'?localTime:[ytState.time,ytState.duration];
  function syncTime(){const element=audio.current;if(element)setLocalTime([element.currentTime,Number.isFinite(element.duration)?element.duration:0]);}
  return <>
    <audio ref={audio} preload="metadata" onPlay={()=>setLocalPlaying(true)} onPause={()=>setLocalPlaying(false)}
      onTimeUpdate={syncTime} onLoadedMetadata={syncTime} onEnded={()=>{setLocalPlaying(false);if(source==='local')move(1,true);}}
      onError={()=>{if(loaded.current!==undefined){setLocalPlaying(false);setLocalError('This file cannot be decoded by your browser.');}}}/>
    {visible&&<aside data-radio className={'radio'+(expanded?' radio-expanded':'')} aria-label="Thar Radio">
      <header><span>THAR RADIO <small>{source==='local'?'MY MUSIC':'YOUTUBE'}</small></span>
        <button aria-expanded={expanded} onClick={togglePanel}>{expanded?'Collapse':'Expand'}</button></header>
      <div className="radio-title" title={title}>{title}</div>
      {expanded&&<div className="radio-sources" aria-label="Music source">
        <button aria-pressed={source==='youtube'} onClick={()=>selectSource('youtube')}>YouTube Radio</button>
        <button aria-pressed={source==='local'} onClick={()=>selectSource('local')}>My Music</button>
      </div>}
      {showYouTube&&<>
        <div className="radio-embed" ref={embed}/>
        {!ready&&!ytError&&<p role="status">Connecting to YouTube…</p>}
        {ytError&&<p role="status">{ytError} {!ready&&<button onClick={()=>setRetry(value=>value+1)}>Retry connection</button>}</p>}
        <a href={playlistUrl} target="_blank" rel="noreferrer">Open on YouTube</a>
        {ytState.url.startsWith('https://www.youtube.com/')&&<> · <a href={ytState.url} target="_blank" rel="noreferrer">Current video</a></>}
      </>}
      {expanded&&(source==='local'||showYouTube)&&<div className="radio-transport">
        <button disabled={source==='youtube'?!ready:!tracks.length} onClick={()=>move(-1)}>Previous</button>
        <button disabled={source==='youtube'?!ready:!tracks.length} onClick={toggle}>{playing?'Pause music':'Play music'}</button>
        <button disabled={source==='youtube'?!ready:!tracks.length} onClick={()=>move(1)}>Next</button>
      </div>}
      {!expanded&&source==='local'&&tracks.length>0&&<button className="compact-play" onClick={toggle}>{playing?'Pause music':'Play music'}</button>}
      {expanded&&<>
        <div className="radio-time">
          <span>{clock(time[0])}</span>
          {source==='local'?<input type="range" aria-label="Seek" min="0" max={time[1]||1} step=".1" value={time[0]} disabled={!time[1]}
            onChange={event=>{if(audio.current){audio.current.currentTime=Number(event.target.value);syncTime();}}}/>
            :<progress aria-label="YouTube progress" value={time[0]} max={time[1]||1}/>}
          <span>{clock(time[1])}</span>
        </div>
        <label className="radio-volume">Music volume <input type="range" min="0" max="1" step=".01" value={music} onChange={event=>setMusic(Number(event.target.value))}/></label>
      </>}
      {expanded&&source==='local'&&<>
        <div className="radio-transport">
          <button aria-pressed={shuffle} onClick={()=>{heard.current.clear();if(selected!==undefined)heard.current.add(selected);setShuffle(!shuffle);}}>Shuffle</button>
          <label>Repeat <select value={repeat} onChange={event=>setRepeat(event.target.value as Repeat)}><option value="off">Off</option><option value="one">One</option><option value="all">All</option></select></label>
          <button disabled={!tracks.length} onClick={()=>remove(tracks.map(track=>track.id))}>Clear playlist</button>
        </div>
        <label className="radio-file">Add music files <input type="file" multiple accept="audio/*,.mp3,.wav,.ogg,.m4a,.aac,.flac" onChange={event=>{
          const files=Array.from(event.target.files??[]);
          const valid=files.filter(file=>file.type.startsWith('audio/')||/\.(mp3|wav|ogg|m4a|aac|flac|opus|webm)$/i.test(file.name));
          setLocalError(valid.length<files.length?'Unrecognized files were not added.':'');
          const added=valid.map(file=>{const url=URL.createObjectURL(file);urls.current.add(url);return {id:nextId.current++,name:file.name.replace(/\.[^.]+$/,''),url};});
          setTracks(previous=>[...previous,...added]);event.target.value='';
        }}/></label>
        <ol className="radio-queue">{tracks.map(track=><li key={track.id}>
          <button aria-current={track.id===selected?'true':undefined} onClick={()=>play(track)} title={track.name}>{track.name}</button>
          <button aria-label={'Remove '+track.name} onClick={()=>remove([track.id])}>×</button>
        </li>)}</ol>
        <small>Files stay on this device. Select them again after reloading.</small>
      </>}
      {source==='local'&&localError&&<p role="status">{localError}</p>}
    </aside>}
  </>;
}
