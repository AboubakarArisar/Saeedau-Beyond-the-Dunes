import {chromium,devices,expect} from '@playwright/test';
import {join} from 'node:path';
import {createServer} from 'vite';

const port=Number(process.env.SAEEDAU_TEST_PORT??5173);
const server=await createServer({
  server:{host:'127.0.0.1',port,strictPort:true},
  plugins:[{name:'showroom-verification',enforce:'pre',transform(code,id){
    if(!id.replaceAll('\\','/').endsWith('/src/scene.ts'))return;
    return code.replace('renderer.render(scene,view);',`renderer.render(scene,view);
      if(options.preview&&options.previewFrame.current){
        const {min,max}=new T.Box3().setFromObject(model);
        const area=options.previewFrame.current.getBoundingClientRect();
        const points=[];
        for(const x of [min.x,max.x])for(const y of [min.y,max.y])for(const z of [min.z,max.z]){
          const p=new T.Vector3(x,y,z).project(view);
          points.push([(p.x+1)*previewWidth/2,(1-p.y)*previewHeight/2]);
        }
        const margin=Math.min(...points.map(([x,y])=>Math.min(x-area.left,area.right-x,y-area.top,area.bottom-y)));
        host.dataset.showroom=JSON.stringify({margin,angle:showroomAngle,distance:showroomDistance,vehicle:activeVehicle});
      }`);
  }}],
});
let browser;
try{
  await server.listen();
  browser=await chromium.launch({channel:'msedge',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const base='http://127.0.0.1:'+port;
  const errors=[];
  const desktop=await browser.newPage({viewport:{width:1440,height:900},reducedMotion:'reduce'});
  const button=(page,name)=>page.getByRole('button',{name,exact:true});
  const shot=(page,name)=>page.screenshot({path:join(process.env.SAEEDAU_SCREENSHOTS??'artifacts','showroom-'+name+'.png')});
  const state=async page=>JSON.parse(await page.locator('.world').getAttribute('data-showroom')??'null');
  async function framed(page,vehicle){
    await expect.poll(async()=>{
      const info=await state(page);
      return info?.vehicle===vehicle?info.margin:-100;
    },{timeout:15000}).toBeGreaterThan(0);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(await page.evaluate(()=>innerWidth));
  }
  async function ready(page){
    page.on('pageerror',error=>errors.push(error.message));
    const models=page.waitForResponse(response=>response.url().endsWith('/vehicles/long-chassis.glb')&&response.ok());
    await page.goto(base);await models;
    await page.evaluate(()=>document.fonts.ready);
  }
  await ready(desktop);
  await button(desktop,'start journey').click();
  await expect(desktop.getByRole('heading',{name:'Choose your journey'})).toBeVisible();
  await framed(desktop,'jeep');
  await shot(desktop,'modes-desktop');
  await desktop.getByRole('button',{name:/Speed Racing Race against time/}).click();
  await expect(desktop.getByRole('button',{name:/Speed Racing Race against time/})).toHaveAttribute('aria-pressed','true');
  await expect(desktop.getByText('Reach Saeedau through all seven checkpoints. Impacts and shortcuts add time.')).toBeVisible();
  await button(desktop,'Monsoon').click();
  await expect(button(desktop,'Monsoon')).toHaveAttribute('aria-pressed','true');
  await button(desktop,'Summer').click();
  await button(desktop,'Garage').click();
  await expect(desktop.locator('[data-radio]')).toHaveCount(0);
  await framed(desktop,'jeep');await shot(desktop,'long-chassis');
  await button(desktop,'Previous vehicle').click();
  await framed(desktop,'kekro');await shot(desktop,'kekro');
  await desktop.keyboard.press('ArrowLeft');
  await framed(desktop,'unique');await shot(desktop,'unique-70');
  const preview=desktop.getByRole('region',{name:'Interactive 3D vehicle preview'});
  await preview.focus();
  const before=await state(desktop);
  await desktop.keyboard.press('ArrowRight');
  await expect.poll(async()=>(await state(desktop))?.angle).not.toBe(before.angle);
  await desktop.keyboard.press('Equal');
  await expect.poll(async()=>(await state(desktop))?.distance).toBeLessThan(before.distance);
  const stage=await preview.boundingBox();
  const angle=(await state(desktop)).angle;
  await desktop.mouse.move(stage.x+stage.width/2,stage.y+stage.height/2);
  await desktop.mouse.down();
  await desktop.mouse.move(stage.x+stage.width/2+90,stage.y+stage.height/2,{steps:5});
  await desktop.mouse.up();
  await expect.poll(async()=>(await state(desktop))?.angle).not.toBe(angle);
  const distance=(await state(desktop)).distance;
  await desktop.mouse.wheel(0,-160);
  await expect.poll(async()=>(await state(desktop))?.distance).toBeLessThan(distance);
  await framed(desktop,'unique');
  await button(desktop,'Back').click();
  await expect(button(desktop,'Start Speed Racing')).toBeVisible();
  await desktop.close();

  const mobile=await browser.newPage({...devices['Pixel 7'],deviceScaleFactor:1,reducedMotion:'reduce'});
  await ready(mobile);
  await button(mobile,'start journey').tap();
  await framed(mobile,'jeep');await shot(mobile,'modes-mobile');
  await button(mobile,'Garage').tap();
  await framed(mobile,'jeep');await shot(mobile,'garage-mobile');
  const mobilePreview=mobile.getByRole('region',{name:'Interactive 3D vehicle preview'});
  const bounds=await mobilePreview.boundingBox();
  const x=bounds.x+bounds.width/2,y=bounds.y+bounds.height/2;
  const cdp=await mobile.context().newCDPSession(mobile);
  const zoomBefore=(await state(mobile)).distance;
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:x-30,y,id:1},{x:x+30,y,id:2}]});
  try{
    await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x-80,y,id:1},{x:x+80,y,id:2}]});
    await expect.poll(async()=>(await state(mobile))?.distance).toBeLessThan(zoomBefore);
  }finally{await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}
  await framed(mobile,'jeep');
  await button(mobile,'Next vehicle').tap();
  await framed(mobile,'unique');
  const selector=await mobile.getByRole('group',{name:'Vehicle selection'}).boundingBox();
  const swipeX=selector.x+selector.width/2,swipeY=selector.y+selector.height/2;
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:swipeX,y:swipeY}]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:swipeX+65,y:swipeY}]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await framed(mobile,'jeep');
  await mobile.setViewportSize({width:844,height:390});
  await framed(mobile,'jeep');
  await button(mobile,'Back').tap();
  await expect(button(mobile,'Start Free Journey')).toBeVisible();
  await mobile.setViewportSize({width:320,height:568});
  await mobile.getByRole('button',{name:/Checkpoint Challenge Every second counts/}).tap();
  await framed(mobile,'jeep');
  await expect(button(mobile,'Start Checkpoint Challenge')).toBeVisible();
  await mobile.setViewportSize({width:844,height:390});
  await button(mobile,'Start Checkpoint Challenge').tap();
  await expect(mobile.getByRole('complementary',{name:'Driving dashboard'})).toContainText('Checkpoint Challenge');
  expect(errors).toEqual([]);
  console.log('Desktop and mobile framing, selection, keyboard controls, drag, wheel, pinch, swipe, and starting a run passed.');
}finally{
  try{await browser?.close();}finally{await server.close();}
}
