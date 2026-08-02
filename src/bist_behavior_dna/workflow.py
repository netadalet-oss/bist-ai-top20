from __future__ import annotations

from dataclasses import asdict
from pathlib import Path

import pandas as pd

from bist_behavior_dna.analysis import BISTAnalyzer
from bist_behavior_dna.events import EventEngine
from bist_behavior_dna.excel import ExcelExporter
from bist_behavior_dna.pipeline import add_market_features
from bist_behavior_dna.scoring import BehaviorDNAScorer


class BehaviorDNAWorkflow:
    def __init__(self) -> None:
        self.events = EventEngine()
        self.scorer = BehaviorDNAScorer()
        self.analyzer = BISTAnalyzer()
        self.exporter = ExcelExporter()

    def run_from_frame(self, market: pd.DataFrame, output_dir: str | Path = "data/processed") -> dict[str, Path]:
        output = Path(output_dir)
        output.mkdir(parents=True, exist_ok=True)
        featured = add_market_features(market)
        events = self.events.detect(featured)
        scored = self.scorer.score(featured, events)
        breadth = self.analyzer.breadth_history(scored)
        leaderboard = self.analyzer.leaderboard(scored)
        event_study = self.analyzer.event_study(featured, events) if not events.empty else pd.DataFrame()
        correlation = self.analyzer.correlation_matrix(scored).reset_index(names="metric")
        snapshot = self.analyzer.snapshot(scored)

        paths = {
            "market": output / "market_features.parquet",
            "events": output / "events.parquet",
            "scores": output / "behavior_dna_scores.parquet",
            "workbook": output / "behavior_dna_analysis.xlsx",
        }
        featured.to_parquet(paths["market"], index=False)
        events.to_parquet(paths["events"], index=False)
        scored.to_parquet(paths["scores"], index=False)
        self.exporter.export(
            paths["workbook"],
            {
                "Leaderboard": leaderboard,
                "Breadth History": breadth,
                "Event Study": event_study,
                "Scores": scored,
                "Events": events,
                "Correlations": correlation,
            },
            metadata=asdict(snapshot),
        )
        return paths

    def run_from_file(self, input_path: str | Path, output_dir: str | Path = "data/processed") -> dict[str, Path]:
        path = Path(input_path)
        if path.suffix.lower() == ".parquet":
            market = pd.read_parquet(path)
        elif path.suffix.lower() == ".csv":
            market = pd.read_csv(path)
        else:
            raise ValueError("input must be CSV or Parquet")
        return self.run_from_frame(market, output_dir)
