import {chromium,expect} from '@playwright/test';
import {createServer} from 'vite';
import {join} from 'node:path';

const server=await createServer({
  server:{host:'127.0.0.1',port:5173,strictPort:true},
  plugins:[{name:'check-vehicle-rigs',enforce:'pre',transform(code,id){
    if(!id.replaceAll('\\','/').endsWith('/src/scene.ts'))return;
    return code.replace('renderer.render(scene,view);',`renderer.render(scene,view);
      const area=options.previewFrame.current?.getBoundingClientRect();
      let margin=0,primitives=0,triangles=0;
      model.traverse(item=>{
        if(!(item instanceof T.Mesh))return;
        primitives++;
        triangles+=(item.geometry.index?.count??item.geometry.attributes.position.count)/3;
      });
      if(area&&primitives){
        const {min,max}=new T.Box3().setFromObject(model);
        margin=Infinity;
        for(const x of [min.x,max.x])for(const y of [min.y,max.y])for(const z of [min.z,max.z]){
          const point=new T.Vector3(x,y,z).project(view);
          const px=(point.x+1)*previewWidth/2,py=(1-point.y)*previewHeight/2;
          margin=Math.min(margin,px-area.left,area.right-px,py-area.top,area.bottom-py);
        }
      }
      host.dataset.rig=JSON.stringify({vehicle:visibleVehicle,margin,primitives,triangles,
        wheels:tires.map(wheel=>wheel.rotation.x),steer:steerAxles.map(axle=>axle.rotation.y)});
    `);
  }}],
});
let browser;
try{
  await server.listen();
  browser=await chromium.launch({channel:'msedge',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const url='http://127.0.0.1:5173';
  for(const [vehicle,file,name,wheels,steer] of [
    ['kekro','kekro','Kekro',6,2],['unique','unique70','Unique 70 motorcycle',2,1],
  ]){
    const page=await browser.newPage({viewport:{width:1120,height:630},reducedMotion:'reduce'});
    const issues=[];
    page.on('pageerror',error=>issues.push(error.message));
    const button=label=>page.getByRole('button',{name:label,exact:true});
    const rig=async()=>JSON.parse(await page.locator('.world').getAttribute('data-rig')??'null');
    const shot=screen=>page.screenshot({
      path:join(process.env.SAEEDAU_SCREENSHOTS??'artifacts',file+'-'+screen+'.png'),
    });
    await page.addInitScript(value=>localStorage.setItem('saeedau.vehicle',JSON.stringify(value)),vehicle);
    const requested=page.waitForResponse(response=>response.url().endsWith('/vehicles/'+file+'.glb')&&response.ok());
    await page.goto(url);
    await requested;
    await button('Garage').click();
    await expect.poll(async()=>{
      const state=await rig();
      return state?.vehicle===vehicle&&state.wheels.length===wheels?state.margin:-100;
    },{timeout:16000}).toBeGreaterThan(0);
    const inGarage=await rig();
    expect(inGarage.primitives).toBeLessThan(24);
    expect(inGarage.triangles).toBeLessThan(30000);
    console.log(name,JSON.stringify(inGarage));
    await shot('garage');
    await button('Back').click();
    await button('start journey').click();
    await expect.poll(async()=>{
      const state=await rig();
      return state?.vehicle===vehicle&&state.wheels.length===wheels?state.margin:-100;
    }).toBeGreaterThan(0);
    await button('Start Free Journey').click();
    await expect(page.locator('.hud-vehicle')).toHaveText(name);
    const speed=()=>page.locator('.hud-speed strong').evaluate(el=>Number(el.textContent));
    await page.keyboard.down('w');
    try{
      await expect.poll(speed,{timeout:20000}).toBeGreaterThan(8);
      await expect.poll(async()=>(await rig())?.wheels.some(value=>Math.abs(value)>.2)).toBe(true);
      await page.keyboard.down('a');
      try{
        await expect.poll(async()=>{
          const state=await rig();
          return state?.steer.length===steer&&state.steer.every(value=>value>.05);
        }).toBe(true);
      }finally{await page.keyboard.up('a');}
    }finally{await page.keyboard.up('w');}
    await page.mouse.move(340,310);
    await page.mouse.down();
    try{await page.mouse.move(559,310,{steps:5});}finally{await page.mouse.up();}
    await shot('driving');
    expect(issues).toEqual([]);
    await page.close();
  }
}finally{
  try{await browser?.close();}finally{await server.close();}
}
