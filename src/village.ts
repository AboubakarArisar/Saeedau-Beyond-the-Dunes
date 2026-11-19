// Metres relative to the Saeedau junction. The sketch establishes directions,
// landmark order and two right-side segments, rather than surveyed coordinates.
export const villageJunction=64;
export const villageDepth=224;
export const villageWidth=220;
type Point=readonly [number,number];

function curve(a:Point,b:Point,c:Point,d:Point,count:number):Point[]{
  return Array.from({length:count+1},(_,index)=>{
    const t=index/count,s=1-t;
    return [0,1].map(i=>s**3*a[i]+3*s*s*t*b[i]+3*s*t*t*c[i]+t**3*d[i]) as [number,number];
  });
}
export const villageRoads=[
  {width:7.2,paved:true,points:curve([0,-3],[-3,18],[-71,55],[-131,88],46)},
  {width:6.8,paved:true,points:curve([0,-3],[3,19],[17,64],[26,91],33)},
  {width:5.6,paved:false,points:curve([25,89],[29,104],[60,99],[103,105],30)},
] as const;

export const villagePlaces=[
  {name:'Saeedau Junction',x:0,d:2,radius:10},
  {name:'Hospital',x:-140,d:90,radius:12},
  {name:'School',x:-164,d:71,radius:12},
  {name:'Rangers Checkpoint',x:-164,d:122,radius:12},
  {name:'Siddique Faqeer Goth',x:98,d:105,radius:9},
  {name:'Markan Faqeer House',x:106,d:120,radius:7},
] as const;
export const villageHomes=[
  {x:116,d:140,round:true},{x:116,d:123,round:false,markan:true},
  {x:116,d:105,round:true},{x:116,d:88,round:false},
  {x:134,d:141,round:false},{x:136,d:123,round:true},
  {x:135,d:104,round:false},{x:134,d:87,round:true},
] as const;

export function villageRoadDistance(x:number,d:number,pavedOnly=false){
  if(d< -8||d>155)return Infinity;
  let edge=Infinity;
  for(const lane of villageRoads){
    if(pavedOnly&&!lane.paved)continue;
    const {points,width}=lane;
    for(let index=1;index<points.length;index++){
      const [ax,ad]=points[index-1],[bx,bd]=points[index];
      const dx=bx-ax,dd=bd-ad;
      const t=Math.max(0,Math.min(1,((x-ax)*dx+(d-ad)*dd)/(dx*dx+dd*dd)));
      edge=Math.min(edge,Math.hypot(x-ax-dx*t,d-ad-dd*t)-width/2);
    }
  }
  return edge;
}
