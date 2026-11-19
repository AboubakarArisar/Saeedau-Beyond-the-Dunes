import {createHash} from 'node:crypto';
import {readFile,readdir,unlink,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {defineConfig,type Plugin} from 'vite';

function offlineBuild():Plugin{
  let output:string;
  return {
    name:'saeedau-offline',
    apply:'build',
    configResolved(config){output=resolve(config.root,config.build.outDir);},
    async closeBundle(){
      const files=(await readdir(output,{recursive:true,withFileTypes:true}))
        .filter(entry=>entry.isFile())
        .map(entry=>resolve(entry.parentPath,entry.name).slice(output.length+1).replaceAll('\\','/'));
      const soundtrack=JSON.parse(await readFile(resolve(output,'audio/thar-radio/manifest.json'),'utf8')) as {file:string}[];
      const shell=files.filter(file=>file==='index.html'||file==='favicon.png'||file==='manifest.webmanifest'||
        file.startsWith('icons/')||/^assets\/[^/]+\.(js|css|woff2)$/.test(file));
      const packs=[...files.filter(file=>/^(assets|vehicles)\/.+\.glb$/.test(file)),
        'audio/thar-radio/manifest.json',...soundtrack.map(track=>'audio/thar-radio/'+track.file)];
      for(const file of files){
        if(file.startsWith('audio/thar-radio/')&&!packs.includes(file))await unlink(resolve(output,file));
      }
      const version=createHash('sha256');
      let bytes=0;
      const hashes:Record<string,string>={};
      const path=(file:string)=>'/'+file.split('/').map(encodeURIComponent).join('/');
      for(const file of [...shell,...packs].sort()){
        const data=await readFile(resolve(output,file));
        const digest=createHash('sha256').update(data).digest('hex');
        hashes[path(file)]=digest;version.update(file).update(digest);
        bytes+=data.length;
      }
      const worker=await readFile(new URL('./src/service-worker.js',import.meta.url),'utf8');
      version.update(worker);

      await writeFile(resolve(output,'sw.js'),
        'const BUILD='+JSON.stringify({version:version.digest('hex').slice(0,16),shell:shell.map(path),packs:packs.map(path),bytes,hashes})+';\n'+worker);
    },
  };
}

export default defineConfig({base:'./',plugins:[offlineBuild()]});
