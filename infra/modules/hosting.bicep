// ──────────────────────────────────────────────────────────────────────
// hosting.bicep — resource-group-scoped module
//
// Deploys Container Apps hosting for PodcastGen:
//   ACR · Container Apps Environment · Container App · RBAC
// ──────────────────────────────────────────────────────────────────────

// ─── Parameters ──────────────────────────────────────────────────────

@description('Azure region for all resources.')
param location string

@description('Base name prefix for Container Apps resources.')
param baseName string

@description('Globally unique name for the Azure Container Registry (alphanumeric only, 5-50 chars).')
param acrName string

@description('AI Foundry account name (for existing resource reference and RBAC).')
param aiFoundryName string

@description('Storage account name (for existing resource reference and RBAC).')
param storageAccountName string

@description('Log Analytics workspace name (for Container Apps Environment logging).')
param logAnalyticsWorkspaceName string

@description('Azure Speech / AI Foundry endpoint URL (maps to SPEECH_ENDPOINT).')
param speechEndpoint string

@description('Blob container URL for episode output (maps to OUTPUT_CONTAINER_URL).')
param outputContainerUrl string

@description('Azure OpenAI endpoint URL (maps to AI_ENDPOINT).')
param aiEndpoint string

@description('Azure OpenAI deployment name (maps to AI_DEPLOYMENT).')
param aiDeployment string

@description('Resource tags.')
param tags object = {}

// ─── Built-in role definition IDs ────────────────────────────────────

var acrPullRoleId                = '7f951dda-4ed3-4680-a7ca-43fe172d538d'
var cognitiveServicesUserRoleId  = 'a97b65f3-24c7-4388-baec-2e87135dc908'
var storageBlobContributorRoleId = 'ba92f5b4-2d11-453d-a403-e96b0029c9fe'

// ─── Existing resource references ────────────────────────────────────

resource logAnalytics 'Microsoft.OperationalInsights/workspaces@2023-09-01' existing = {
  name: logAnalyticsWorkspaceName
}

resource aiFoundry 'Microsoft.CognitiveServices/accounts@2025-06-01' existing = {
  name: aiFoundryName
}

resource storage 'Microsoft.Storage/storageAccounts@2023-05-01' existing = {
  name: storageAccountName
}

// =====================================================================
//  Azure Container Registry
// =====================================================================

resource acr 'Microsoft.ContainerRegistry/registries@2023-07-01' = {
  name: acrName
  location: location
  tags: tags
  sku: {
    name: 'Basic'
  }
  properties: {
    adminUserEnabled: false
  }
}

// =====================================================================
//  Container Apps Environment
// =====================================================================

resource cae 'Microsoft.App/managedEnvironments@2024-03-01' = {
  name: '${baseName}-cae'
  location: location
  tags: tags
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: logAnalytics.properties.customerId
        sharedKey: logAnalytics.listKeys().primarySharedKey
      }
    }
  }
}

// =====================================================================
//  Container App
//
//  Starts with a placeholder image; `azd deploy` replaces it with
//  the real PodcastGen image from ACR.
// =====================================================================

resource app 'Microsoft.App/containerApps@2024-03-01' = {
  name: '${baseName}-app'
  location: location
  tags: tags
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    managedEnvironmentId: cae.id
    configuration: {
      ingress: {
        external: true
        targetPort: 3000
        transport: 'http'
        allowInsecure: false
      }
      registries: [
        {
          server: acr.properties.loginServer
          identity: 'system'
        }
      ]
    }
    template: {
      containers: [
        {
          name: 'podcastgen'
          image: 'mcr.microsoft.com/azuredocs/containerapps-helloworld:latest'
          resources: {
            cpu: json('0.5')
            memory: '1Gi'
          }
          env: [
            { name: 'PORT', value: '3000' }
            { name: 'NODE_ENV', value: 'production' }
            { name: 'SPEECH_ENDPOINT', value: speechEndpoint }
            { name: 'OUTPUT_CONTAINER_URL', value: outputContainerUrl }
            { name: 'AI_ENDPOINT', value: aiEndpoint }
            { name: 'AI_DEPLOYMENT', value: aiDeployment }
          ]
        }
      ]
      scale: {
        minReplicas: 0
        maxReplicas: 3
        rules: [
          {
            name: 'http-scaling'
            http: {
              metadata: {
                concurrentRequests: '50'
              }
            }
          }
        ]
      }
    }
  }
}

// =====================================================================
//  RBAC Role Assignments
// =====================================================================

// Container App MI → ACR Pull (image pulls from registry)
resource acrPullRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(acr.id, app.id, acrPullRoleId)
  scope: acr
  properties: {
    principalId: app.identity.principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', acrPullRoleId)
  }
}

// Container App MI → Cognitive Services User (Speech + OpenAI via Entra ID)
resource cognitiveRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(aiFoundry.id, app.id, cognitiveServicesUserRoleId)
  scope: aiFoundry
  properties: {
    principalId: app.identity.principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', cognitiveServicesUserRoleId)
  }
}

// Container App MI → Storage Blob Data Contributor (episode uploads)
resource blobRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(storage.id, app.id, storageBlobContributorRoleId)
  scope: storage
  properties: {
    principalId: app.identity.principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', storageBlobContributorRoleId)
  }
}

// ─── Outputs ─────────────────────────────────────────────────────────

@description('FQDN of the deployed Container App.')
output containerAppFqdn string = app.properties.configuration.ingress.fqdn

@description('Full URL of the deployed Container App.')
output containerAppUrl string = 'https://${app.properties.configuration.ingress.fqdn}'

@description('ACR login server for pushing images.')
output acrLoginServer string = acr.properties.loginServer

@description('Container App resource name (used by azd deploy).')
output containerAppName string = app.name

@description('Container App managed identity principal ID.')
output appPrincipalId string = app.identity.principalId

@description('Container Apps Environment name.')
output containerAppsEnvironmentName string = cae.name
