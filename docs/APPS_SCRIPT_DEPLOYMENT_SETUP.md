# Apps Script Deployment Setup

This repository deploys `apps-script/src` to an existing Google Apps Script project through the manual GitHub Actions workflow `.github/workflows/deploy-apps-script.yml`.

## Safety rules

- The legacy `V_141225` monolith must not be copied into the target project.
- Use a separate test/staging Apps Script project before production.
- The workflow is manual only; pushes to GitHub do not automatically deploy.
- Keep the pull request in draft and the runtime in shadow-only mode until live tests pass.

## 1. Obtain the Apps Script project ID

Open the target Apps Script project, then open **Project Settings** and copy **Script ID**.

Create this GitHub Actions secret in repository settings:

```text
APPS_SCRIPT_ID=<the Script ID>
```

Do not use the Google Sheet ID. The Script ID belongs to the Apps Script project.

## 2. Create clasp credentials locally

Install and authenticate clasp on a trusted local computer:

```bash
npm install --global @google/clasp@3
clasp login
```

After login, clasp creates:

```text
~/.clasprc.json
```

Copy the complete JSON content of that file into the following GitHub Actions secret:

```text
CLASPRC_JSON=<complete contents of ~/.clasprc.json>
```

Treat this value as a password. Never commit it to the repository, paste it into an issue, or store it in a Sheet.

## 3. Protect the deployment environment

Create a GitHub environment named:

```text
apps-script-production
```

Recommended settings:

- required reviewer before deployment;
- restrict deployment to `refactor/apps-script-foundation` while testing;
- store `APPS_SCRIPT_ID` and `CLASPRC_JSON` as environment secrets when possible.

## 4. Run the deployment

In GitHub:

```text
Actions → Deploy Apps Script → Run workflow
```

Keep `force=false` for the first attempt. Use force only after checking remote differences and confirming that the repository is authoritative.

The workflow deploys only:

```text
apps-script/src
```

including `appsscript.json` and modules `00_Config.gs` through `42_ExpertCriteriaParityAudit.gs`.

## 5. Post-deployment validation

Run these functions in the Apps Script editor, in order:

```javascript
assertLegacyFunctionMigration_();
assertAppsScriptIntegrity_();
auditVerilerCanonicalSchema_();
auditLiveModelFeatureCoverage_();
runHeaderReaderNormalizationTests_();
runRuntimeDataQualityGateTests_();
runExpertModelTests_();
runExpertCriteriaParityAuditTests_();
runConsensusModelTests_();
runSSelectionEngineTests_();
runSnapshotStoreTests_();
runOutcomeEvaluatorTests_();
runShadowExperimentTests_();
```

Do not enable production triggers until all integrity and data-quality checks pass.

## 6. Known live exclusions

Current workbook analysis identified:

- `SNKRN`: exclude from all expert models until source data is repaired;
- `UMPAS` and `YGYO`: exclude from K3 while volume-change history remains incomplete.

## Revocation

If credentials are exposed or no longer needed:

1. revoke clasp/Google OAuth access from the Google account;
2. delete the `CLASPRC_JSON` GitHub secret;
3. regenerate credentials before the next deployment.
