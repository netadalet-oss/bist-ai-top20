from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass, asdict
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd

HORIZONS=(1,3,5,10,20,60)
OUT=Path('artifacts/behavior_dna_full')
RAW=OUT/'raw'
SHARDS=OUT/'shards'

@dataclass(frozen=True)
class BehaviorDef:
    behavior_id:str; name:str; description:str; category:str; source:str; series_code:str
    threshold:str; direction:str; sampling_rule:str; minimum_data:int; overlap_rule:str
    source_url:str; license:str; validation_method:str

def sha256_file(path:Path)->str:
    h=hashlib.sha256()
    with path.open('rb') as f:
        for chunk in iter(lambda:f.read(1024*1024),b''): h.update(chunk)
    return h.hexdigest()

def behavior_definitions()->pd.DataFrame:
    families=[
      ('BIST_RET_UP','BIST100 günlük yükseliş','BIST100 günlük getirisi üst kuyruk','BIST100_Piyasa','Yahoo Finance','XU100.IS','up'),
      ('BIST_RET_DOWN','BIST100 günlük düşüş','BIST100 günlük getirisi alt kuyruk','BIST100_Piyasa','Yahoo Finance','XU100.IS','down'),
      ('BIST_VOL','BIST100 volatilite şoku','20 günlük gerçekleşen volatilite üst kuyruk','BIST100_Piyasa','Yahoo Finance','XU100.IS','up'),
      ('BIST_VOLUME','BIST100 hacim şoku','Hacim/20 günlük ortalama üst kuyruk','BIST100_Piyasa','Yahoo Finance','XU100.IS','up'),
      ('BIST_BREAKOUT','BIST100 yukarı kırılım','Kapanışın geçmiş tepeye göre konumu','BIST100_Piyasa','Yahoo Finance','XU100.IS','up'),
      ('BIST_BREAKDOWN','BIST100 aşağı kırılım','Kapanışın geçmiş dibe göre konumu','BIST100_Piyasa','Yahoo Finance','XU100.IS','down'),
      ('BANK_REL','Banka göreceli güç','XBANK eksi BIST100 getiri üst kuyruk','Sektorel','Yahoo Finance','XBANK.IS','up'),
      ('IND_REL','Sanayi göreceli güç','XUSIN eksi BIST100 getiri üst kuyruk','Sektorel','Yahoo Finance','XUSIN.IS','up'),
      ('USDTRY','USDTRY şoku','USDTRY günlük getiri kuyruğu','Kur_Rezerv','Yahoo Finance','TRY=X','up'),
      ('GLOBAL_RISK','Küresel risk şoku','VIX günlük getiri üst kuyruğu','Kuresel','Yahoo Finance','^VIX','up'),
    ]
    qs=[0.50,0.55,0.60,0.65,0.70,0.75,0.80,0.85,0.90,0.95]
    rows=[]; now=datetime.now(timezone.utc).isoformat(); code='behavior-dna'
    for prefix,name,desc,cat,src,series,direction in families:
        for i,q in enumerate(qs,1):
            bid=f'{prefix}_{i:02d}'
            row=BehaviorDef(bid,f'{name} Q{int(q*100)}',desc,cat,src,series,
                f'historical_quantile={q:.2f}',direction,'one event per trading day',252,
                'same-family events are mutually exclusive by highest satisfied threshold',
                f'https://finance.yahoo.com/quote/{series}/history','Yahoo Finance terms of use',
                'SHA-256 raw file; monotonic dates; non-null OHLCV; duplicate-date rejection')
            d=asdict(row); d['created_at']=now; d['code_version']=code
            d['definition_sha256']=hashlib.sha256(json.dumps(d,sort_keys=True,ensure_ascii=False).encode()).hexdigest()
            rows.append(d)
    frame=pd.DataFrame(rows)
    assert frame['behavior_id'].nunique()==100
    return frame

def indicators(frame:pd.DataFrame)->pd.DataFrame:
    x=frame.sort_values('date').copy(); x['ret']=x['close'].pct_change(); x['vol20']=x['ret'].rolling(20).std()*np.sqrt(252)
    pc=x['close'].shift(); tr=pd.concat([x.high-x.low,(x.high-pc).abs(),(x.low-pc).abs()],axis=1).max(axis=1); x['atr14']=tr.rolling(14).mean()
    delta=x.close.diff(); gain=delta.clip(lower=0).rolling(14).mean(); loss=(-delta.clip(upper=0)).rolling(14).mean(); x['rsi14']=100-100/(1+gain/loss)
    e12=x.close.ewm(span=12,adjust=False).mean(); e26=x.close.ewm(span=26,adjust=False).mean(); x['macd']=e12-e26
    for n in (20,50,200): x[f'ma{n}']=x.close.rolling(n).mean()
    x['mom20']=x.close.pct_change(20); x['volume_ma20']=x.volume.rolling(20).mean(); x['turnover']=x.close*x.volume
    return x
