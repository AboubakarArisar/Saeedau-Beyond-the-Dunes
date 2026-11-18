import {checkpoints, LENGTH, road, type Drive} from './driving';
import type {Season} from './seasons';
import type {Vehicle} from './driving';

export const modes={
  journey:{name:'Free Journey',objective:'Follow the route from Umerkot to Saeedau at your own pace.'},
  race:{name:'Speed Racing',objective:'Reach Saeedau through all seven checkpoints. Impacts and shortcuts add time.'},
  challenge:{name:'Checkpoint Challenge',objective:'Beat the clock. Each checkpoint adds time for the next leg.'},
  explorer:{name:'Desert Explorer',objective:'Visit roadside places and village compounds. Finish whenever you like.'},
} as const;
export type Mode=keyof typeof modes;
export const places=[
  {name:'Umerkot tea stall',distance:31,offset:-15.5},
  {name:'Chhor market',distance:checkpoints[1]-32,offset:12.9},
  {name:'Jeelani Mor junction',distance:checkpoints[2],offset:-24},
  {name:'Tebhri Bhanbhra chounra compound',distance:checkpoints[3]+41,offset:17},
  {name:'Dodhar village tea stall',distance:checkpoints[4]+72,offset:-11},
  {name:'Pataho chounra compound',distance:checkpoints[5]+42,offset:18},
  {name:'Hingorao village trough',distance:checkpoints[6]+75,offset:18},
] as const;
export const stageTime=(leg:number)=>[76,69,72,74,70,73,67][leg]??0;
export type Run=ReturnType<typeof newRun>;
export function newRun(mode:Mode){
  return {mode,seconds:0,countdown:mode==='race'?3:0,remaining:stageTime(0),offRoad:0,impacts:0,crashes:0,
    progress:0,leg:0,discoveries:0,outcome:null as 'finished'|'timeout'|null};
}
export function discover(run:Run,car:Drive){
  if(run.mode!=='explorer')return;
  places.forEach(({distance,offset},index)=>{
    if(Math.hypot(car.position-distance,car.lateral-road(distance)-offset)<=7)run.discoveries|=1<<index;
  });
}
export const discoveries=(mask:number)=>places.filter((_,index)=>mask&(1<<index));
export function checkpoint(run:Run,leg:number){
  if(leg!==run.leg+1||leg>=checkpoints.length)return;
  run.leg=leg;
  if(leg===checkpoints.length-1){
    if(run.mode!=='explorer')run.outcome='finished';
  }else if(run.mode==='challenge'){
    run.remaining=Math.min(14,run.remaining)+stageTime(leg);
  }
}
export function tick(run:Run,seconds:number){
  if(run.outcome)return false;
  if(run.countdown>0){
    run.countdown=Math.max(0,run.countdown-seconds);
    return false;
  }
  run.seconds+=seconds;
  if(run.mode==='challenge'){
    run.remaining=Math.max(0,run.remaining-seconds);
    if(run.remaining===0){run.outcome='timeout';return false;}
  }
  return true;
}
export const raceTime=(run:Run)=>run.seconds+run.impacts*3+run.crashes*3+run.offRoad*.7;
export function score(run:Run){
  const found=discoveries(run.discoveries).length;
  const completed=run.outcome==='finished';
  const breakdown={
    'Route distance':Math.floor(Math.min(LENGTH,run.progress)/25),
    Checkpoints:run.leg*100,
    Completion:completed&&run.leg===7?400:0,
    'Clean driving':run.impacts===0?run.leg*35:0,
    Discoveries:found*150,
    'Explorer objective':found>=5?300:0,
    'Time bonus':completed&&run.mode==='race'?Math.max(0,Math.floor((490-raceTime(run))*2)):
      completed&&run.mode==='challenge'?Math.floor(run.remaining*5):0,
    Penalties:-(run.impacts*45+run.crashes*55+(run.mode==='race'||run.mode==='challenge'?Math.floor(run.offRoad*6):0)+(run.outcome==='timeout'?125:0)),
  };
  return {breakdown,total:Math.max(0,Object.values(breakdown).reduce((sum,value)=>sum+value,0))};
}
export type Records=Record<string,{score:number;time?:number}>;
export const recordKey=(mode:Mode,vehicle:Vehicle,season:Season)=>[mode,vehicle,season].join('.');
export function record(records:Records,key:string,run:Run):Records{
  const previous=records[key],time=run.mode==='race'&&run.outcome==='finished'?raceTime(run):previous?.time;
  return {...records,[key]:{score:Math.max(previous?.score??0,score(run).total),
    time:time===undefined?undefined:Math.min(previous?.time??Infinity,time)}};
}
