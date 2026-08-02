from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum

import pandas as pd


class EventType(StrEnum):
    GAP_UP = "gap_up"
    GAP_DOWN = "gap_down"
    VOLUME_SPIKE = "volume_spike"
    BREAKOUT_20D = "breakout_20d"
    BREAKDOWN_20D = "breakdown_20d"
    VOLATILITY_SHOCK = "volatility_shock"
    DRAWDOWN = "drawdown"


@dataclass(frozen=True)
class EventRule:
    event_type: EventType
    threshold: float


DEFAULT_RULES = (
    EventRule(EventType.GAP_UP, 0.03),
    EventRule(EventType.GAP_DOWN, -0.03),
    EventRule(EventType.VOLUME_SPIKE, 2.0),
    EventRule(EventType.VOLATILITY_SHOCK, 2.0),
    EventRule(EventType.DRAWDOWN, -0.15),
)


class EventEngine:
    def __init__(self, rules: tuple[EventRule, ...] = DEFAULT_RULES) -> None:
        self.rules = rules

    def detect(self, frame: pd.DataFrame) -> pd.DataFrame:
        required = {"symbol", "date", "close", "high", "low", "gap_pct", "volume_ratio20", "volatility_20d", "drawdown"}
        missing = required.difference(frame.columns)
        if missing:
            raise ValueError(f"missing event columns: {sorted(missing)}")
        data = frame.sort_values(["symbol", "date"]).copy()
        group = data.groupby("symbol", group_keys=False)
        prior_high = group["high"].transform(lambda s: s.shift(1).rolling(20, min_periods=10).max())
        prior_low = group["low"].transform(lambda s: s.shift(1).rolling(20, min_periods=10).min())
        vol_baseline = group["volatility_20d"].transform(lambda s: s.shift(1).rolling(60, min_periods=20).median())
        masks: dict[EventType, pd.Series] = {
            EventType.GAP_UP: data["gap_pct"] >= self._threshold(EventType.GAP_UP),
            EventType.GAP_DOWN: data["gap_pct"] <= self._threshold(EventType.GAP_DOWN),
            EventType.VOLUME_SPIKE: data["volume_ratio20"] >= self._threshold(EventType.VOLUME_SPIKE),
            EventType.BREAKOUT_20D: data["close"] > prior_high,
            EventType.BREAKDOWN_20D: data["close"] < prior_low,
            EventType.VOLATILITY_SHOCK: data["volatility_20d"] >= vol_baseline * self._threshold(EventType.VOLATILITY_SHOCK),
            EventType.DRAWDOWN: data["drawdown"] <= self._threshold(EventType.DRAWDOWN),
        }
        records: list[pd.DataFrame] = []
        for event_type, mask in masks.items():
            selected = data.loc[mask.fillna(False), ["symbol", "date", "close"]].copy()
            if selected.empty:
                continue
            selected["event_type"] = event_type.value
            selected["severity"] = self._severity(data.loc[selected.index], event_type)
            records.append(selected)
        if not records:
            return pd.DataFrame(columns=["symbol", "date", "close", "event_type", "severity"])
        return pd.concat(records, ignore_index=True).sort_values(["date", "symbol", "event_type"]).reset_index(drop=True)

    def _threshold(self, event_type: EventType) -> float:
        return next((rule.threshold for rule in self.rules if rule.event_type == event_type), 1.0)

    def _severity(self, rows: pd.DataFrame, event_type: EventType) -> pd.Series:
        if event_type in {EventType.GAP_UP, EventType.GAP_DOWN}:
            return rows["gap_pct"].abs() / abs(self._threshold(event_type))
        if event_type == EventType.VOLUME_SPIKE:
            return rows["volume_ratio20"] / self._threshold(event_type)
        if event_type == EventType.DRAWDOWN:
            return rows["drawdown"].abs() / abs(self._threshold(event_type))
        return pd.Series(1.0, index=rows.index)
