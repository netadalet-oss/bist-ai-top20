# Legacy Function Migration Audit

## Scope

This audit compares the critical runtime surface of the immutable `V_141225` monolith with the modular Apps Script deployment.

Source inventory facts:

- 7,285 source lines
- 280 named function declarations
- 260 unique names
- 20 duplicate function names
- source SHA-256: `c380b93c4804533e866e79bdd36b44683afbbb973a318e0716862ce7b0dbaa0a`

The audit does not claim that all 260 names have been migrated one-to-one. It records the functions that can affect the `Veriler -> K1-K5 -> S` production chain and the global duplicate declarations that can silently override one another in Apps Script.

## High-risk duplicate globals

The following legacy names have duplicate declarations and are treated as release blockers when the monolith is active:

- `buildQueuesByVeriZamani_`
- `getBaseUrl_`
- `menu_DurdurVeTemizle`
- `readRow_`
- `rowForSymbolIndex_`
- `yenile_`

Their modular replacements are explicit repositories, configuration objects, scheduler handlers and safe maintenance commands. They must not coexist with the legacy declarations in the same Apps Script project.

## Deployment rule

`V_141225` remains an immutable reference only. The full monolith must not be copied into the modular project. If one of the forbidden legacy entry points is detected, `LEGACY_FUNCTION_MIGRATION_AUDIT.assertValid()` fails closed.

The Apps Script integrity audit now includes this migration check before the scheduler reads `Veriler`.

## Commands

```javascript
auditLegacyFunctionMigration_();
assertLegacyFunctionMigration_();
```

## Test

```javascript
runLegacyFunctionMigrationAuditTests_();
runAppsScriptIntegrityAuditTests_();
```

Tests are committed but have not yet been executed in the target Apps Script runtime.
