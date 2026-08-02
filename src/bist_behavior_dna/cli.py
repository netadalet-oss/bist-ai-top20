from __future__ import annotations

from pathlib import Path

import pandas as pd
import typer

from .collector import collect, validate_market_data
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
