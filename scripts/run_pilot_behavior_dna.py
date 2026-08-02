from __future__ import annotations

import hashlib
import json
import math
import sqlite3
import time
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd
import yfinance as yf

PILOT = ["AKBNK", "GARAN", "ISCTR", "YKBNK", "THYAO", "ASELS", "TUPRS", "EREGL", "KCHOL", "BIMAS"]
SECTORS = {
    "AKBNK": "XBANK", "GARAN": "XBANK", "ISCTR": "XBANK", "YKBNK": "XBANK",
    "THYAO": "XULAS", "ASELS": "XUTEK", "TUPRS": "XKMYA", "EREGL": "XMANA",
    "KCHOL": "XHOLD", "BIMAS": "XTCRT",
}
INDEX_CANDIDATES = {
    "BIST100": ["XU100.IS", "^XU100"],
    "XBANK": ["XBANK.IS", "^XBANK"], "XULAS": ["XULAS.IS", "^XULAS"],
    "XUTEK": ["XUTEK.IS", "^XUTEK"], "XKMYA": ["XKMYA.IS", "^XKMYA"],
    "XMANA": ["XMANA.IS", "^XMANA"], "XHOLD": ["XHOLD.IS", "^XHOLD"],
    "XTCRT": ["XTCRT.IS", "^XTCRT"],
}
HORIZONS = (1, 3, 5, 10, 20, 60)
OUT = Path("artifacts/behavior_dna")
RAW = OUT / "raw"
SOURCE = "Yahoo Finance historical adjusted market data"


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def _flatten(frame: pd.DataFrame, symbol: str) -> pd.DataFrame:
    if isinstance(frame.columns, pd.MultiIndex):
        if symbol in frame.columns.get_level_values(-1):
            frame = frame.xs(symbol, axis=1, level=-1)
        else:
            frame.columns = frame.columns.get_level_values(0)
    return frame


def normalize_history(frame: pd.DataFrame, symbol: str) -> pd.DataFrame:
    if frame.empty:
        raise RuntimeError(f"No history returned for {symbol}")
    frame = _flatten(frame, symbol).reset_index()
    frame.columns = [str(c).strip().lower().replace(" ", "_") for c in frame.columns]
    required = ["date", "open", "high", "low", "close", "adj_close", "volume"]
    missing = [c for c in required if c not in frame.columns]
    if missing:
        raise RuntimeError(f"{symbol} missing fields: {missing}")
    frame["date"] = pd.to_datetime(frame["date"], utc=True).dt.normalize()
    for c in ["open", "high", "low", "close", "adj_close", "volume", "dividends", "stock_splits"]:
        if c not in frame.columns:
            frame[c] = 0.0
        frame[c] = pd.to_numeric(frame[c], errors="coerce")
    frame = frame.dropna(subset=required).sort_values("date").drop_duplicates("date", keep="last")
    frame = frame[(frame["adj_close"] > 0) & (frame["close"] > 0) & (frame["high"] > 0) & (frame["low"] > 0) & (frame["volume"] >= 0)]
    if len(frame) < 400:
        raise RuntimeError(f"Insufficient history for {symbol}: {len(frame)}")
    frame["symbol"] = symbol.replace(".IS", "").replace("^", "")
    return frame.reset_index(drop=True)


def download(symbol: str, attempts: int = 6) -> pd.DataFrame:
    RAW.mkdir(parents=True, exist_ok=True)
    cached = RAW / f"{symbol.replace('^','INDEX_').replace('.','_')}.parquet"
    errors: list[str] = []
    for attempt in range(1, attempts + 1):
        try:
            frame = yf.download(symbol, period="max", interval="1d", auto_adjust=False, actions=True,
                                progress=False, threads=False, timeout=90)
            clean = normalize_history(frame, symbol)
            clean.to_parquet(cached, index=False, compression="zstd")
            return clean
        except Exception as exc:
            errors.append(f"attempt {attempt}: {exc}")
            if attempt < attempts:
                time.sleep(min(60, 2 ** attempt))
    if cached.exists():
        return normalize_history(pd.read_parquet(cached), symbol)
    raise RuntimeError(f"Download failed for {symbol}: {' | '.join(errors)}")


def download_index(name: str) -> tuple[str, pd.DataFrame]:
    errors = []
    for ticker in INDEX_CANDIDATES[name]:
        try:
            return ticker, download(ticker)
        except Exception as exc:
            errors.append(f"{ticker}: {exc}")
    raise RuntimeError(f"{name} unavailable: {' | '.join(errors)}")


def indicators(frame: pd.DataFrame) -> pd.DataFrame:
    x = frame.copy().sort_values("date").reset_index(drop=True)
    px = x["adj_close"]
    x["ret1"] = px.pct_change()
    x["ret3"] = px.pct_change(3)
    x["ret5"] = px.pct_change(5)
    x["ret10"] = px.pct_change(10)
    x["ret20"] = px.pct_change(20)
    x["ret60"] = px.pct_change(60)
    x["rv20"] = x["ret1"].rolling(20).std(ddof=1) * math.sqrt(252)
    x["rv60"] = x["ret1"].rolling(60).std(ddof=1) * math.sqrt(252)
    prev = x["close"].shift(1)
    tr = pd.concat([(x["high"]-x["low"]), (x["high"]-prev).abs(), (x["low"]-prev).abs()], axis=1).max(axis=1)
    x["atr14"] = tr.rolling(14).mean()
    x["atr_pct"] = x["atr14"] / x["close"]
    delta = px.diff()
    gain = delta.clip(lower=0).rolling(14).mean()
    loss = (-delta.clip(upper=0)).rolling(14).mean()
    rs = gain / loss.replace(0, np.nan)
    x["rsi14"] = 100 - 100 / (1 + rs)
    ema12 = px.ewm(span=12, adjust=False).mean(); ema26 = px.ewm(span=26, adjust=False).mean()
    x["macd"] = ema12 - ema26
    x["macd_signal"] = x["macd"].ewm(span=9, adjust=False).mean()
    x["ma20"] = px.rolling(20).mean(); x["ma50"] = px.rolling(50).mean(); x["ma200"] = px.rolling(200).mean()
    x["volume_ratio20"] = x["volume"] / x["volume"].rolling(20).mean()
    x["breadth_proxy"] = x["ret1"].rolling(5).mean()
    x["gap"] = x["open"] / x["close"].shift(1) - 1
    x["drawdown"] = px / px.cummax() - 1
    x["range_pct"] = (x["high"] - x["low"]) / x["close"]
    x["breakout20"] = px / px.shift(1).rolling(20).max() - 1
    x["breakdown20"] = px / px.shift(1).rolling(20).min() - 1
    return x


def behavior_definitions(market: pd.DataFrame) -> pd.DataFrame:
    m = indicators(market)
    specs: list[dict[str, object]] = []
    variables = [
        ("ret1", "BIST100 1-day return"), ("ret3", "BIST100 3-day return"),
        ("ret5", "BIST100 5-day return"), ("ret10", "BIST100 10-day return"),
        ("ret20", "BIST100 20-day return"), ("ret60", "BIST100 60-day return"),
        ("rv20", "BIST100 20-day realized volatility"), ("rv60", "BIST100 60-day realized volatility"),
        ("atr_pct", "BIST100 normalized ATR"), ("rsi14", "BIST100 RSI(14)"),
        ("macd", "BIST100 MACD"), ("volume_ratio20", "BIST100 volume ratio"),
        ("gap", "BIST100 opening gap"), ("drawdown", "BIST100 drawdown"),
        ("range_pct", "BIST100 intraday range"), ("breakout20", "BIST100 20-day breakout distance"),
        ("breakdown20", "BIST100 20-day breakdown distance"), ("breadth_proxy", "BIST100 5-day mean return"),
        ("ma20", "BIST100 MA20 level"), ("ma50", "BIST100 MA50 level"),
    ]
    quantiles = [0.0, 0.05, 0.20, 0.80, 0.95, 1.0]
    labels = ["extreme_low", "low", "middle", "high", "extreme_high"]
    for var, description in variables:
        series = m[var].dropna()
        if series.nunique() < 20:
            raise RuntimeError(f"Insufficient variation for behavior variable {var}")
        edges = series.quantile(quantiles).to_numpy(dtype=float)
        edges = np.maximum.accumulate(edges)
        for i, label in enumerate(labels):
            lower, upper = float(edges[i]), float(edges[i+1])
            behavior_id = f"MB{len(specs)+1:03d}"
            specs.append({
                "behavior_id": behavior_id,
                "behavior_name": f"{var}_{label}",
                "definition": f"{description} in empirical percentile bucket {quantiles[i]:.0%}-{quantiles[i+1]:.0%}",
                "variable": var, "lower_threshold": lower, "upper_threshold": upper,
                "lower_inclusive": True, "upper_inclusive": i == len(labels)-1,
                "data_source": SOURCE,
                "validation_method": "Recomputed from adjusted BIST100 OHLCV; percentile thresholds derived from complete available history",
                "classification_rule": label,
            })
    result = pd.DataFrame(specs)
    if len(result) != 100 or result["behavior_id"].nunique() != 100:
        raise RuntimeError("Exactly 100 unique market behaviors required")
    return result


def event_dates(market: pd.DataFrame, definitions: pd.DataFrame) -> pd.DataFrame:
    m = indicators(market)
    rows = []
    for spec in definitions.itertuples(index=False):
        s = m[spec.variable]
        mask = s.ge(spec.lower_threshold)
        mask &= s.le(spec.upper_threshold) if spec.upper_inclusive else s.lt(spec.upper_threshold)
        candidates = m.loc[mask & s.notna(), ["date", spec.variable]].copy()
        last = None
        for row in candidates.itertuples(index=False):
            d = pd.Timestamp(row.date)
            if last is not None and (d-last).days < 20:
                continue
            rows.append({"behavior_id": spec.behavior_id, "event_date": d, "observed_value": float(getattr(row, spec.variable)),
                         "event_source": SOURCE, "event_source_url": "https://finance.yahoo.com/quote/XU100.IS/history"})
            last = d
    out = pd.DataFrame(rows).sort_values(["behavior_id", "event_date"]).reset_index(drop=True)
    counts = out.groupby("behavior_id").size()
    if len(counts) != 100 or (counts == 0).any():
        raise RuntimeError("Every market behavior must have at least one real event")
    return out


def align(stock: pd.DataFrame, market: pd.DataFrame, sector: pd.DataFrame) -> pd.DataFrame:
    s = indicators(stock).rename(columns={"adj_close":"stock_px", "ret1":"stock_ret1", "rv20":"stock_rv20", "atr14":"stock_atr14",
                                                   "rsi14":"stock_rsi14", "macd":"stock_macd", "ma20":"stock_ma20", "ma50":"stock_ma50", "ma200":"stock_ma200",
                                                   "volume_ratio20":"stock_volume_ratio20", "gap":"stock_gap", "breakout20":"stock_breakout20"})
    m = indicators(market)[["date","adj_close","ret1"]].rename(columns={"adj_close":"market_px","ret1":"market_ret1"})
    sec = indicators(sector)[["date","adj_close","ret1"]].rename(columns={"adj_close":"sector_px","ret1":"sector_ret1"})
    return s.merge(m,on="date",how="inner").merge(sec,on="date",how="inner").sort_values("date").reset_index(drop=True)


def _recovery(px: pd.Series, i: int, horizon: int = 252) -> float:
    start = float(px.iloc[i]); future = px.iloc[i+1:min(len(px), i+horizon+1)]
    hit = np.flatnonzero(future.to_numpy() >= start)
    return float(hit[0]+1) if len(hit) else np.nan


def event_records(symbol: str, aligned: pd.DataFrame, events: pd.DataFrame) -> pd.DataFrame:
    rows = []
    dates = aligned["date"]
    for e in events.itertuples(index=False):
        eligible = aligned.index[dates >= pd.Timestamp(e.event_date)]
        if len(eligible)==0: continue
        i=int(eligible[0])
        if i < 220 or i+60 >= len(aligned): continue
        pre=aligned.iloc[i-20:i]; post=aligned.iloc[i+1:i+21]; base=aligned.iloc[i]
        beta_pre = pre["stock_ret1"].cov(pre["market_ret1"]) / pre["market_ret1"].var(ddof=1) if pre["market_ret1"].var(ddof=1)>0 else np.nan
        post_beta_window=aligned.iloc[i+1:i+61]
        beta_post = post_beta_window["stock_ret1"].cov(post_beta_window["market_ret1"]) / post_beta_window["market_ret1"].var(ddof=1) if post_beta_window["market_ret1"].var(ddof=1)>0 else np.nan
        future=aligned.iloc[i:i+61]
        path=future["stock_px"]/float(base["stock_px"])-1
        dd=(future["stock_px"]/future["stock_px"].cummax()-1)
        row={
            "symbol":symbol,"behavior_id":e.behavior_id,"event_date":pd.Timestamp(e.event_date),"trading_date":base["date"],
            "observed_market_value":e.observed_value,"source":e.event_source,"source_url":e.event_source_url,
            "volume_change":float(post["volume"].mean()/pre["volume"].mean()-1) if pre["volume"].mean()>0 else np.nan,
            "volatility_change":float(post["stock_ret1"].std(ddof=1)/pre["stock_ret1"].std(ddof=1)-1) if pre["stock_ret1"].std(ddof=1)>0 else np.nan,
            "atr_change":float(post["stock_atr14"].mean()/pre["stock_atr14"].mean()-1) if pre["stock_atr14"].mean()>0 else np.nan,
            "beta_change":float(beta_post-beta_pre) if pd.notna(beta_pre) and pd.notna(beta_post) else np.nan,
            "beta":beta_pre,"maximum_rise":float(path.max()),"maximum_fall":float(path.min()),"maximum_drawdown":float(dd.min()),
            "recovery_time":_recovery(aligned["stock_px"],i),
            "momentum_change":float(aligned.iloc[i]["stock_px"]/aligned.iloc[i-20]["stock_px"]-1 - (aligned.iloc[i-20]["stock_px"]/aligned.iloc[i-40]["stock_px"]-1)),
            "rsi_change":float(base["stock_rsi14"]-aligned.iloc[i-20]["stock_rsi14"]),
            "macd_change":float(base["stock_macd"]-aligned.iloc[i-20]["stock_macd"]),
            "ma20_state": "above" if base["stock_px"]>=base["stock_ma20"] else "below",
            "ma50_state": "above" if base["stock_px"]>=base["stock_ma50"] else "below",
            "ma200_state": "above" if base["stock_px"]>=base["stock_ma200"] else "below",
            "trend_persistence":float((post["stock_ret1"]>0).mean()),"gap_behavior":float(base["stock_gap"]),
            "breakout_behavior":float(base["stock_breakout20"]),
            "liquidity_change":float((post["stock_px"]*post["volume"]).mean()/(pre["stock_px"]*pre["volume"]).mean()-1),
            "panic_resilience":float(-path.min() + path.iloc[-1]),
            "market_regime":"bull" if base["market_px"]>aligned["market_px"].iloc[i-200:i].mean() else "bear",
        }
        for h in HORIZONS:
            sr=float(aligned.iloc[i+h]["stock_px"]/base["stock_px"]-1)
            mr=float(aligned.iloc[i+h]["market_px"]/base["market_px"]-1)
            secr=float(aligned.iloc[i+h]["sector_px"]/base["sector_px"]-1)
            row[f"return_{h}"]=sr; row[f"abnormal_return_{h}"]=sr-(beta_pre*mr if pd.notna(beta_pre) else mr)
            row[f"market_relative_{h}"]=sr-mr; row[f"sector_relative_{h}"]=sr-secr
        row["event_outcome"]="positive" if row["return_20"]>0.02 else "negative" if row["return_20"]<-0.02 else "neutral"
        row["data_quality_score"]=100.0-float(pd.Series(row).isna().mean()*100)
        rows.append(row)
    return pd.DataFrame(rows)


def profiles(records: pd.DataFrame, defs: pd.DataFrame) -> pd.DataFrame:
    rows=[]
    for (symbol,bid),g in records.groupby(["symbol","behavior_id"],sort=True):
        d=defs.loc[defs.behavior_id==bid].iloc[0]
        r={"symbol":symbol,"behavior_id":bid,"behavior_name":d.behavior_name,"definition":d.definition,
           "event_count":len(g),"event_dates":";".join(g["event_date"].dt.strftime("%Y-%m-%d")),
           "positive_ratio":float((g.event_outcome=="positive").mean()),"negative_ratio":float((g.event_outcome=="negative").mean()),
           "neutral_ratio":float((g.event_outcome=="neutral").mean()),"source":SOURCE}
        for h in HORIZONS:
            r[f"avg_return_{h}"]=float(g[f"return_{h}"].mean()); r[f"median_return_{h}"]=float(g[f"return_{h}"].median())
            r[f"avg_abnormal_return_{h}"]=float(g[f"abnormal_return_{h}"].mean())
            r[f"avg_market_relative_{h}"]=float(g[f"market_relative_{h}"].mean())
            r[f"avg_sector_relative_{h}"]=float(g[f"sector_relative_{h}"].mean())
        for c in ["volume_change","volatility_change","atr_change","beta_change","maximum_rise","maximum_fall","maximum_drawdown",
                  "recovery_time","momentum_change","rsi_change","macd_change","trend_persistence","gap_behavior","breakout_behavior",
                  "liquidity_change","panic_resilience","data_quality_score"]:
            r[f"avg_{c}"]=float(g[c].mean())
        r["confidence_score"]=float(min(100.0, 20*math.log1p(len(g))+0.8*r["avg_data_quality_score"]))
        rows.append(r)
    out=pd.DataFrame(rows)
    return out.merge(defs[["behavior_id","lower_threshold","upper_threshold","classification_rule"]],on="behavior_id",how="left")


def write_excel(path: Path, tables: dict[str,pd.DataFrame]) -> None:
    with pd.ExcelWriter(path,engine="openpyxl") as w:
        for name,df in tables.items():
            df.to_excel(w,sheet_name=name,index=False)
        for ws in w.book.worksheets:
            ws.freeze_panes="A2"; ws.auto_filter.ref=ws.dimensions
            for cell in ws[1]: cell.font=cell.font.copy(bold=True)


def main() -> None:
    OUT.mkdir(parents=True,exist_ok=True)
    failure_log=[]
    benchmark_ticker,market=download_index("BIST100")
    defs=behavior_definitions(market)
    ev=event_dates(market,defs)
    stock_frames=[]; record_frames=[]; universe=[]; coverage=[]; missing=[]; sectors={}
    for sec in sorted(set(SECTORS.values())):
        try: sectors[sec]=download_index(sec)[1]
        except Exception as exc:
            failure_log.append({"source":sec,"error":str(exc)})
            raise
    for symbol in PILOT:
        stock=download(f"{symbol}.IS"); stock_frames.append(stock)
        aligned=align(stock,market,sectors[SECTORS[symbol]])
        rec=event_records(symbol,aligned,ev)
        if rec.empty: raise RuntimeError(f"No records for {symbol}")
        record_frames.append(rec)
        universe.append({"symbol":symbol,"sector_index":SECTORS[symbol],"source":SOURCE})
        coverage.append({"symbol":symbol,"rows":len(stock),"start":stock.date.min(),"end":stock.date.max(),"source":SOURCE})
        missing.append({"symbol":symbol,"missing_cells":int(stock[["open","high","low","close","adj_close","volume"]].isna().sum().sum()),"duplicate_dates":int(stock.date.duplicated().sum())})
    records=pd.concat(record_frames,ignore_index=True)
    prof=profiles(records,defs)
    stocks=pd.concat(stock_frames,ignore_index=True)
    complete=pd.MultiIndex.from_product([PILOT,defs.behavior_id],names=["symbol","behavior_id"])
    actual=pd.MultiIndex.from_frame(prof[["symbol","behavior_id"]])
    if len(defs)!=100 or len(prof)<1000 or not complete.isin(actual).all():
        missing_pairs=complete[~complete.isin(actual)].tolist()[:20]
        raise RuntimeError(f"Acceptance failed: profiles={len(prof)} missing_pairs={missing_pairs}")
    quality=pd.DataFrame({"dataset":["stocks","event_dates","event_study","behavior_dna"],"rows":[len(stocks),len(ev),len(records),len(prof)],
                          "quality_score":[100-stocks.isna().mean().mean()*100,100-ev.isna().mean().mean()*100,100-records.isna().mean().mean()*100,100-prof.isna().mean().mean()*100]})
    regimes=records.groupby(["event_date","market_regime"]).size().reset_index(name="records")
    stock_summ=records.groupby("symbol").agg(event_rows=("behavior_id","size"),avg_return_20=("return_20","mean"),positive_ratio=("event_outcome",lambda x:(x=="positive").mean())).reset_index()
    sector_summ=records.assign(sector_index=records.symbol.map(SECTORS)).groupby("sector_index").agg(event_rows=("behavior_id","size"),avg_return_20=("return_20","mean")).reset_index()
    sources=pd.DataFrame([{"source":SOURCE,"url":f"https://finance.yahoo.com/quote/{benchmark_ticker}/history","usage":"Stocks, BIST100 and sector-index histories"}])
    methodology=pd.DataFrame({"item":["Behavior construction","Event independence","Return basis","Abnormal return","Profile rule"],
                              "method":["20 BIST100 variables x five empirical percentile buckets","Minimum 20 calendar days between events within a behavior","Adjusted close","Stock return minus pre-event beta times BIST100 return","Aggregate each stock x behavior pair over all eligible events"]})
    readme=pd.DataFrame({"field":["Purpose","Generated at","Stocks","Behaviors","Profiles","Event rows"],"value":["Real historical Behavior DNA pilot",datetime.now(timezone.utc).isoformat(),len(PILOT),len(defs),len(prof),len(records)]})
    outputs={"stocks.parquet":stocks,"events.parquet":ev,"event_study.parquet":records,"behavior_dna.parquet":prof,"market.parquet":market}
    for fn,df in outputs.items(): df.to_parquet(OUT/fn,index=False,compression="zstd")
    with sqlite3.connect(OUT/"behavior_dna.sqlite") as con:
        for name,df in {"stocks":stocks,"market_behaviors":defs,"event_dates":ev,"event_study":records,"behavior_dna":prof,"market":market}.items():
            df.to_sql(name,con,if_exists="replace",index=False,chunksize=5000)
        con.execute("CREATE INDEX IF NOT EXISTS idx_profile ON behavior_dna(symbol, behavior_id)")
        con.execute("CREATE INDEX IF NOT EXISTS idx_event ON event_study(symbol, behavior_id, event_date)")
    excel_tables={"README":readme,"Market_Behaviors_100":defs,"Stock_Universe":pd.DataFrame(universe),"Event_Dates":ev,
                  "Behavior_DNA":prof,"Event_Study":records,"Stock_Summaries":stock_summ,"Sector_Summaries":sector_summ,
                  "Market_Regimes":regimes,"Coverage":pd.DataFrame(coverage),"Missing_Data":pd.DataFrame(missing),
                  "Data_Quality":quality,"Sources":sources,"Methodology":methodology}
    write_excel(OUT/"BehaviorDNA.xlsx",excel_tables)
    pd.DataFrame(coverage).to_csv(OUT/"coverage_report.csv",index=False); pd.DataFrame(missing).to_csv(OUT/"missing_data_report.csv",index=False)
    pd.DataFrame(failure_log).to_csv(OUT/"source_failures.csv",index=False)
    hashes={p.name:sha256(p) for p in sorted(OUT.iterdir()) if p.is_file() and p.name not in {"SHA256SUMS.json","run_report.json"}}
    report={"generated_at":datetime.now(timezone.utc).isoformat(),"stock_count":int(prof.symbol.nunique()),"market_behavior_count":int(defs.behavior_id.nunique()),
            "stock_behavior_profile_count":int(len(prof)),"event_count":int(len(ev)),"behavior_rows":int(len(records)),
            "coverage_start":str(stocks.date.min()),"coverage_end":str(stocks.date.max()),"sources":[SOURCE],"hashes":hashes}
    (OUT/"run_report.json").write_text(json.dumps(report,indent=2,default=str),encoding="utf-8")
    hashes["run_report.json"]=sha256(OUT/"run_report.json")
    sums=pd.DataFrame([{"file":k,"sha256":v} for k,v in sorted(hashes.items())])
    sums.to_excel(OUT/"SHA256SUMS.xlsx",index=False)
    with pd.ExcelWriter(OUT/"BehaviorDNA.xlsx",engine="openpyxl",mode="a",if_sheet_exists="replace") as w:
        sums.to_excel(w,sheet_name="SHA256SUMS",index=False)
    hashes["BehaviorDNA.xlsx"]=sha256(OUT/"BehaviorDNA.xlsx")
    (OUT/"SHA256SUMS.json").write_text(json.dumps(hashes,indent=2,sort_keys=True),encoding="utf-8")
    assert report["stock_count"]>=10 and report["market_behavior_count"]>=100 and report["stock_behavior_profile_count"]>=1000
    assert report["event_count"]>0 and report["behavior_rows"]>0 and (OUT/"BehaviorDNA.xlsx").stat().st_size>10000
    print(json.dumps(report,indent=2,default=str))


if __name__ == "__main__": main()
