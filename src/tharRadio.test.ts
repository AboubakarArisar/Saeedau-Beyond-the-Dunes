import {describe,expect,it} from 'vitest';
import {readSoundtrack} from './tharRadio';

const track={title:' First song ',artist:' First artist ',file:'first.mp3'};

describe('built-in soundtrack manifest',()=>{
  it('accepts the empty release and trims display metadata',()=>{
    expect(readSoundtrack([])).toEqual([]);
    expect(readSoundtrack([track])).toEqual([{title:'First song',artist:'First artist',file:'first.mp3'}]);
  });
  it('rejects downloads outside the soundtrack directory and duplicate files',()=>{
    for(const file of ['https://example.com/song.mp3','../song.mp3','nested/song.mp3','song.mp3?remote=yes','song.mp4']){
      expect(()=>readSoundtrack([{...track,file}])).toThrow('Invalid soundtrack entry');
    }
    expect(()=>readSoundtrack([track,track])).toThrow('Invalid soundtrack entry');
  });
});
