pluginManagement { repositories { google(); mavenCentral(); gradlePluginPortal() } }
dependencyResolutionManagement { repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS); repositories { google(); mavenCentral() } }
rootProject.name = "AurumBistTop20"
include(":app", ":core-model", ":core-database", ":domain-quality", ":domain-prediction", ":data-excel")
include(":data-warehouse")
include(":domain-kmodels")
include(":domain-universe")
include(":domain-corporate-actions")
include(":domain-events")
include(":domain-risk")
include(":domain-jobs")
include(":domain-staging")
include(":core-network")
include(":data-adapters")
