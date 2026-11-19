const prefix='saeedau-game-';
const cacheName=prefix+BUILD.version;
const inventory='/__saeedau_cache_inventory__';
const required=[...BUILD.shell,...BUILD.packs];
const paths=new Set(required);
let download;

async function save(cache,path){
  const audio=path.endsWith('.mp3');
  const url=path==='/index.html'?'/':path;
  const response=await fetch(url+'?offline='+BUILD.version,{cache:'no-store',redirect:'error',
    headers:audio?{Range:'bytes=0-'}:undefined});
  if(!response.ok||(response.status!==200&&!(audio&&response.status===206))||
    (path!=='/index.html'&&response.headers.get('content-type')?.includes('text/html')))throw new Error('Asset unavailable ('+response.status+', '+response.headers.get('content-type')+'): '+path);
  const bytes=await response.arrayBuffer();
  const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),byte=>byte.toString(16).padStart(2,'0')).join('');
  if(digest!==BUILD.hashes[path])throw new Error('Asset changed: '+path);
  await cache.put(path,new Response(bytes,{headers:{'Content-Type':response.headers.get('content-type')??'application/octet-stream'}}));
}

self.addEventListener('install',event=>{
  event.waitUntil((async()=>{
    const cache=await caches.open(cacheName);
    await Promise.all(BUILD.shell.map(path=>save(cache,path)));
    for(const name of await caches.keys()){
      if(!name.startsWith(prefix)||name===cacheName)continue;
      const old=await caches.open(name);
      const previous=await (await old.match(inventory))?.json();
      if(!previous)continue;
      for(const path of BUILD.packs){
        if(previous[path]!==BUILD.hashes[path]||await cache.match(path))continue;
        const entry=await old.match(path);
        if(entry){
          try{await cache.put(path,entry);}
          catch(error){
            if(error.name!=='QuotaExceededError')throw error;
            break;
          }
        }
      }
    }
    await cache.put(inventory,Response.json(BUILD.hashes));
  })());
});

self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    for(const name of await caches.keys()){
      if(name.startsWith(prefix)&&name!==cacheName)await caches.delete(name);
    }
    await self.clients.claim();
  })());
});

async function offlineStatus(cache){
  const matches=await Promise.all(required.map(path=>cache.match(path)));
  return {done:matches.filter(Boolean).length,total:required.length,bytes:BUILD.bytes};
}

self.addEventListener('message',event=>{
  const channel=event.ports[0];
  if(!channel)return;
  event.waitUntil((async()=>{
    try{
      if(event.data==='activate'){
        const clients=await self.clients.matchAll({type:'window',includeUncontrolled:true});
        if(clients.length>1)throw new Error('Close other Saeedau tabs before updating.');
        await self.skipWaiting();
      }else if(event.data==='download'||event.data==='status'){
        const cache=await caches.open(cacheName);
        if(event.data==='download'){
          const start=!download;
          if(start)download=(async()=>{
            for(const path of required)if(!await cache.match(path)){
              await save(cache,path);
              channel.postMessage({progress:await offlineStatus(cache)});
            }
          })().finally(()=>{download=undefined;});
          await download;
        }
        channel.postMessage({status:await offlineStatus(cache)});
      }
    }catch(error){
      console.warn('Offline operation failed',error);
      channel.postMessage({error:error.name==='QuotaExceededError'?
        'Storage is full. Free up browser storage and retry.':
        event.data==='activate'?error.message:'Download interrupted or an asset is missing. Reconnect and retry.'});
    }
  })());
});

async function audioRange(response,range){
  const match=/^bytes=(\d*)-(\d*)$/.exec(range);
  const audio=await response.blob(),size=audio.size;
  const start=match?.[1]?Number(match[1]):Math.max(0,size-Number(match?.[2]));
  const end=match?.[1]&&match[2]?Math.min(size-1,Number(match[2])):size-1;
  if(!match||!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start>end||start>=size)
    return new Response(null,{status:416,headers:{'Content-Range':'bytes */'+size}});
  return new Response(audio.slice(start,end+1),{status:206,headers:{
    'Content-Type':audio.type||'audio/mpeg','Accept-Ranges':'bytes',
    'Content-Length':String(end-start+1),'Content-Range':`bytes ${start}-${end}/${size}`,
  }});
}

self.addEventListener('fetch',event=>{
  const request=event.request,url=new URL(request.url);
  if(request.method!=='GET'||url.origin!==self.location.origin)return;
  if(request.mode==='navigate'&&(url.pathname==='/'||url.pathname==='/index.html')){
    event.respondWith(caches.open(cacheName).then(async cache=>(await cache.match('/index.html'))??fetch(request)));
    return;
  }
  if(!paths.has(url.pathname)||url.search)return;
  event.respondWith((async()=>{
    const cache=await caches.open(cacheName),cached=await cache.match(request);
    if(!cached)return fetch(request);
    const range=request.headers.get('range');
    return range&&url.pathname.endsWith('.mp3')?audioRange(cached,range):cached;
  })());
});
