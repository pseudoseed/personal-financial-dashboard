import { Configuration, PlaidApi, PlaidEnvironments } from "plaid";
import { prisma } from "./db";

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
 */
export async function disconnectPlaidTokens(plaidItems: Array<{ id: string; accessToken: string; institutionId: string; institutionName: string | null }>): Promise<{
  success: string[];
  failed: Array<{ itemId: string; error: string }>;
}> {
  const success: string[] = [];
  const failed: Array<{ itemId: string; error: string }> = [];

  for (const item of plaidItems) {
    try {
      console.log(`[PLAID DISCONNECT] Attempting to disconnect PlaidItem ${item.id} for institution ${item.institutionName || item.institutionId}`);
      
      // Call Plaid /item/remove to revoke the access token
      await plaidClient.itemRemove({ access_token: item.accessToken });
      
      // Mark as disconnected in the database
      await prisma.plaidItem.update({
        where: { id: item.id },
        data: { status: 'disconnected' } as any
      });
      
      success.push(item.id);
      console.log(`[PLAID DISCONNECT] Successfully disconnected PlaidItem ${item.id}`);
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error || 'Unknown error');
      console.error(`[PLAID DISCONNECT] Failed to disconnect PlaidItem ${item.id}:`, errorMessage);
      failed.push({ itemId: item.id, error: errorMessage });
    }
  }

  return { success, failed };
}
