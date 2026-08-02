from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd
import yfinance as yf

from bist_behavior_dna.collectors.kap import KAPCollector
from full_universe_common import OUT, RAW, behavior_definitions, sha256_file

MARKET_TICKERS=['XU100.IS','XBANK.IS','XUSIN.IS','XHOLD.IS','XULAS.IS','XUTEK.IS','XGMYO.IS','TRY=X','^VIX','BZ=F','GC=F','DX-Y.NYB','^TNX']

def normalize(frame:pd.DataFrame,ticker:str)->pd.DataFrame:
    if frame.empty: raise RuntimeError(f'empty history: {ticker}')
    if isinstance(frame.columns,pd.MultiIndex): frame.columns=frame.columns.get_level_values(0)
    x=frame.reset_index(); x.columns=[str(c).lower().replace(' ','_') for c in x.columns]
    x['date']=pd.to_datetime(x['date'],utc=True).dt.normalize()
    need=['date','open','high','low','close','volume']; missing=[c for c in need if c not in x]
    if missing: raise RuntimeError(f'{ticker} missing {missing}')
    for c in need[1:]: x[c]=pd.to_numeric(x[c],errors='coerce')
    x=x.dropna(subset=['date','open','high','low','close']).sort_values('date').drop_duplicates('date')
    if 'adj_close' not in x: x['adj_close']=x['close']
    x['ticker']=ticker
    return x

def download(ticker:str)->pd.DataFrame:
    RAW.mkdir(parents=True,exist_ok=True); p=RAW/(re.sub(r'[^A-Za-z0-9]+','_',ticker)+'.parquet')
    try:
        x=normalize(yf.download(ticker,period='max',interval='1d',auto_adjust=False,actions=True,progress=False,threads=False,timeout=60),ticker)
        x.to_parquet(p,index=False,compression='zstd'); return x
    except Exception:
        if p.exists(): return pd.read_parquet(p)
        raise

def build_events(market:dict[str,pd.DataFrame],defs:pd.DataFrame)->pd.DataFrame:
    b=market['XU100.IS'].sort_values('date').copy(); b['ret']=b.close.pct_change(); b['rv20']=b.ret.rolling(20).std()*np.sqrt(252)
    b['vol_ratio']=b.volume/b.volume.rolling(20).mean(); b['breakout']=b.close/b.high.shift().rolling(20).max()-1; b['breakdown']=b.close/b.low.shift().rolling(20).min()-1
    def s(t,col,name):
        q=market[t][['date',col]].copy(); q[name]=q[col].pct_change(); return q[['date',name]]
    f=b.merge(s('XBANK.IS','close','bank_ret'),on='date',how='left').merge(s('XUSIN.IS','close','ind_ret'),on='date',how='left').merge(s('TRY=X','close','usd_ret'),on='date',how='left').merge(s('^VIX','close','vix_ret'),on='date',how='left')
    f['bank_rel']=f.bank_ret-f.ret; f['ind_rel']=f.ind_ret-f.ret
    metrics={'BIST_RET_UP':'ret','BIST_RET_DOWN':'ret','BIST_VOL':'rv20','BIST_VOLUME':'vol_ratio','BIST_BREAKOUT':'breakout','BIST_BREAKDOWN':'breakdown','BANK_REL':'bank_rel','IND_REL':'ind_rel','USDTRY':'usd_ret','GLOBAL_RISK':'vix_ret'}
    rows=[]
    for family,col in metrics.items():
        vals=f[col].dropna()
        for _,d in defs[defs.behavior_id.str.startswith(family+'_')].iterrows():
            q=float(d.threshold.split('=')[1]); thr=vals.quantile(q if d.direction=='up' else 1-q)
            mask=f[col].ge(thr) if d.direction=='up' else f[col].le(thr)
            e=f.loc[mask,['date',col]].rename(columns={col:'event_value'}); e['behavior_id']=d.behavior_id; e['event_threshold']=thr; e['source']=d.source; e['source_url']=d.source_url; rows.append(e)
    out=pd.concat(rows,ignore_index=True).sort_values(['behavior_id','date']).drop_duplicates(['behavior_id','date'])
    if out.behavior_id.nunique()!=100: raise RuntimeError('100 behavior event families not produced')
    return out

def main()->None:
    OUT.mkdir(parents=True,exist_ok=True)
    failures=[]
    try:
        universe=KAPCollector().collect_company_master()
    except Exception as exc:
        failures.append({'source':'KAP','stage':'company_master','error':repr(exc),'time':datetime.now(timezone.utc).isoformat()}); raise
    universe=universe[universe.ticker.astype(str).str.fullmatch(r'[A-Z0-9]{4,6}')].drop_duplicates('ticker').sort_values('ticker').reset_index(drop=True)
    if len(universe)<100: raise RuntimeError(f'official KAP universe unexpectedly small: {len(universe)}')
    universe['yahoo_ticker']=universe.ticker+'.IS'; universe['universe_asof']=datetime.now(timezone.utc).date().isoformat(); universe.to_parquet(OUT/'stock_universe.parquet',index=False)
    defs=behavior_definitions(); defs.to_parquet(OUT/'market_behaviors.parquet',index=False)
    market={}
    for t in MARKET_TICKERS:
        try: market[t]=download(t)
        except Exception as exc: failures.append({'source':'Yahoo Finance','stage':t,'error':repr(exc),'time':datetime.now(timezone.utc).isoformat()})
    required={'XU100.IS','XBANK.IS','XUSIN.IS','TRY=X','^VIX'}
    if not required.issubset(market): raise RuntimeError(f'missing required market series: {required-set(market)}')
    events=build_events(market,defs); events.to_parquet(OUT/'event_dates.parquet',index=False)
    pd.concat(market.values(),ignore_index=True).to_parquet(OUT/'market.parquet',index=False,compression='zstd')
    pd.DataFrame(failures,columns=['source','stage','error','time']).to_csv(OUT/'source_failures.csv',index=False)
    report={'stock_count':len(universe),'market_behavior_count':defs.behavior_id.nunique(),'event_count':len(events),'generated_at':datetime.now(timezone.utc).isoformat(),'universe_hash':sha256_file(OUT/'stock_universe.parquet')}
    (OUT/'prepare_report.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
    print(json.dumps(report,indent=2))
if __name__=='__main__': main()
