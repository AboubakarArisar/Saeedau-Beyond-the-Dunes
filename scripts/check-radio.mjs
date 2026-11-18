import {chromium,expect} from '@playwright/test';
import {createServer} from 'vite';

const server=await createServer({server:{host:'127.0.0.1',port:5173,strictPort:true}});
function wave(frequency){
  const length=48000, result=Buffer.alloc(44+length*2);
  result.write('RIFF');result.writeUInt32LE(result.length-8,4);result.write('WAVEfmt ',8);
  result.writeUInt32LE(16,16);result.writeUInt16LE(1,20);result.writeUInt16LE(1,22);
  result.writeUInt32LE(8000,24);result.writeUInt32LE(16000,28);result.writeUInt16LE(2,32);result.writeUInt16LE(16,34);
  result.write('data',36);result.writeUInt32LE(length*2,40);
  for(let sample=0;sample<length;sample++)result.writeInt16LE(Math.round(250*Math.sin(sample*frequency*Math.PI/4000)),44+sample*2);
  return result;
}
let browser;
try {
  await server.listen();
  browser=await chromium.launch({channel:'msedge',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const page=await browser.newPage({viewport:{width:1120,height:720}});
  const faults=[];page.on('pageerror',error=>faults.push(error.message));
  const button=name=>page.getByRole('button',{name,exact:true});
  const media=()=>page.locator('audio').evaluate(audio=>({paused:audio.paused,time:audio.currentTime,volume:audio.volume}));
  await page.goto('http://127.0.0.1:5173');
  await button('Garage').click();await button('Expand').click();
  const input=page.locator('input[type=file]');
  await input.setInputFiles([{name:'Dune-one.wav',mimeType:'audio/wav',buffer:wave(220)},{name:'Dune-two.wav',mimeType:'audio/wav',buffer:wave(330)}]);
  expect((await media()).paused).toBe(true);
  await button('Dune-one').click();
  await expect(button('Pause music')).toBeVisible();
  await expect.poll(async()=>(await media()).time).toBeGreaterThan(0);
  await page.getByRole('slider',{name:'Seek'}).fill('2.2');
  await expect.poll(async()=>(await media()).time).toBeGreaterThan(2);
  await button('Next').click();await expect(button('Dune-two')).toHaveAttribute('aria-current','true');
  await button('Previous').click();await expect(button('Dune-one')).toHaveAttribute('aria-current','true');
  await button('Shuffle').click();await page.getByLabel('Repeat').selectOption('one');
  await button('Next').click();await expect(button('Dune-two')).toHaveAttribute('aria-current','true');
  await page.getByRole('slider',{name:'Seek'}).fill('5.8');
  await expect.poll(async()=>(await media()).time).toBeLessThan(2);
  await page.getByRole('slider',{name:'Music volume'}).fill('0.4');
  await expect.poll(async()=>(await media()).volume).toBeCloseTo(.3);
  await button('YouTube Radio').click();
  await expect.poll(async()=>(await media()).paused).toBe(true);
  await expect(page.getByRole('link',{name:'Open on YouTube'})).toHaveAttribute('href',/PLijildE23Nm50i6eauzKr1v0CpUTNmh06/);
  try {
    const frame=page.locator('.radio-embed iframe');
    await frame.waitFor({timeout:14000});
    console.log('YouTube iframe: '+await frame.getAttribute('src'));
    await button('Play music').click({timeout:14000});
    await expect(button('Pause music')).toBeVisible({timeout:10000});
    console.log('Live YouTube playback reached playing state.');
  } catch(error){
    console.log('Live YouTube playback unverified: '+(await page.locator('.radio [role=status]').allTextContents()).join(' ')+' '+error.message.split('\n')[0]);
  }
  await button('Collapse').click();await expect(page.locator('.radio-embed iframe')).toHaveCount(0);
  await button('Expand').click();await button('My Music').click();
  await expect(button('Dune-two')).toHaveAttribute('aria-current','true');
  await button('Play music').click();
  await button('Back').click();await button('Play').click();
  await expect(button('Pause music')).toBeVisible();
  await page.screenshot({path:'artifacts/radio-expanded.png'});
  await button('Collapse').click();
  await page.screenshot({path:'artifacts/radio-compact.png'});
  await page.mouse.click(620,320);await page.keyboard.press('m');
  await expect(button('Collapse')).toBeVisible();
  await button('Remove Dune-one').click();await expect(button('Dune-one')).toHaveCount(0);
  await input.setInputFiles({name:'not-a-song.txt',mimeType:'text/plain',buffer:Buffer.from('invalid')});
  await expect(page.getByRole('status')).toContainText('Unrecognized');
  await button('Clear playlist').click();
  await expect.poll(async()=>(await media()).paused).toBe(true);
  await button('Pause').click();await button('Settings').click();
  await page.getByLabel('Mute all audio').check();
  await expect.poll(async()=>(await media()).volume).toBe(0);
  await page.reload();await button('Settings').click();
  await expect(page.getByRole('slider',{name:'Music volume'})).toHaveValue('0.4');
  await expect(page.getByLabel('Mute all audio')).toBeChecked();
  expect(faults).toEqual([]);
  console.log('Local radio playback, queue, controls, source switching, mute and persistence passed.');
} finally {
  try {await browser?.close();} finally {await server.close();}
}
