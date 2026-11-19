import {checkpoints,LENGTH,road,start,stops,villageOrigin,type Drive} from './driving';
import {villageJunction,villageRoads} from './village';

type Point={lateral:number;position:number};
type Node=Point&{parent?:Node;name?:string};
const distance=(a:Point,b:Point)=>Math.hypot(a.lateral-b.lateral,a.position-b.position);
const highway=(position:number):Point=>({lateral:road(position),position});
const village=([x,d]:readonly [number,number]):Point=>({lateral:villageOrigin+x,position:LENGTH+villageJunction+d});

const locations=new Map<string,Node>();
function branch(parent:Node|undefined,points:Point[],name:string):Node{
  for(const point of points){
    if(parent&&distance(parent,point)<.001)continue;
    parent={...point,parent};
  }
  if(!parent)throw new Error('Journey branch requires a road point');
  parent.name=name;
  locations.set(name,parent);
  return parent;
}

let approach:Node|undefined;
for(const [index,name] of stops.entries()){
  const end=checkpoints[index],begin=approach?.position??start().position;
  const count=Math.max(1,Math.ceil((end-begin)/8));
  const points=index?Array.from({length:count},(_,i)=>highway(begin+(end-begin)*(i+1)/count)):[highway(begin)];
  approach=branch(approach,points,name);
}
const [hospitalRoad,gothRoad,track]=villageRoads;
const junctionEnd=LENGTH+villageJunction-3;
const junction=branch(approach,[
  ...Array.from({length:7},(_,i)=>highway(LENGTH+(junctionEnd-LENGTH)*(i+1)/8)),
  village(hospitalRoad.points[0]),
],'Saeedau Junction');
const hospital=branch(junction,[...hospitalRoad.points.map(village),village([-137,89]),village([-142,89])],'Hospital');
branch(hospital,[village([-148,87]),village([-152,80]),village([-152,71])],'School');
const goth=branch(junction,[...gothRoad.points.slice(1,-1).map(village),...track.points.slice(0,-3).map(village)],'Siddique Faqeer Goth');
branch(goth,[village([100,107]),village([102,111]),village([104,117]),village([104,121])],'Markan Faqeer House');

export const journeyLocations=[...locations.keys()];
export type JourneySelection={from:string;to:string};
export type JourneyRoute=JourneySelection&{points:Node[];metres:number[];nextName:string[];length:number;spawn:Drive};
export function planJourney({from,to}:JourneySelection):JourneyRoute|undefined{
  const origin=locations.get(from),target=locations.get(to);
  if(!origin||!target||origin===target)return;
  const ancestors=(node:Node)=>{
    const nodes:Node[]=[];
    for(let current:Node|undefined=node;current;current=current.parent)nodes.push(current);
    return nodes;
  };
  const outward=ancestors(origin),inward=ancestors(target);
  let common:Node|undefined;
  while(outward.length&&inward.length&&outward.at(-1)===inward.at(-1)){
    common=outward.pop();inward.pop();
  }
  if(!common)return;
  const points=[...outward,common,...inward.reverse()];
  const metres=[0],nextName:string[]=Array(points.length).fill(to);
  for(let i=1;i<points.length;i++)metres.push(metres[i-1]+distance(points[i-1],points[i]));
  for(let i=points.length-2;i>0;i--)nextName[i]=points[i].name??nextName[i+1];
  const first=points[1];
  const spawn={lateral:origin.lateral,position:origin.position,speed:0,
    heading:Math.atan2(first.lateral-origin.lateral,first.position-origin.position)};
  return {from,to,points,metres,nextName,length:metres.at(-1)!,spawn};
}

export type JourneyProgress={gate:number;metres:number;driven:number;remaining:number;next:string;turn:string};
export function journeyProgress(route:JourneyRoute):JourneyProgress{
  return {gate:1,metres:0,driven:0,remaining:route.length,next:route.nextName[1],turn:'Straight ahead'};
}

export function followJourney(route:JourneyRoute,progress:JourneyProgress,previous:Point,car:Drive){
  progress.driven+=distance(previous,car);
  let gate=progress.gate;
  // Follow the centreline in order. Passing near a later point cannot skip a branch or checkpoint.
  while(gate<route.points.length&&distance(car,route.points[gate])<=
    (gate===route.points.length-1?3:route.points[gate].position>LENGTH?3.4:4.75))gate++;
  progress.gate=gate;
  if(gate===route.points.length){
    progress.metres=route.length;progress.remaining=0;
    return true;
  }
  const a=route.points[gate-1],b=route.points[gate],dx=b.lateral-a.lateral,dz=b.position-a.position;
  const segment=route.metres[gate]-route.metres[gate-1];
  const along=((car.lateral-a.lateral)*dx+(car.position-a.position)*dz)/segment;
  const across=Math.abs((car.lateral-a.lateral)*dz-(car.position-a.position)*dx)/segment;
  if(across<=5)progress.metres=Math.max(progress.metres,route.metres[gate-1]+Math.min(segment*.99,Math.max(0,along)));
  progress.remaining=route.length-progress.metres;
  progress.next=route.nextName[gate];
  let look=gate;
  while(along<=segment&&look+1<route.points.length&&route.metres[look]-route.metres[gate]<13)look++;
  const aim=route.points[look];
  const angle=Math.atan2(aim.lateral-car.lateral,aim.position-car.position)-car.heading;
  const turn=Math.atan2(Math.sin(angle),Math.cos(angle));
  progress.turn=Math.abs(turn)>2.35?'Turn around':turn<-.32?'Keep left':turn>.32?'Keep right':'Straight ahead';
  return false;
}
