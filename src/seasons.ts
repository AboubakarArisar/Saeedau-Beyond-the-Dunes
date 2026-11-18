export const seasons = {
  summer:{name:'Summer',soil:'#ecf2d7',foliage:'#bdde85',horizon:'#b5cbd0',zenith:'#438cce',fog:'#d1cdbd',density:.0021,sun:'#fff0d4',light:2.65,ambient:'#dcecff',grip:1,road:'#5f5b56',roughness:.91},
  winter:{name:'Winter',soil:'#dfddd7',foliage:'#c6a877',horizon:'#c9d2dc',zenith:'#708bae',fog:'#c6cbd0',density:.0035,sun:'#e7edff',light:1.79,ambient:'#d0e3fb',grip:1,road:'#625f5d',roughness:.9},
  monsoon:{name:'Monsoon',soil:'#cedba8',foliage:'#a5dd72',horizon:'#acb4b2',zenith:'#687783',fog:'#aab2ac',density:.0038,sun:'#d5e1eb',light:1.45,ambient:'#c4d4e1',grip:.73,road:'#424747',roughness:.47},
  dry:{name:'Dry / Hot',soil:'#ffdfac',foliage:'#cbab69',horizon:'#ddc7a6',zenith:'#6799c0',fog:'#daccae',density:.003,sun:'#ffe0af',light:2.95,ambient:'#e4edf0',grip:1,road:'#655d51',roughness:.98},
} as const;
export type Season=keyof typeof seasons;
