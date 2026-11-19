import {chromium,devices,expect} from '@playwright/test';
import {createServer} from 'vite';
import {join} from 'node:path';

const server=await createServer({server:{host:'127.0.0.1',port:5181,strictPort:true},plugins:[{
  name:'custom-journey-verification',enforce:'pre',transform(code,id){
    if(!id.replaceAll('\\','/').endsWith('/src/scene.ts'))return;
    return code.replace('        const {position,lateral}=car;',`
        if(customRoute&&run.custom&&window.customFixture){
          const target=window.customFixture==='destination'?customRoute.points.at(-1):customRoute.points[run.custom.gate];
          car.position=target.position;
          car.lateral=target.lateral;
          car.speed=0;
          if(window.customFixture==='destination')window.customFixture=undefined;
        }
        const {position,lateral}=car;`).replace('renderer.render(scene,view);',`
      renderer.render(scene,view);
      if(customRoute&&run.custom){
        host.dataset.trip=JSON.stringify({position:car.position,lateral:car.lateral,heading:car.heading,
          spawn:customRoute.spawn,gate:run.custom.gate,metres:run.progress,speed:car.speed});
      }
    `);
  },
}]});
let browser;
try{
  await server.listen();
  browser=await chromium.launch({channel:'msedge',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const url='http://127.0.0.1:5181';
  const shot=(page,name)=>page.screenshot({path:join(process.env.SAEEDAU_SCREENSHOTS??'artifacts',name+'.png')});
  const button=(page,name)=>page.getByRole('button',{name,exact:true});
  const setup=async page=>{
    await page.goto(url);
    await button(page,'start journey').click();
    await expect(page.getByRole('group',{name:'Game mode'}).getByRole('button')).toHaveCount(5);
    await page.getByRole('button',{name:/Custom Journey Your start/}).click();
  };
  const desktop=await browser.newPage({viewport:{width:1280,height:720},reducedMotion:'reduce'});
  await setup(desktop);
  const from=desktop.getByLabel('From',{exact:true}),to=desktop.getByLabel('To',{exact:true});
  const start=button(desktop,'Start Custom Journey');
  await expect(from).toHaveValue('Hingorao');
  await expect(to).toHaveValue('Saeedau');
  await to.selectOption('Hingorao');
  await expect(start).toBeDisabled();
  await expect(desktop.getByRole('status')).toContainText('Choose two different locations.');
  await to.selectOption('Saeedau');
  await button(desktop,'Swap destinations').click();
  await expect(from).toHaveValue('Saeedau');
  await expect(to).toHaveValue('Hingorao');
  await shot(desktop,'custom-journey-setup');
  await start.click();
  const state=()=>desktop.locator('.world').evaluate(node=>JSON.parse(node.dataset.trip||'null'));
  await expect.poll(async()=>(await state())?.position).toBe(7000);
  const reverse=await state();
  expect(reverse.lateral).toBe(reverse.spawn.lateral);
  expect(Math.cos(reverse.heading)).toBeLessThan(0);
  await expect(desktop.locator('.custom-navigation')).toContainText('Hingorao');
  await desktop.keyboard.down('w');
  try{await expect.poll(async()=>(await state()).position,{timeout:15000}).toBeLessThan(6998);}
  finally{await desktop.keyboard.up('w');}
  await expect.poll(async()=>(await state()).metres).toBeGreaterThan(0);
  await expect(desktop.locator('.hud-route')).toContainText('Saeedau → Hingorao');
  await shot(desktop,'custom-journey-driving');
  await desktop.evaluate(()=>{window.customFixture='destination';});
  await expect.poll(async()=>(await state()).position).toBeCloseTo(5900,0);
  await expect(desktop.getByRole('heading',{name:'Journey complete'})).toHaveCount(0);
  await desktop.evaluate(()=>{window.customFixture='follow';});
  await expect(desktop.getByRole('heading',{name:'Journey complete'})).toBeVisible({timeout:90000});
  await expect(desktop.locator('.results-panel')).toContainText('Saeedau → Hingorao');
  await expect(desktop.locator('.results-panel')).toContainText('driven');
  await shot(desktop,'custom-journey-results');
  await setup(desktop);
  await expect(from).toHaveValue('Saeedau');
  await expect(to).toHaveValue('Hingorao');
  await desktop.close();

  const mobile=await browser.newPage({...devices['Pixel 7 landscape'],deviceScaleFactor:1,reducedMotion:'reduce'});
  await setup(mobile);
  await mobile.getByLabel('From',{exact:true}).selectOption('Saeedau Junction');
  await mobile.getByLabel('To',{exact:true}).selectOption('Markan Faqeer House');
  for(const [width,height] of [[667,375],[740,360],[844,390],[915,412]]){
    await mobile.setViewportSize({width,height});
    const heading=await mobile.getByRole('heading',{name:'Choose your journey'}).boundingBox();
    const header=await mobile.locator('.journey-top').boundingBox();
    const modes=await mobile.getByRole('group',{name:'Game mode'}).boundingBox();
    const field=await mobile.getByLabel('To',{exact:true}).boundingBox();
    expect(heading.y).toBeGreaterThanOrEqual(header.y+header.height);
    expect(field.y+field.height).toBeLessThan(modes.y);
  }
  await shot(mobile,'custom-journey-mobile');
  await button(mobile,'Start Custom Journey').tap();
  const accelerator=button(mobile,'Accelerate');
  const {x,y,width,height}=await accelerator.boundingBox();
  const touch=await mobile.context().newCDPSession(mobile);
  await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:x+width/2,y:y+height/2}]});
  try{await expect.poll(async()=>Number(await mobile.locator('.hud-speed strong').textContent()),{timeout:15000}).toBeGreaterThan(3);}
  finally{await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}
  await expect(mobile.locator('.mobile-route-toggle')).toContainText('Markan Faqeer House');
  await expect(mobile.locator('.custom-navigation')).toContainText('Siddique Faqeer Goth');
  console.log('Custom mode, invalid selection, swap, reverse spawn and driving, ordered arrival, persistence and mobile controls passed.');
}finally{
  try{await browser?.close();}finally{await server.close();}
}
