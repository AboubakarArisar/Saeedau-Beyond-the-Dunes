import {chromium,expect} from '@playwright/test';
import {createServer} from 'vite';

const server=await createServer({server:{host:'127.0.0.1',port:5173,strictPort:true}});
let browser;
try{
  await server.listen();
  browser=await chromium.launch({channel:'msedge',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const page=await browser.newPage({viewport:{width:1366,height:768}});
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  const button=name=>page.getByRole('button',{name,exact:true});
  const speed=()=>page.locator('.hud strong');
  const shot=name=>page.screenshot({path:`artifacts/fix-${name}.png`});
  await page.goto('http://127.0.0.1:5173');
  await button('start journey').click();
  await expect(page.locator('.hud-distance')).toContainText('to Chhor');
  await page.waitForTimeout(700);
  await expect(speed()).toHaveText('0');
  await shot('centered-chase');
  await page.setViewportSize({width:1920,height:1080});
  await page.waitForTimeout(350);
  await shot('hud-1920');
  await button('Controls').click();await expect(page.getByText(/WASD or arrows/)).toBeVisible();
  await button('Hide controls').click();
  await page.setViewportSize({width:960,height:540});
  await page.mouse.move(420,290);await page.mouse.down();await page.mouse.move(610,290,{steps:8});await page.mouse.up();
  await shot('camera-orbit');
  await page.waitForTimeout(4000);
  await shot('camera-return');
  await page.keyboard.down('w');
  try{
    await expect.poll(async()=>Number(await speed().textContent()),{timeout:20000}).toBeGreaterThan(22);
    await page.keyboard.down('a');await page.waitForTimeout(270);await page.keyboard.up('a');
    await shot('chase-curve');
    await page.keyboard.down('d');await page.waitForTimeout(270);await page.keyboard.up('d');
  }finally{await page.keyboard.up('w');}
  await page.keyboard.press('r');await expect(speed()).toHaveText('0');
  await page.keyboard.down('s');
  try{await expect.poll(async()=>Number(await speed().textContent()),{timeout:12000}).toBeGreaterThan(3);}
  finally{await page.keyboard.up('s');}
  await page.keyboard.press('r');await expect(speed()).toHaveText('0');
  for(const vehicle of ['Kekro','Unique 70 motorcycle','Long Chassis jeep']){
    await button('Pause').click();await button('Garage').click();await button(vehicle).click();
    await button('Back').click();await button('start journey').click();
    await expect(page.locator('.hud-vehicle')).toHaveText(vehicle);
    await expect(speed()).toHaveText('0');
  }
  expect(errors).toEqual([]);
  console.log('Chase, desktop HUD, orbit return capture, steering, reverse, reset and vehicle switching passed.');
}finally{try{await browser?.close();}finally{await server.close();}}
