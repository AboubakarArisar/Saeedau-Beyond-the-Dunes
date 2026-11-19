import {chromium,devices,expect} from '@playwright/test';
import {createServer} from 'vite';
import {join} from 'node:path';

const server=await createServer({server:{host:'127.0.0.1',port:5173,strictPort:true},plugins:[{
  name:'saeedau-visual-verification',enforce:'pre',transform(code,id){
    if(!id.replaceAll('\\','/').endsWith('/src/scene.ts'))return;
    return code.replace('    const parked=options.title;',`
      const fixture=window.captureVillage;
      if(fixture){
        car.lateral=villageOrigin+fixture.x;
        car.position=LENGTH+villageJunction+fixture.d;
        car.heading=fixture.heading;
        car.speed=0;first=true;orbit=zoom=steering=0;run.leg=7;
        window.captureVillage=undefined;
        host.dataset.location=fixture.name;
      }
      const parked=options.title;
    `).replace('renderer.render(scene,view);',`renderer.render(scene,view);
      const rider=model.getObjectByName('RiderBody');
      if(rider){
        const left=model.getObjectByName('RiderHandL'),steer=steerAxles[0];
        const grip=new T.Vector3(-.30,.116,.051).applyQuaternion(steer.quaternion).add(steer.position);
        host.dataset.rider=JSON.stringify({pitch:rider.rotation.x,lean:rider.rotation.z,
          steering:steer.rotation.y,gripError:left.position.distanceTo(grip),speed:car.speed});
      }
    `);
  },
}]});
let browser;
try{
  await server.listen();
  browser=await chromium.launch({channel:'msedge',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const url='http://127.0.0.1:5173';
  const page=await browser.newPage({viewport:{width:1120,height:630},reducedMotion:'reduce'});
  const issues=[];
  page.on('pageerror',error=>issues.push(error.message));
  const button=name=>page.getByRole('button',{name,exact:true});
  const shot=(name,target=page)=>target.screenshot({path:join(process.env.SAEEDAU_SCREENSHOTS??'artifacts',name+'.png')});
  const rider=async()=>JSON.parse(await page.locator('.world').getAttribute('data-rider')??'null');
  const settle=target=>target.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  async function centered(target){
    const coin=await target.locator('.hud-coins').boundingBox();
    const speed=await target.locator('.hud-speed').boundingBox();
    const pause=await target.getByRole('button',{name:'Pause',exact:true}).boundingBox();
    expect(Math.abs(coin.x+coin.width/2-target.viewportSize().width/2)).toBeLessThan(2);
    expect(speed.x+speed.width).toBeLessThan(coin.x);
    expect(coin.x+coin.width).toBeLessThan(pause.x);
  }
  await page.addInitScript(()=>localStorage.setItem('saeedau.vehicle',JSON.stringify('unique')));
  await page.goto(url);await button('Garage').click();
  await expect.poll(async()=>(await rider())?.gripError??100).toBeLessThan(.001);
  await settle(page);await shot('unique70-rider-garage');
  await button('Back').click();await button('start journey').click();
  await button('Start Free Journey').click();await centered(page);
  await page.keyboard.down('w');
  try{
    await expect.poll(async()=>(await rider())?.pitch??0,{timeout:18000}).toBeLessThan(-.01);
    await shot('unique70-rider-acceleration');
    await page.keyboard.down('d');
    try{
      await expect.poll(async()=>(await rider())?.lean??0).toBeGreaterThan(.025);
      expect((await rider()).gripError).toBeLessThan(.001);
      await shot('unique70-rider-turn');
    }finally{await page.keyboard.up('d');}
  }finally{await page.keyboard.up('w');}
  await page.keyboard.down('Space');
  try{
    await expect.poll(async()=>(await rider())?.pitch??0).toBeGreaterThan(.025);
    await shot('unique70-rider-brake');
  }finally{await page.keyboard.up('Space');}
  await page.setViewportSize({width:1600,height:900});await centered(page);
  await page.setViewportSize({width:1120,height:630});
  await page.keyboard.press('r');

  for(const fixture of [
    {name:'junction',x:1,d:5,heading:0},
    {name:'hospital-branch',x:-74,d:57,heading:-1.03},
    {name:'hospital',x:-136,d:83,heading:-.19},
    {name:'school',x:-156,d:64,heading:-.99},
    {name:'rangers-checkpoint',x:-155,d:111,heading:-.56},
    {name:'residential-road',x:49,d:100,heading:1.49},
    {name:'siddique-faqeer-goth',x:91,d:104,heading:1.42},
    {name:'markan-faqeer-house',x:101,d:123,heading:1.55},
  ]){
    await page.evaluate(value=>{window.captureVillage=value;},fixture);
    await expect(page.locator('.world')).toHaveAttribute('data-location',fixture.name);
    await settle(page);
    await shot('saeedau-'+fixture.name);
  }
  await expect(page.locator('.hud-route')).toContainText('Markan Faqeer House reached');
  await button('Pause').click();await button('Finish journey').click();
  await expect(page.getByRole('heading',{name:'Homecoming complete'})).toBeVisible();
  expect(issues).toEqual([]);
  await page.close();

  const mobile=await browser.newPage({...devices['Pixel 7 landscape'],deviceScaleFactor:1,reducedMotion:'reduce'});
  await mobile.goto(url);
  await mobile.getByRole('button',{name:'start journey',exact:true}).tap();
  await mobile.getByRole('button',{name:'Start Free Journey',exact:true}).tap();
  await centered(mobile);await shot('centered-coins-mobile',mobile);
  await mobile.close();
  console.log('Rider pose and grip alignment, centered HUD on desktop and mobile, and village homecoming verified.');
}finally{
  try{await browser?.close();}finally{await server.close();}
}
