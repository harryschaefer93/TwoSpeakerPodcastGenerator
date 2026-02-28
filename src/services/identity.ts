import type { TokenCredential } from "@azure/identity";

const COGNITIVE_SERVICES_SCOPE = "https://cognitiveservices.azure.com/.default";

let credentialSingleton: TokenCredential | undefined;

/**
 * Returns a lazily-created singleton `DefaultAzureCredential`.
 *
 * The `@azure/identity` package is imported dynamically on first call
 * to avoid blocking server startup (~20 s cold-load in dev containers).
 *
 * Works automatically with:
 * - Managed Identity (in Azure)
 * - Azure CLI (`az login`) for local development
 * - Environment variables (AZURE_CLIENT_ID, AZURE_TENANT_ID, AZURE_CLIENT_SECRET)
 */
export const getCredential = async (): Promise<TokenCredential> => {
  if (!credentialSingleton) {
    const { DefaultAzureCredential } = await import("@azure/identity");
    credentialSingleton = new DefaultAzureCredential();
  }
  return credentialSingleton;
};

/**
 * Acquires a bearer token for the Cognitive Services / AI Foundry scope.
 *
 * The SDK caches tokens internally and refreshes them automatically,
 * so calling this per-request is cheap.
 */
export const getBearerToken = async (
  scope: string = COGNITIVE_SERVICES_SCOPE
): Promise<string> => {
  const credential = await getCredential();
  const tokenResponse = await credential.getToken(scope);
  if (!tokenResponse?.token) {
    throw new Error(`Failed to acquire bearer token for scope ${scope}`);
  }
  return tokenResponse.token;
};
