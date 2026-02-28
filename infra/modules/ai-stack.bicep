// ──────────────────────────────────────────────────────────────────────
// ai-stack.bicep — resource-group-scoped module
//
// Deploys the full PodcastGen AI stack aligned with subscription policies:
//   AI Foundry (project-based) · Speech (via AIServices) · Storage
//   Log Analytics · Diagnostic Settings · RBAC
// ──────────────────────────────────────────────────────────────────────

// ─── Parameters ──────────────────────────────────────────────────────

@description('Azure region for all resources.')
param location string

@description('AI Foundry account name (custom subdomain).')
param aiFoundryName string

@description('AI Foundry project name.')
param aiProjectName string

@description('Storage account name.')
param storageAccountName string

@description('Blob container name for episode audio.')
param containerName string

@description('OpenAI model name.')
param modelName string

@description('OpenAI model version.')
param modelVersion string

@description('Model deployment SKU name.')
param modelSkuName string

@description('Model deployment capacity (TPM in thousands).')
param modelCapacity int

@description('Disable local (API-key) auth on Cognitive Services.')
param disableLocalAuth bool

@description('Allow shared-key / SAS access on Storage.')
param allowSharedKeyAccess bool

@description('Optional principal ID for app RBAC grants.')
param appPrincipalId string

@description('Principal type for app role assignments.')
param appPrincipalType string

@description('Resource tags.')
param tags object

// ─── Built-in role definition IDs ────────────────────────────────────

var storageBlobDataContributorRoleId = 'ba92f5b4-2d11-453d-a403-e96b0029c9fe'
var cognitiveServicesUserRoleId       = 'a97b65f3-24c7-4388-baec-2e87135dc908'

// =====================================================================
//  Log Analytics Workspace  (required by diagnostics-enforcement policies)
// =====================================================================

resource logAnalytics 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: '${aiFoundryName}-logs'
  location: location
  tags: tags
  properties: {
    sku: { name: 'PerGB2018' }
    retentionInDays: 30
  }
}

// =====================================================================
//  AI Foundry Account  (project-based, AIServices kind)
//
//  kind: AIServices gives Speech + OpenAI + all Cognitive Services in
//  a single resource.  allowProjectManagement: true enables the modern
//  project-based Foundry experience (not the older hub/workspace model).
//
//  Policy coverage:
//    CognitiveServicesDisableLocalAuth              → disableLocalAuth
//    cognitiveServicesAccountsShouldRestrictNetwork  → networkAcls
//    EnableCognitiveServicesDiagnostics              → diagnosticSettings below
//    EnableHubsAIFoundryDiagnostics                  → diagnosticSettings below
// =====================================================================

resource aiFoundry 'Microsoft.CognitiveServices/accounts@2025-06-01' = {
  name: aiFoundryName
  location: location
  tags: tags
  identity: {
    type: 'SystemAssigned'
  }
  sku: {
    name: 'S0'
  }
  kind: 'AIServices'
  properties: {
    allowProjectManagement: true
    customSubDomainName: aiFoundryName
    disableLocalAuth: disableLocalAuth
    publicNetworkAccess: 'Enabled'       // user-chosen: public with hardening
    networkAcls: {
      defaultAction: 'Allow'             // parameterize to 'Deny' for private-endpoint setups
    }
  }
}

// =====================================================================
//  AI Foundry Project
//
//  Policy coverage:
//    EnableProjectsAIFoundryDiagnostics → diagnosticSettings below
// =====================================================================

resource aiProject 'Microsoft.CognitiveServices/accounts/projects@2025-06-01' = {
  parent: aiFoundry
  name: aiProjectName
  location: location
  tags: tags
  identity: {
    type: 'SystemAssigned'
  }
  properties: {}
}

// =====================================================================
//  Model Deployment  (for PodcastGen script generation)
//
//  SKU is GlobalStandard by default to satisfy
//  OpenAI_BlockProvisionedCapacity deny policy.
// =====================================================================

resource modelDeployment 'Microsoft.CognitiveServices/accounts/deployments@2025-06-01' = {
  parent: aiFoundry
  name: modelName
  sku: {
    name: modelSkuName
    capacity: modelCapacity
  }
  properties: {
    model: {
      name: modelName
      format: 'OpenAI'
      version: modelVersion
    }
  }
}

// =====================================================================
//  Storage Account  (episode audio output)
//
//  Policy coverage:
//    StorageDisallowPublicAccess / ModifyAllowBlobAnonymousAccess
//      → allowBlobPublicAccess: false
//    StorageAccountDisableLocalAuth / storageAccountsShouldPreventSharedKeyAccess
//      → allowSharedKeyAccess parameter
//    secureTransferToStorageAccountMonitoring
//      → supportsHttpsTrafficOnly: true
//    disableUnrestrictedNetworkToStorageAccountMonitoring
//      → networkAcls with bypass: AzureServices
// =====================================================================

resource storage 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: storageAccountName
  location: location
  tags: tags
  sku: {
    name: 'Standard_LRS'
  }
  kind: 'StorageV2'
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    supportsHttpsTrafficOnly: true
    minimumTlsVersion: 'TLS1_2'
    allowBlobPublicAccess: false
    allowSharedKeyAccess: allowSharedKeyAccess
    networkAcls: {
      defaultAction: 'Allow'          // parameterize to 'Deny' for vnet-locked setups
      bypass: 'AzureServices'         // lets Speech Batch MI write results
    }
  }
}

// ─── Blob service (implicit, referenced for container + diagnostics) ─

resource blobService 'Microsoft.Storage/storageAccounts/blobServices@2023-05-01' existing = {
  parent: storage
  name: 'default'
}

// ─── Blob container ──────────────────────────────────────────────────

resource container 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = {
  parent: blobService
  name: containerName
  properties: {
    publicAccess: 'None'
  }
}

// =====================================================================
//  Diagnostic Settings
//
//  Satisfies:  EnableCognitiveServicesDiagnostics,
//    EnableHubsAIFoundryDiagnostics, EnableProjectsAIFoundryDiagnostics,
//    diagnosticLogsInAzureAIServicesResourcesShouldBeEnabledMonitoring
// =====================================================================

resource aiFoundryDiag 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = {
  name: '${aiFoundryName}-diag'
  scope: aiFoundry
  properties: {
    workspaceId: logAnalytics.id
    logs: [
      { categoryGroup: 'allLogs', enabled: true }
    ]
    metrics: [
      { category: 'AllMetrics', enabled: true }
    ]
  }
}

resource aiProjectDiag 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = {
  name: '${aiProjectName}-diag'
  scope: aiProject
  properties: {
    workspaceId: logAnalytics.id
    logs: [
      { categoryGroup: 'allLogs', enabled: true }
    ]
    metrics: [
      { category: 'AllMetrics', enabled: true }
    ]
  }
}

resource storageDiag 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = {
  name: '${storageAccountName}-diag'
  scope: storage
  properties: {
    workspaceId: logAnalytics.id
    metrics: [
      { category: 'Transaction', enabled: true }
    ]
  }
}

resource blobDiag 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = {
  name: '${storageAccountName}-blob-diag'
  scope: blobService
  properties: {
    workspaceId: logAnalytics.id
    logs: [
      { categoryGroup: 'allLogs', enabled: true }
    ]
    metrics: [
      { category: 'Transaction', enabled: true }
    ]
  }
}

// =====================================================================
//  RBAC Role Assignments
// =====================================================================

// AI Foundry system MI → Storage Blob Data Contributor
// Allows Speech Batch synthesis to write results to the container
// without SAS tokens (managed-identity auth path).
resource aiFoundryStorageRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(aiFoundry.id, storage.id, storageBlobDataContributorRoleId)
  scope: storage
  properties: {
    principalId: aiFoundry.identity.principalId
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', storageBlobDataContributorRoleId)
    principalType: 'ServicePrincipal'
  }
}

// App principal → Cognitive Services User  (Speech + OpenAI via Entra ID tokens)
resource appCognitiveRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = if (!empty(appPrincipalId)) {
  name: guid(aiFoundry.id, appPrincipalId, cognitiveServicesUserRoleId)
  scope: aiFoundry
  properties: {
    principalId: appPrincipalId
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', cognitiveServicesUserRoleId)
    principalType: appPrincipalType
  }
}

// App principal → Storage Blob Data Contributor  (read results / upload final MP3)
resource appStorageRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = if (!empty(appPrincipalId)) {
  name: guid(storage.id, appPrincipalId, storageBlobDataContributorRoleId)
  scope: storage
  properties: {
    principalId: appPrincipalId
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', storageBlobDataContributorRoleId)
    principalType: appPrincipalType
  }
}

// ─── Outputs ─────────────────────────────────────────────────────────

@description('AI Foundry endpoint URL (maps to AI_ENDPOINT and Speech custom-domain endpoint).')
output aiFoundryEndpoint string = aiFoundry.properties.endpoint

@description('Azure region (maps to SPEECH_REGION for regional endpoint fallback).')
output speechRegion string = location

@description('Storage account name.')
output storageAccountNameOutput string = storage.name

@description('Blob container URL for episode output (use as OUTPUT_CONTAINER_SAS_URL with RBAC — no SAS query string needed).')
output outputContainerUrl string = '${storage.properties.primaryEndpoints.blob}${containerName}'

@description('AI Foundry system-assigned identity principal ID.')
output aiFoundryPrincipalId string = aiFoundry.identity.principalId

@description('Deployed model name (maps to AI_DEPLOYMENT).')
output aiDeploymentName string = modelDeployment.name
