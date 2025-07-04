import { Configuration, PlaidApi, PlaidEnvironments } from "plaid";
import { prisma } from "./db";
import { trackPlaidApiCall, getCurrentUserId, getAppInstanceId } from "./plaidTracking";
import { backupPlaidItem } from "./accessTokenBackup";

if (!process.env.PLAID_CLIENT_ID || !process.env.PLAID_SECRET) {
  throw new Error("Missing Plaid credentials in environment variables");
}

const configuration = new Configuration({
  basePath:
    PlaidEnvironments[
      (process.env.PLAID_ENV as keyof typeof PlaidEnvironments) || "sandbox"
    ],
  baseOptions: {
    headers: {
      "PLAID-CLIENT-ID": process.env.PLAID_CLIENT_ID,
      "PLAID-SECRET": process.env.PLAID_SECRET,
    },
  },
});

export const plaidClient = new PlaidApi(configuration);

/**
 * Disconnect Plaid access tokens for given PlaidItems
 * This function revokes access tokens via Plaid API and marks items as disconnected in the database
 * Enhanced to handle already-revoked tokens gracefully
 */
export async function disconnectPlaidTokens(plaidItems: Array<{ id: string; accessToken: string; institutionId: string; institutionName: string | null }>): Promise<{
  success: string[];
  failed: Array<{ itemId: string; error: string }>;
}> {
  const success: string[] = [];
  const failed: Array<{ itemId: string; error: string }> = [];

  for (const item of plaidItems) {
    try {
      console.log(`[Plaid] Disconnecting item ${item.id} for ${item.institutionName || item.institutionId}`);
      
      const userId = await getCurrentUserId();
      const appInstanceId = getAppInstanceId();
      
      // Pre-validate access token before attempting disconnection
      let tokenAlreadyRevoked = false;
      try {
        await trackPlaidApiCall(
          () => plaidClient.itemGet({ access_token: item.accessToken }),
          {
            endpoint: '/item/get',
            institutionId: item.institutionId,
            userId,
            appInstanceId,
            requestData: { accessToken: '***' }
          }
        );
      } catch (validationError: any) {
        // Check if token is already revoked/invalid
        const errorCode = validationError?.response?.data?.error_code;
        const isAlreadyRevoked = [
          'ITEM_NOT_FOUND',
          'INVALID_ACCESS_TOKEN',
          'ITEM_EXPIRED'
        ].includes(errorCode);
        
        if (isAlreadyRevoked) {
          console.log(`[PLAID DISCONNECT] Token for item ${item.id} already revoked (${errorCode}) - skipping Plaid API call`);
          tokenAlreadyRevoked = true;
        } else {
          // Re-throw if it's a different type of error
          throw validationError;
        }
      }
      
      // Only call itemRemove if token is still valid
      if (!tokenAlreadyRevoked) {
        try {
          await trackPlaidApiCall(
            () => plaidClient.itemRemove({ access_token: item.accessToken }),
            {
              endpoint: '/item/remove',
              institutionId: item.institutionId,
              userId,
              appInstanceId,
              requestData: { accessToken: '***' } // Don't log the actual token
            }
          );
          console.log(`[Plaid] Successfully revoked access token for item ${item.id}`);
        } catch (removeError: any) {
          // Handle 400 errors gracefully (token already revoked)
          const errorCode = removeError?.response?.data?.error_code;
          const isAlreadyRevoked = [
            'ITEM_NOT_FOUND',
            'INVALID_ACCESS_TOKEN',
            'ITEM_EXPIRED'
          ].includes(errorCode);
          
          if (isAlreadyRevoked) {
            console.log(`[PLAID DISCONNECT] Token for item ${item.id} already revoked during removal (${errorCode}) - continuing with cleanup`);
          } else {
            // Re-throw if it's a different type of error
            throw removeError;
          }
        }
      }
      
      // Mark as disconnected in the database (regardless of Plaid API result)
      const updatedItem = await prisma.plaidItem.update({
        where: { id: item.id },
        data: { status: 'disconnected' } as any
      });
      
      // Backup the disconnected access token (preserve it even when disconnected)
      const backupResult = await backupPlaidItem(updatedItem);
      if (backupResult.success) {
        console.log(`[Plaid] Access token backed up: ${backupResult.message}`);
      } else {
        console.warn(`[PLAID DISCONNECT] Failed to backup disconnected access token: ${backupResult.message}`);
      }
      
      success.push(item.id);
      console.log(`[Plaid] Successfully disconnected item ${item.id} (${tokenAlreadyRevoked ? 'token was already revoked' : 'token revoked'})`);
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error || 'Unknown error');
      console.error(`[PLAID DISCONNECT] Failed to disconnect PlaidItem ${item.id}:`, errorMessage);
      failed.push({ itemId: item.id, error: errorMessage });
    }
  }

  return { success, failed };
}
