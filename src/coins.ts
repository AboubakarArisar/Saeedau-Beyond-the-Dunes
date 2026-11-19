import {checkpoints,junction,road,type Vehicle,vehicles} from './driving';

export const coinValue=10;
export type Coin={id:number;distance:number;lateral:number};

const coins:Coin[]=[];
function coin(distance:number,lateral:number){
  coins.push({id:coins.length,distance,lateral});
}
function sequence(begin:number,spacing:number,offset:number,count=4){
  for(let i=0;i<count;i++){
    const distance=begin+spacing*i;
    coin(distance,road(distance)+offset);
  }
}
sequence(32,8,0);
sequence(1647,9,1.15);
sequence(2965,9,0);
for(let leg=1;leg<checkpoints.length;leg++){
  const begin=checkpoints[leg-1],end=checkpoints[leg];
  sequence(begin+(end-begin)*.43,9,leg%2===0?-1.35:1.35);
  if(end!==junction)sequence(end-50,8,0,3);
}
for(const offset of [-13,-19,-25,-31])coin(junction+1.2,road(junction)+offset);
for(const [distance,side] of [[31,-1],[checkpoints[4]+72,-1],[checkpoints[5]+42,1]]){
  for(let index=0;index<3;index++){
    const d=distance+(index-1)*3.2;
    coin(d,road(d)+side*(5.85+index*.64));
  }
}

const bandSize=24;
const bands=new Map<number,Coin[]>();
for(const item of coins){
  const band=Math.floor(item.distance/bandSize);
  if(!bands.has(band))bands.set(band,[]);
  bands.get(band)!.push(item);
}
export function* coinsBetween(from:number,to:number){
  for(let band=Math.floor(from/bandSize);band<=Math.floor(to/bandSize);band++){
    for(const item of bands.get(band)??[]){
      if(item.distance>=from&&item.distance<=to)yield item;
    }
  }
}

export function collectCoins(
  collected:Set<number>,blocked:ReadonlySet<number>,from:{lateral:number;position:number},
  to:{lateral:number;position:number;heading:number},vehicle:Vehicle,onPickup:(coin:Coin)=>void,
){
  const profile=vehicles[vehicle],sin=Math.sin(to.heading),cos=Math.cos(to.heading);
  const x=from.lateral+sin*profile.center,z=from.position+cos*profile.center;
  const dx=to.lateral-from.lateral,dz=to.position-from.position;
  const vx=dx*cos-dz*sin,vz=dx*sin+dz*cos;
  const pickupRadius=.39,reach=profile.length+Math.abs(profile.center)+profile.width+pickupRadius;
  for(const item of coinsBetween(Math.min(from.position,to.position)-reach,Math.max(from.position,to.position)+reach)){
    if(collected.has(item.id)||blocked.has(item.id))continue;
    const localX=(item.lateral-x)*cos-(item.distance-z)*sin;
    const localZ=(item.lateral-x)*sin+(item.distance-z)*cos;
    // Sweep the vehicle footprint expanded by the coin's radius.
    let enter=0,leave=1;
    for(const [offset,travel,extent] of [[localX,vx,profile.width+pickupRadius],[localZ,vz,profile.length+pickupRadius]]){
      if(Math.abs(travel)<1e-8){
        if(Math.abs(offset)>extent){enter=Infinity;break;}
      }else{
        const a=(offset-extent)/travel,b=(offset+extent)/travel;
        enter=Math.max(enter,Math.min(a,b));leave=Math.min(leave,Math.max(a,b));
      }
    }
    if(enter>leave)continue;
    collected.add(item.id);
    onPickup(item);
  }
}
