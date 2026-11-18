export const playlist='PLijildE23Nm50i6eauzKr1v0CpUTNmh06';
export const playlistUrl='https://www.youtube.com/playlist?list='+playlist;
export type Player={
  playVideo():void;pauseVideo():void;nextVideo():void;previousVideo():void;destroy():void;
  setVolume(value:number):void;getPlayerState():number;getCurrentTime():number;getDuration():number;
  getPlaylistIndex():number;getVideoUrl():string;
};
type Event={target:Player;data:number};
type Api={Player:new(element:HTMLElement,options:{
  width:string;height:string;playerVars:Record<string,string|number>;
  events:Record<string,(event:Event)=>void>;
})=>Player};
const global=window as Window&{YT?:Api;onYouTubeIframeAPIReady?:()=>void};
let pending:Promise<Api>|undefined;
export function loadYouTube(){
  if(global.YT?.Player)return Promise.resolve(global.YT);
  if(pending)return pending;
  pending=new Promise<Api>((resolve,reject)=>{
    const script=document.createElement('script');
    const oldCallback=global.onYouTubeIframeAPIReady;
    const cleanup=()=>{clearTimeout(timer);script.onerror=null;global.onYouTubeIframeAPIReady=oldCallback;};
    const fail=()=>{cleanup();script.remove();pending=undefined;reject(new Error('YouTube could not connect'));};
    const timer=window.setTimeout(fail,12000);
    global.onYouTubeIframeAPIReady=()=>{cleanup();if(global.YT?.Player)resolve(global.YT);else fail();oldCallback?.();};
    script.onerror=fail;script.src='https://www.youtube.com/iframe_api';script.async=true;
    document.head.append(script);
  });
  return pending;
}
