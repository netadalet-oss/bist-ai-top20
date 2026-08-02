from __future__ import annotations

from datetime import date
from pathlib import Path

import pandas as pd
import typer

from .collector import collect, validate_market_data
from .collectors import BISTIndexCollector, EVDSCollector, KAPCollector, TUIKCollector, YahooCollector
from .config import load_config
from .providers import provider_from_name

app = typer.Typer(help="BIST Behavior DNA data pipeline")


@app.command()
def collect_data(
    config: Path = typer.Option(Path("config/collection.yaml"), exists=True),
    output_format: str | None = typer.Option(None, "--format"),
) -> None:
    """Collect and incrementally persist daily BIST OHLCV data."""
    settings = load_config(config)
    if output_format:
        suffix = ".parquet" if output_format == "parquet" else ".csv"
        settings = settings.model_copy(
            update={
                "output_format": output_format,
                "output_path": settings.output_path.with_suffix(suffix),
            }
        )
    manifest = collect(settings, provider_from_name(settings.provider))
    typer.echo(f"Completed run {manifest['run_id']}: {manifest['rows_written']} rows written")


@app.command("kap-companies")
def kap_companies() -> None:
    """Collect the current official KAP BIST company master."""
    typer.echo(str(KAPCollector().collect_company_master()))


@app.command("kap-disclosures")
def kap_disclosures(
    start: date = typer.Option(..., formats=["%Y-%m-%d"]),
    end: date = typer.Option(date.today(), formats=["%Y-%m-%d"]),
) -> None:
    """Collect historical KAP disclosures with resumable monthly windows."""
    typer.echo(str(KAPCollector().collect_disclosures(start, end)))


@app.command("kap-financials")
def kap_financials(
    start: date = typer.Option(date(2009, 1, 1), formats=["%Y-%m-%d"]),
    end: date = typer.Option(date.today(), formats=["%Y-%m-%d"]),
) -> None:
    """Extract financial-report disclosures from verified KAP history."""
    typer.echo(str(KAPCollector().collect_financial_statements(start, end)))


@app.command("kap-actions")
def kap_actions() -> None:
    """Extract corporate-action disclosures from verified KAP history."""
    typer.echo(str(KAPCollector().collect_corporate_actions()))


@app.command("evds")
def evds(
    start: date = typer.Option(..., formats=["%Y-%m-%d"]),
    end: date = typer.Option(date.today(), formats=["%Y-%m-%d"]),
    series: list[str] = typer.Option([], help="name=EVDS.CODE; repeat for multiple series"),
) -> None:
    """Collect official TCMB EVDS macro and market series."""
    collector = EVDSCollector()
    mapping = dict(item.split("=", 1) for item in series) if series else None
    path = collector.collect(mapping, start, end) if mapping else collector.collect_defaults(start, end)
    typer.echo(str(path))


@app.command("tuik")
def tuik(
    dataflow: str = typer.Option(..., help="Official TÜİK SDMX dataflow identifier"),
    key: str = typer.Option("ALL"),
    start: str | None = typer.Option(None),
    end: str | None = typer.Option(None),
    name: str | None = typer.Option(None),
) -> None:
    """Collect any official TÜİK SDMX dataflow as validated Parquet."""
    typer.echo(str(TUIKCollector().collect(dataflow, key=key, start=start, end=end, name=name)))


@app.command("yahoo")
def yahoo(
    ticker: list[str] = typer.Option(..., "--ticker", "-t"),
    start: date | None = typer.Option(None, formats=["%Y-%m-%d"]),
    end: date | None = typer.Option(None, formats=["%Y-%m-%d"]),
) -> None:
    """Collect adjusted OHLCV, dividends and splits from Yahoo Finance."""
    prices, actions = YahooCollector().collect(ticker, start=start, end=end)
    typer.echo(f"prices={prices}; actions={actions}")


@app.command("yahoo-bist")
def yahoo_bist(
    master: Path = typer.Option(Path("data/processed/kap/company_master.parquet"), exists=True),
) -> None:
    """Collect maximum available Yahoo history for every ticker in the KAP master."""
    prices, actions = YahooCollector().collect_from_kap_master(master)
    typer.echo(f"prices={prices}; actions={actions}")


@app.command("bist-indices")
def bist_indices(
    symbol: list[str] = typer.Option([], "--symbol", "-s"),
    start: date | None = typer.Option(None, formats=["%Y-%m-%d"]),
    end: date | None = typer.Option(None, formats=["%Y-%m-%d"]),
    strict: bool = typer.Option(True),
) -> None:
    """Collect BIST broad, style and sector index histories."""
    prices, actions = BISTIndexCollector().collect(symbol or None, start=start, end=end, strict=strict)
    typer.echo(f"prices={prices}; actions={actions}")


@app.command()
def validate(input: Path = typer.Option(..., exists=True)) -> None:
    """Validate an existing canonical market dataset."""
    frame = pd.read_parquet(input) if input.suffix == ".parquet" else pd.read_csv(input)
    validated, issues = validate_market_data(frame)
    typer.echo(f"Rows: {len(validated)}; issues: {len(issues)}")
    if not issues.empty:
        raise typer.Exit(code=1)


if __name__ == "__main__":
    app()
