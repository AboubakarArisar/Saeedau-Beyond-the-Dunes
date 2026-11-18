import {chromium,expect} from '@playwright/test';
import {createServer} from 'vite';

const server=await createServer({server:{host:'127.0.0.1',port:5173,strictPort:true}});
let browser;
try {
  await server.listen();
  browser=await chromium.launch({channel:'msedge',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const page=await browser.newPage({viewport:{width:1120,height:630}});
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('console',message=>{
    if(message.type()==='error'&&!message.location().url.endsWith('/favicon.ico'))errors.push(message.text());
  });
  const kits=['houses','roadside','vegetation'].map(folder=>page.waitForResponse(response=>
    response.ok()&&response.url().endsWith(`/assets/${folder}/kit.glb`)));
  await page.goto('http://127.0.0.1:5173');
  await Promise.all(kits);
  await page.getByRole('button',{name:'start journey'}).click();
  await page.getByRole('button',{name:'Start Free Journey',exact:true}).click();
  const shot=name=>page.screenshot({path:`artifacts/thar-${name}.png`});
  const speed=async()=>Number(await page.locator('.hud strong').textContent());
  const orbit=async delta=>{
    await page.mouse.move(560,340);
    await page.mouse.down();
    await page.mouse.move(560+delta,340,{steps:10});
    await page.mouse.up();
    await page.waitForTimeout(750);
  };
  await page.waitForTimeout(1100);
  await shot('road');
  await orbit(115);
  await shot('compound');
  await orbit(-240);
  await shot('vegetation');
  await orbit(125);
  for(const [index,vehicle] of ['Long Chassis jeep','Kekro','Unique 70 motorcycle'].entries()){
    if(index){
      await page.getByRole('button',{name:'Pause'}).click();
      await page.getByRole('button',{name:'Garage'}).click();
      await page.getByRole('button',{name:vehicle}).click();
      await page.getByRole('button',{name:'Back'}).click();
      await page.getByRole('button',{name:'Play'}).click();
    }
    await page.keyboard.press('r');
    await expect(page.locator('.hud')).toContainText(vehicle);
    await page.keyboard.down('w');
    try {
      await expect.poll(speed,{timeout:20000}).toBeGreaterThan(5);
      if(!index)await shot('driving');
    } finally {
      await page.keyboard.up('w');
    }
    if(!index){
      await orbit(-140);
      await shot('settlement');
      await orbit(140);
    }
    await page.keyboard.press('r');
    await expect.poll(speed,{timeout:15000}).toBe(0);
  }
  expect(errors).toEqual([]);
  console.log('Three environment kits loaded; all vehicles drove and reset; five screenshots saved.');
} finally {
  try {await browser?.close();} finally {await server.close();}
}
