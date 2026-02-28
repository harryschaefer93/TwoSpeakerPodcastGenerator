targetScope = 'subscription'

// ──────────────────────────────────────────────────────────────────────
// PodcastGen — subscription-scoped deployment
//
// Creates a new resource group and deploys:
//   • AI Foundry account (project-based, AIServices kind)
//   • AI Foundry project
//   • OpenAI model deployment (script generation)
//   • Storage account + blob container (episode audio)
//   • Log Analytics workspace + diagnostic settings
//   • RBAC role assignments (Foundry MI → Storage, optional app principal)
//
// Policy-aware defaults:
//   disableLocalAuth  = true   → CognitiveServicesDisableLocalAuth
//   allowSharedKeyAccess = false → storageAccountsShouldPreventSharedKeyAccess
//   modelSkuName = GlobalStandard → avoids OpenAI_BlockProvisionedCapacity
//   Diagnostic settings on all resources → EnableCognitiveServicesDiagnostics,
//     EnableHubsAIFoundryDiagnostics, EnableProjectsAIFoundryDiagnostics,
//     diagnosticLogsInAzureAIServicesResourcesShouldBeEnabledMonitoring
// ──────────────────────────────────────────────────────────────────────

// ─── Parameters ──────────────────────────────────────────────────────

@description('Name of the resource group to create.')
param resourceGroupName string

@description('Azure region for all resources.')
param location string

@description('Globally unique name for the AI Foundry account (becomes the custom subdomain).')
param aiFoundryName string

@description('AI Foundry project name.')
param aiProjectName string = '${aiFoundryName}-proj'

@description('Globally unique name for the Storage account.')
param storageAccountName string

@description('Blob container name for episode audio output.')
param containerName string = 'episodes'

@description('OpenAI model to deploy for script generation.')
param modelName string = 'gpt-4.1'

@description('OpenAI model version.')
param modelVersion string = '2025-04-14'

@description('Model deployment SKU. Use GlobalStandard to satisfy OpenAI_BlockProvisionedCapacity policy.')
param modelSkuName string = 'GlobalStandard'

@description('Model deployment capacity (TPM in thousands).')
param modelCapacity int = 10

@description('Disable API-key auth on Cognitive Services. true = policy-compliant (CognitiveServicesDisableLocalAuth). Set false to allow SPEECH_KEY / AI_API_KEY usage during development.')
param disableLocalAuth bool = true

@description('Allow shared-key / SAS access on Storage. false = policy-compliant (storageAccountsShouldPreventSharedKeyAccess). Set true if the app still uses SAS URLs.')
param allowSharedKeyAccess bool = false

@description('Object ID of the principal (user, managed identity, or group) that runs PodcastGen, for RBAC grants. Leave empty to skip app role assignments.')
param appPrincipalId string = ''

@description('Principal type for appPrincipalId.')
@allowed(['User', 'ServicePrincipal', 'Group'])
param appPrincipalType string = 'ServicePrincipal'

@description('Tags applied to every resource (helps satisfy tagging policies).')
param tags object = {}

// ─── Resource Group ──────────────────────────────────────────────────

resource rg 'Microsoft.Resources/resourceGroups@2024-03-01' = {
  name: resourceGroupName
  location: location
  tags: tags
}

// ─── Module: AI stack ────────────────────────────────────────────────

module aiStack 'modules/ai-stack.bicep' = {
  scope: rg
  params: {
    location: location
    aiFoundryName: aiFoundryName
    aiProjectName: aiProjectName
    storageAccountName: storageAccountName
    containerName: containerName
    modelName: modelName
    modelVersion: modelVersion
    modelSkuName: modelSkuName
    modelCapacity: modelCapacity
    disableLocalAuth: disableLocalAuth
    allowSharedKeyAccess: allowSharedKeyAccess
    appPrincipalId: appPrincipalId
    appPrincipalType: appPrincipalType
    tags: tags
  }
}

// ─── Outputs (map to PodcastGen .env) ────────────────────────────────

@description('AI Foundry endpoint URL (maps to AI_ENDPOINT).')
output aiFoundryEndpoint string = aiStack.outputs.aiFoundryEndpoint

@description('Region name (maps to SPEECH_REGION).')
output speechRegion string = aiStack.outputs.speechRegion

@description('Storage account name.')
output storageAccountName string = aiStack.outputs.storageAccountNameOutput

@description('Blob container URL — use as OUTPUT_CONTAINER_SAS_URL when RBAC auth is active (no SAS query string needed).')
output outputContainerUrl string = aiStack.outputs.outputContainerUrl

@description('AI Foundry system-assigned identity principal ID (for additional external role grants).')
output aiFoundryPrincipalId string = aiStack.outputs.aiFoundryPrincipalId

@description('Model deployment name (maps to AI_DEPLOYMENT).')
output aiDeploymentName string = aiStack.outputs.aiDeploymentName
