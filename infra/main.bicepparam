using './main.bicep'

// ──────────────────────────────────────────────────────────────────────
// PodcastGen deployment parameters
//
// Required: resourceGroupName, location, aiFoundryName, storageAccountName
// Both aiFoundryName and storageAccountName must be globally unique.
//
// Deploy:
//   az deployment sub create \
//     --location <location> \
//     --template-file infra/main.bicep \
//     --parameters infra/main.bicepparam
// ──────────────────────────────────────────────────────────────────────

param resourceGroupName = 'rg-podcastgen'
param location          = 'eastus2'
param aiFoundryName     = 'podcastgen-ai'
param storageAccountName = 'podcastgenstore'

// ─── Policy-safe defaults (override as needed) ───────────────────────

// true  → managed-identity only; app must use Entra ID tokens
// false → allows API keys (SPEECH_KEY, AI_API_KEY) for local dev
param disableLocalAuth = true

// false → shared key / SAS disabled; app must use RBAC
// true  → allows SAS URLs for OUTPUT_CONTAINER_SAS_URL
param allowSharedKeyAccess = false

// ─── Optional: grant roles to your app principal ─────────────────────
// Uncomment and set the object ID of the user or managed identity
// that will run PodcastGen:

// param appPrincipalId   = '<object-id>'
// param appPrincipalType = 'User'       // or 'ServicePrincipal'
