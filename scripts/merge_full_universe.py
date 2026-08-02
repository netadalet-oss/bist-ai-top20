from __future__ import annotations
import hashlib,json,sqlite3
from datetime import datetime,timezone
from pathlib import Path
import pandas as pd
from full_universe_common import OUT,SHARDS,sha256_file

def cat(pattern):
    files=sorted(SHARDS.glob(pattern))
    if not files: raise RuntimeError(f'no files {pattern}')
    return pd.concat([pd.read_parquet(f) for f in files],ignore_index=True)

def main():
    u=pd.read_parquet(OUT/'stock_universe.parquet'); defs=pd.read_parquet(OUT/'market_behaviors.parquet'); ev=pd.read_parquet(OUT/'event_dates.parquet'); market=pd.read_parquet(OUT/'market.parquet')
    hist=cat('stock_history_*.parquet').drop_duplicates(['symbol','date']); es=cat('event_study_*.parquet').drop_duplicates(['symbol','behavior_id','event_date']); dna=cat('behavior_dna_*.parquet').drop_duplicates(['symbol','behavior_id'])
    rej=pd.concat([pd.read_csv(f) for f in SHARDS.glob('rejected_*.csv') if f.stat().st_size],ignore_index=True) if list(SHARDS.glob('rejected_*.csv')) else pd.DataFrame(columns=['symbol','error'])
    hist.to_parquet(OUT/'stocks.parquet',index=False,compression='zstd'); hist.to_parquet(OUT/'stock_history.parquet',index=False,compression='zstd'); es.to_parquet(OUT/'event_study.parquet',index=False,compression='zstd'); dna.to_parquet(OUT/'behavior_dna.parquet',index=False,compression='zstd')
    defs.to_parquet(OUT/'market_behaviors.parquet',index=False); ev.to_parquet(OUT/'event_dates.parquet',index=False); market.to_parquet(OUT/'market_regimes.parquet',index=False)
    pd.DataFrame(columns=['symbol','period']).to_parquet(OUT/'fundamentals.parquet',index=False); pd.DataFrame(columns=['symbol','date','action']).to_parquet(OUT/'corporate_actions.parquet',index=False); pd.DataFrame(columns=['sector','behavior_id']).to_parquet(OUT/'sector_behavior.parquet',index=False)
    coverage=hist.groupby('symbol').agg(rows=('date','size'),start_date=('date','min'),end_date=('date','max')).reset_index(); coverage['profile_count']=coverage.symbol.map(dna.groupby('symbol').size()); coverage.to_csv(OUT/'coverage_report.csv',index=False)
    missing=coverage[coverage.profile_count<100].copy(); missing.to_csv(OUT/'missing_data_report.csv',index=False); rej.to_csv(OUT/'rejected_records.csv',index=False)
    if not (OUT/'source_failures.csv').exists(): pd.DataFrame(columns=['source','stage','error','time']).to_csv(OUT/'source_failures.csv',index=False)
    with sqlite3.connect(OUT/'behavior_dna.sqlite') as c:
        for name,df in [('stock_universe',u),('stock_history',hist),('market_behaviors',defs),('event_dates',ev),('behavior_dna',dna),('event_study',es),('market',market)]: df.to_sql(name,c,if_exists='replace',index=False,chunksize=5000)
    sheets={'README':pd.DataFrame({'item':['Dataset','Generated'],'value':['BIST Behavior DNA full universe',datetime.now(timezone.utc).isoformat()]}),'Executive_Summary':coverage.describe(include='all').reset_index(),'Stock_Universe':u,'Market_Behaviors_100':defs,'Behavior_Definitions':defs,'Event_Dates':ev,'Behavior_DNA':dna,'Event_Study':es,'Stock_Profiles':dna,'Stock_Summaries':coverage,'Sector_Summaries':pd.DataFrame(),'Market_Regimes':market,'Relative_Performance':dna.filter(regex='symbol|behavior_id|relative|abnormal|beta'),'Volume_Liquidity':dna.filter(regex='symbol|behavior_id|volume|liquidity'),'Volatility':dna.filter(regex='symbol|behavior_id|volatility|atr|drawdown'),'Technical_Behavior':dna.filter(regex='symbol|behavior_id|rsi|macd|momentum|ma|gap'),'Fundamental_Behavior':pd.DataFrame(),'Coverage':coverage,'Missing_Data':missing,'Data_Quality':dna.filter(regex='symbol|behavior_id|quality|confidence'),'Sources':defs[['source','source_url','license']].drop_duplicates(),'Methodology':pd.DataFrame({'rule':['Real historical observations only','No synthetic filling']}),'Rejected_Records':rej,'Run_Report':pd.DataFrame(),'SHA256SUMS':pd.DataFrame()}
    report={'stock_count':int(u.ticker.nunique()),'processed_stock_count':int(dna.symbol.nunique()),'market_behavior_count':int(defs.behavior_id.nunique()),'stock_behavior_profile_count':int(len(dna)),'event_count':int(len(ev)),'behavior_rows':int(len(es)),'generated_at':datetime.now(timezone.utc).isoformat()}
    if report['processed_stock_count']!=report['stock_count'] or report['market_behavior_count']<100 or report['stock_behavior_profile_count']<report['stock_count']*100 or report['behavior_rows']==0: raise RuntimeError(report)
    sheets['Run_Report']=pd.DataFrame([report])
    with pd.ExcelWriter(OUT/'BehaviorDNA.xlsx',engine='openpyxl') as w:
        for name,df in sheets.items(): df.to_excel(w,sheet_name=name[:31],index=False)
    (OUT/'run_report.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
    files=[p for p in OUT.iterdir() if p.is_file() and p.name!='SHA256SUMS.json']; hashes={p.name:sha256_file(p) for p in sorted(files)}; (OUT/'SHA256SUMS.json').write_text(json.dumps(hashes,indent=2,sort_keys=True),encoding='utf-8')
    print(json.dumps(report,indent=2))
if __name__=='__main__': main()
