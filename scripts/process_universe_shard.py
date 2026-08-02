from __future__ import annotations
import argparse, json, math, re
from pathlib import Path
import numpy as np, pandas as pd, yfinance as yf
from full_universe_common import OUT, SHARDS, HORIZONS, indicators

def norm(df,t):
    if df.empty: raise RuntimeError('empty')
    if isinstance(df.columns,pd.MultiIndex): df.columns=df.columns.get_level_values(0)
    x=df.reset_index(); x.columns=[str(c).lower().replace(' ','_') for c in x.columns]; x['date']=pd.to_datetime(x['date'],utc=True).dt.normalize()
    for c in ['open','high','low','close','adj_close','volume']: 
        if c in x: x[c]=pd.to_numeric(x[c],errors='coerce')
    x=x.dropna(subset=['date','open','high','low','close']).sort_values('date').drop_duplicates('date'); x['symbol']=t.replace('.IS',''); return x

def dl(t): return norm(yf.download(t,period='max',interval='1d',auto_adjust=False,actions=True,progress=False,threads=False,timeout=60),t)

def one(symbol,stock,bench,events):
    s=indicators(stock); b=bench[['date','close']].rename(columns={'close':'bclose'}); m=s.merge(b,on='date',how='inner').reset_index(drop=True); m['bret']=m.bclose.pct_change()
    rows=[]
    for _,ev in events.iterrows():
        ix=m.index[m.date>=pd.Timestamp(ev.date)]
        if len(ix)==0: continue
        i=int(ix[0])
        if i<200 or i+60>=len(m): continue
        r={'symbol':symbol,'behavior_id':ev.behavior_id,'event_date':m.loc[i,'date'],'source':ev.source,'source_url':ev.source_url,'event_value':ev.event_value,'event_threshold':ev.event_threshold,'event_day_return':m.loc[i,'ret']}
        pre=m.iloc[i-20:i]; post=m.iloc[i+1:i+21]
        beta=pre.ret.cov(pre.bret)/pre.bret.var() if pre.bret.var() not in (0,np.nan) else np.nan
        r.update(beta=beta,volume_change=post.volume.mean()/pre.volume.mean()-1,atr_change=post.atr14.mean()/pre.atr14.mean()-1,volatility_change=post.vol20.mean()/pre.vol20.mean()-1,rsi_change=m.loc[i+20,'rsi14']-m.loc[i,'rsi14'],macd_change=m.loc[i+20,'macd']-m.loc[i,'macd'],momentum_change=m.loc[i+20,'mom20']-m.loc[i,'mom20'],ma20_position=m.loc[i,'close']/m.loc[i,'ma20']-1,ma50_position=m.loc[i,'close']/m.loc[i,'ma50']-1,ma200_position=m.loc[i,'close']/m.loc[i,'ma200']-1,relative_strength=m.loc[i,'mom20']-(m.loc[i,'bclose']/m.loc[i-20,'bclose']-1),gap_behavior=m.loc[i,'open']/m.loc[i-1,'close']-1,liquidity_change=post.turnover.mean()/pre.turnover.mean()-1)
        future=m.iloc[i:i+61]; r['max_rise']=future.high.max()/m.loc[i,'close']-1; r['max_fall']=future.low.min()/m.loc[i,'close']-1; r['max_drawdown']=(future.close/future.close.cummax()-1).min(); r['recovery_time']=next((j for j,v in enumerate(future.close.iloc[1:],1) if v>=m.loc[i,'close']),np.nan)
        for h in HORIZONS:
            sr=m.loc[i+h,'close']/m.loc[i,'close']-1; br=m.loc[i+h,'bclose']/m.loc[i,'bclose']-1; r[f'return_{h}']=sr; r[f'abnormal_{h}']=sr-beta*br if pd.notna(beta) else np.nan
        rows.append(r)
    es=pd.DataFrame(rows)
    prof=[]
    for bid,g in es.groupby('behavior_id'):
        vals=np.concatenate([g[f'return_{h}'].dropna().to_numpy() for h in HORIZONS])
        prof.append({'symbol':symbol,'behavior_id':bid,'event_count':len(g),'event_dates':'|'.join(g.event_date.dt.strftime('%Y-%m-%d')),'mean_return':float(np.mean(vals)),'median_return':float(np.median(vals)),'std_return':float(np.std(vals,ddof=1)) if len(vals)>1 else np.nan,'positive_ratio':float((vals>0.005).mean()),'negative_ratio':float((vals<-0.005).mean()),'neutral_ratio':float((abs(vals)<=0.005).mean()),'max_rise':g.max_rise.max(),'max_fall':g.max_fall.min(),'max_drawdown':g.max_drawdown.min(),'recovery_time':g.recovery_time.median(),'abnormal_return_bist100':g.abnormal_20.mean(),'relative_strength':g.relative_strength.mean(),'beta':g.beta.mean(),'volume_change':g.volume_change.mean(),'atr_change':g.atr_change.mean(),'volatility_change':g.volatility_change.mean(),'rsi_change':g.rsi_change.mean(),'macd_change':g.macd_change.mean(),'momentum_change':g.momentum_change.mean(),'ma20_position':g.ma20_position.mean(),'ma50_position':g.ma50_position.mean(),'ma200_position':g.ma200_position.mean(),'gap_behavior':g.gap_behavior.mean(),'liquidity_change':g.liquidity_change.mean(),'data_quality_score':100*(1-g.isna().mean().mean()),'confidence_score':min(100,10*math.sqrt(len(g))),'source':'Yahoo Finance','source_url':g.source_url.iloc[0]})
    return es,pd.DataFrame(prof)

def main():
    p=argparse.ArgumentParser(); p.add_argument('--shard',type=int,required=True); p.add_argument('--count',type=int,required=True); a=p.parse_args(); SHARDS.mkdir(parents=True,exist_ok=True)
    u=pd.read_parquet(OUT/'stock_universe.parquet'); ev=pd.read_parquet(OUT/'event_dates.parquet'); market=pd.read_parquet(OUT/'market.parquet'); bench=market[market.ticker=='XU100.IS'].copy()
    part=u.iloc[[i for i in range(len(u)) if i%a.count==a.shard]]; histories=[]; events=[]; profiles=[]; rejected=[]
    for _,row in part.iterrows():
        try:
            st=dl(row.yahoo_ticker); histories.append(st); es,pr=one(row.ticker,st,bench,ev); events.append(es); profiles.append(pr)
        except Exception as exc: rejected.append({'symbol':row.ticker,'error':repr(exc)})
    pd.concat(histories,ignore_index=True).to_parquet(SHARDS/f'stock_history_{a.shard}.parquet',index=False,compression='zstd')
    pd.concat(events,ignore_index=True).to_parquet(SHARDS/f'event_study_{a.shard}.parquet',index=False,compression='zstd')
    pd.concat(profiles,ignore_index=True).to_parquet(SHARDS/f'behavior_dna_{a.shard}.parquet',index=False,compression='zstd')
    pd.DataFrame(rejected).to_csv(SHARDS/f'rejected_{a.shard}.csv',index=False)
    print(json.dumps({'shard':a.shard,'stocks':len(part),'profiles':sum(len(x) for x in profiles),'rejected':len(rejected)}))
if __name__=='__main__': main()
