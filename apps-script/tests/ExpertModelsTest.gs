function runExpertModelTests_(){
  function assert_(cond,msg){if(!cond)throw new Error(msg);}
  const rows=[];
  for(let i=0;i<40;i++){
    const close=[];const chg=[];const vol=[];
    for(let d=0;d<30;d++){close.push(100+i-d*.2+(d===5?-8:0));chg.push(d===4?2:0.2);vol.push(d===4?25:1);}
    rows.push({sym:'T'+String(i).padStart(3,'0'),vol5:1+i/20,vol21:1.2+i/25,vol63:1.5+i/30,bollu:120,bolla:80,kapanis_T:100+i/10,hacimdeg:5+i/5,rsi14:45+i/4,deg3g_num:-2+i/8,anlikdeg:-1+i/10,ema20:105+i,ema50:100+i,ema200:90+i,macdhist:-1+i/20,momentum10:-3+i/5,getiri1A:-5+i/2,getiri3A:-10+i,getiri6A:-20+i*1.5,history:{close:close,chg:chg,volChg:vol}});
  }
  ['K1','K2','K3','K4'].forEach(function(name){
    const result=EXPERT_MODELS[name](rows);
    assert_(Array.isArray(result),'Sonuç dizi olmalı: '+name);
    assert_(result.every(function(x){return x.model===name;}),'Model adı yanlış: '+name);
    assert_(result.every(function(x){return x.score>=0&&x.score<=100;}),'Skor aralığı yanlış: '+name);
    assert_(result.every(function(x,j){return x.rank===j+1;}),'Sıra sözleşmesi yanlış: '+name);
    assert_(result.every(function(x){return x.coverage>=0&&x.coverage<=1;}),'Coverage yanlış: '+name);
  });

  const missing=[{sym:'ONLY',ema20:10,ema50:null,ema200:null,macdhist:null,rsi14:null,momentum10:null}];
  assert_(EXPERT_MODELS.K2(missing).length===0,'Yetersiz veri aday üretmemeli');

  const tied=MODEL_CORE.rankResults([{symbol:'B',score:50,tieBreak:{x:.2}},{symbol:'A',score:50,tieBreak:{x:.2}}],['x']);
  assert_(tied[0].symbol==='A','Tam eşitlikte sembol deterministik olmalı');
  return 'OK';
}
