type Footprint = {x:number; z:number; width:number; length:number; sin:number; cos:number};
const cellSize=16;
const cell=(value:number)=>Math.floor(value/cellSize);
const key=(x:number,z:number)=>x+':'+z;

export class Colliders {
  private cells=new Map<string,Footprint[]>();

  add(box:Footprint){
    const width=Math.abs(box.cos)*box.width+Math.abs(box.sin)*box.length;
    const length=Math.abs(box.sin)*box.width+Math.abs(box.cos)*box.length;
    for(let x=cell(box.x-width);x<=cell(box.x+width);x++){
      for(let z=cell(box.z-length);z<=cell(box.z+length);z++){
        const index=key(x,z),bucket=this.cells.get(index);
        if(bucket)bucket.push(box);
        else this.cells.set(index,[box]);
      }
    }
  }

  query(x:number,z:number,dx:number,dz:number,radius:number,found:Set<Footprint>){
    for(let i=cell(Math.min(x,x+dx)-radius);i<=cell(Math.max(x,x+dx)+radius);i++){
      for(let j=cell(Math.min(z,z+dz)-radius);j<=cell(Math.max(z,z+dz)+radius);j++){
        for(const box of this.cells.get(key(i,j))??[])found.add(box);
      }
    }
  }
}

export function sweep(vehicle:Footprint,dx:number,dz:number,solids:Iterable<Footprint>){
  const extent=(box:Footprint,x:number,z:number)=>
    box.width*Math.abs(x*box.cos-z*box.sin)+box.length*Math.abs(x*box.sin+z*box.cos);
  let hit:{time:number;x:number;z:number}|undefined;
  for(const box of solids){
    let entry=-Infinity,exit=Infinity,nx=0,nz=0,penetration=Infinity,px=0,pz=0;
    // The two face normals from each rectangle also bound rotated contacts.
    for(const [x,z] of [[vehicle.cos,-vehicle.sin],[vehicle.sin,vehicle.cos],[box.cos,-box.sin],[box.sin,box.cos]]){
      const offset=(vehicle.x-box.x)*x+(vehicle.z-box.z)*z;
      const movement=dx*x+dz*z;
      const radius=extent(vehicle,x,z)+extent(box,x,z);
      const overlap=radius-Math.abs(offset);
      if(overlap<penetration){penetration=overlap;px=x*Math.sign(offset);pz=z*Math.sign(offset);}
      if(Math.abs(movement)<1e-8){
        if(overlap<0){entry=Infinity;break;}
        continue;
      }
      const near=(-Math.sign(movement)*radius-offset)/movement;
      const far=(Math.sign(movement)*radius-offset)/movement;
      if(near>entry){entry=near;nx=-Math.sign(movement)*x;nz=-Math.sign(movement)*z;}
      exit=Math.min(exit,far);
    }
    if(entry>exit||exit<=0||entry>1)continue;
    if(entry<0){
      // Rotation or loading a chunk can leave a car overlapping. Let it back out.
      if(penetration<=0||dx*px+dz*pz>=0)continue;
      entry=0;nx=px;nz=pz;
    }
    if(!hit||entry<hit.time)hit={time:entry,x:nx,z:nz};
  }
  return hit;
}

export function moveThrough(vehicle:Footprint,dx:number,dz:number,grids:Iterable<Colliders>){
  const nearby=new Set<Footprint>();
  const radius=Math.hypot(vehicle.width,vehicle.length);
  for(const grid of grids)grid.query(vehicle.x,vehicle.z,dx,dz,radius+.1,nearby);
  const hit=sweep(vehicle,dx,dz,nearby);
  if(!hit)return {dx,dz,impact:0};
  const fraction=Math.max(0,hit.time-.002/Math.max(Math.hypot(dx,dz),.002));
  const along=dx*hit.x+dz*hit.z;
  const slideX=(dx-along*hit.x)*(1-hit.time),slideZ=(dz-along*hit.z)*(1-hit.time);
  const follow=sweep({...vehicle,x:vehicle.x+dx*fraction,z:vehicle.z+dz*fraction},slideX,slideZ,nearby);
  const slide=follow?Math.max(0,follow.time-.01):1;
  return {dx:dx*fraction+slideX*slide,dz:dz*fraction+slideZ*slide,impact:Math.abs(along)};
}
