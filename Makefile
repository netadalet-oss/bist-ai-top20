.PHONY: install test lint collect validate

install:
	python -m pip install -e ".[dev]"

test:
	pytest -q

lint:
	ruff check src tests
	mypy src

collect:
	behavior-dna collect-data --config config/collection.yaml

validate:
	behavior-dna validate --input data/raw/market_daily.parquet
