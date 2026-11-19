export type SoundtrackEntry={title:string;artist:string;file:string};

export function readSoundtrack(value:unknown):SoundtrackEntry[]{
  if(!Array.isArray(value))throw new Error('Expected a soundtrack track list');
  const files=new Set<string>();
  return value.map(entry=>{
    if(!entry||typeof entry.title!=='string'||!entry.title.trim()||
      typeof entry.artist!=='string'||!entry.artist.trim()||typeof entry.file!=='string'||
      !/^[a-z\d][a-z\d ._-]*\.(mp3|ogg|m4a|wav|opus)$/i.test(entry.file)||files.has(entry.file)){
      throw new Error('Invalid soundtrack entry');
    }
    files.add(entry.file);
    return {title:entry.title.trim(),artist:entry.artist.trim(),file:entry.file};
  });
}
