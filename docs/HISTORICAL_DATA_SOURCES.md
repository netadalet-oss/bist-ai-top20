# Historical Behavior DNA data authorities

Only source-native observations may enter the historical database. Each downloaded object must be registered with `provenance.register_raw_asset`; transformed tables must retain the raw SHA-256 hashes and a reproducibility fingerprint.

## Security universe, disclosures, corporate actions and financial statements

- **KAP / Public Disclosure Platform**
  - Current BIST companies: `https://www.kap.org.tr/en/bist-sirketler`
  - Markets and listed instruments: `https://www.kap.org.tr/en/Pazarlar`
  - Historical notifications, material disclosures, financial statements and corporate actions: `https://www.kap.org.tr/en`
  - KAP is the primary authority for issuer identity, disclosure timestamp, report period, corporate-action announcement and filed financial statement values.

## Turkish macroeconomic events

- **TCMB / Central Bank of the Republic of Türkiye**
  - Monetary Policy Committee decisions and press releases: `https://www.tcmb.gov.tr/`
  - EVDS time-series service for policy, foreign exchange and market series: `https://evds2.tcmb.gov.tr/`
- **TÜİK / Turkish Statistical Institute**
  - CPI, domestic PPI, release dates, metadata and historical tables: `https://veriportali.tuik.gov.tr/en/`

## International and cross-market events

- **Federal Reserve**: FOMC decisions, statements and calendars from `https://www.federalreserve.gov/monetarypolicy/fomc.htm`
- **Election authority**: official election dates and certified results from `https://www.ysk.gov.tr/`
- **Market series**: USD/TRY should prefer TCMB EVDS; Brent and gold require a licensed or openly redistributable source with stable identifiers and retained source files.
- **CDS**: ingest only from a source whose licence permits storage and derived analytics. The provider, instrument definition, close convention and timestamp must be retained.
- **Geopolitical events**: require at least one primary governmental/institutional record or two independent high-quality contemporaneous sources. The database records the decision timestamp and evidence URLs, not a subjective impact score.

## Acceptance rules

A row is rejected when any of the following applies:

1. The observation has no source URL, source timestamp or content hash.
2. The issuer/event identity cannot be mapped deterministically.
3. OHLCV values are missing or violate price/volume constraints.
4. A disclosure or financial value cannot be traced to a KAP notification/report identifier.
5. A macro observation cannot be traced to the official release/series identifier.
6. A corporate action lacks ex-date/effective-date semantics.
7. A processed output cannot be rebuilt from immutable raw assets, code version and parameters.

No zeroes, medians, forward fills or synthetic observations may be used to replace unavailable historical facts. Ineligible event/stock pairs are omitted and recorded in a rejected-record audit table with a machine-readable reason.
