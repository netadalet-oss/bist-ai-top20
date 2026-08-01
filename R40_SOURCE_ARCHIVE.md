# R40 source archive

The Android CI workflow expects the following file at the repository root on branch `r40-release-candidate`:

- File: `r40-source-min.zip`
- Size: approximately 292 KB
- SHA-256: `094871f428e2925abb8d19cc05864e638d59f7435d0c55a8a81c38b27fd84a6a`

The archive contains the R40 Gradle project, Android application, core/data/domain modules, tests, build scripts, and CI configuration. Historical build outputs, large golden workbooks and audit documentation are intentionally excluded from this build-source archive.

When the archive is committed, `.github/workflows/android-release.yml` expands it and runs Android SDK 35 / JDK 17 / Gradle 8.9. Debug APK is always built. Signed release APK and AAB are built when all four signing secrets are present.
