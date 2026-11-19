import {useEffect,useRef,useState} from 'react';

type Prompt=Event&{prompt:()=>Promise<unknown>;userChoice:Promise<{outcome:'accepted'|'dismissed'}>};
type Status={done:number;total:number;bytes:number};
type Reply={status?:Status;progress?:Status;error?:string};

export function GameFiles({visible}:{visible:boolean}){
  const [setupFailed,setSetupFailed]=useState(false);
  const [setupAttempt,setSetupAttempt]=useState(0);
  const [registration,setRegistration]=useState<ServiceWorkerRegistration>();
  const [waiting,setWaiting]=useState<ServiceWorker>();
  const [install,setInstall]=useState<Prompt>();
  const [status,setStatus]=useState<Status>();
  const [message,setMessage]=useState('');
  const [busy,setBusy]=useState(false);
  const [installed,setInstalled]=useState(()=>matchMedia('(display-mode: standalone)').matches||
    Boolean((navigator as Navigator&{standalone?:boolean}).standalone));
  const ios=/iPhone|iPad|iPod/.test(navigator.userAgent)||navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1;
  const [iosHelp,setIosHelp]=useState(false);
  const updating=useRef(false);
  const ports=useRef(new Set<()=>void>());
  function send(worker:ServiceWorker,command:string){
    const channel=new MessageChannel();

    const timeout=window.setTimeout(()=>{
      finish();setBusy(false);updating.current=false;setMessage('Game files check timed out. Try again.');
    },180000);
    function finish(){
      window.clearTimeout(timeout);channel.port1.close();ports.current.delete(finish);
    }
    ports.current.add(finish);
    channel.port1.onmessage=(event:MessageEvent<Reply>)=>{
      if(event.data.progress){setStatus(event.data.progress);return;}
      finish();setBusy(false);
      if(event.data.status)setStatus(event.data.status);
      if(event.data.error){updating.current=false;setMessage(event.data.error);}
    };
    try{worker.postMessage(command,[channel.port2]);}
    catch{
      channel.port2.close();finish();setBusy(false);updating.current=false;
      setMessage('The game files service disconnected. Reload and try again.');
    }
  }
  useEffect(()=>{
    const listeners=new AbortController(),signal=listeners.signal;

    window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();setInstall(event as Prompt);},{signal});
    window.addEventListener('appinstalled',()=>{setInstalled(true);setInstall(undefined);},{signal});
    if(import.meta.env.PROD&&'serviceWorker' in navigator){
      const service=navigator.serviceWorker;
      service.addEventListener('controllerchange',()=>{
        if(updating.current)location.reload();
      },{signal});
      void service.register('/sw.js',{updateViaCache:'none'}).then(async entry=>{
        if(signal.aborted)return;
        const check=()=>setWaiting(entry.waiting??undefined);
        check();
        const observe=()=>{
          const worker=entry.installing;
          worker?.addEventListener('statechange',()=>{
            check();
            if(worker.state==='redundant'&&!entry.active){
              setSetupFailed(true);setMessage('Could not prepare offline game files. Reconnect and retry.');
            }
          },{signal});
        };
        observe();
        entry.addEventListener('updatefound',observe,{signal});
        await service.ready;
        if(signal.aborted)return;
        setRegistration(entry);

      }).catch(()=>{if(!signal.aborted){
        setSetupFailed(true);setMessage('Offline storage is unavailable in this browser session.');
      }});
    }
    return ()=>{
      listeners.abort();

      for(const finish of ports.current)finish();
    };
  },[setupAttempt]);
  useEffect(()=>{
    if(visible&&registration?.active&&!busy)send(registration.active,'status');
  },[visible,registration]);
  async function promptInstall(){
    if(!install)return;
    try{
      await install.prompt();
      if((await install.userChoice).outcome==='accepted')setInstalled(true);
    }catch{setMessage('The browser could not open the install prompt.');}
    finally{setInstall(undefined);}
  }
  const ready=Boolean(status&&status.done===status.total);
  return <aside className="game-files" aria-label="Installation and offline files">
    {!installed&&(install?<button onClick={()=>void promptInstall()}>Install game</button>:
      ios?<button aria-expanded={iosHelp} onClick={()=>setIosHelp(!iosHelp)}>Install game</button>:
      <small>Install prompt unavailable</small>)}
    {iosHelp&&<p>In Safari, tap Share, then Add to Home Screen.</p>}
    {setupFailed&&<button onClick={()=>{setSetupFailed(false);setMessage('');setSetupAttempt(value=>value+1);}}>Retry offline setup</button>}
    {registration&&<>
      <button disabled={busy} onClick={()=>{
        if(!registration.active)return;
        setBusy(true);setMessage('');send(registration.active,ready?'status':'download');
      }}>{busy?'Downloading game files…':ready?'Check offline files':'Download for offline play'}</button>
      {status&&<span role="status">{ready?'Ready to play offline':
        `${status.done} / ${status.total} files · ${Math.ceil(status.bytes/1e6)} MB total`}</span>}
      {busy&&status&&<progress aria-label="Offline game files" value={status.done} max={status.total}/>}
    </>}
    {waiting&&<button disabled={busy} onClick={()=>{
      updating.current=true;setBusy(true);setMessage('');send(waiting,'activate');
    }}>Update available</button>}
    {message&&<p role="status">{message}</p>}
  </aside>;
}
