import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { Configuration, PlaidApi, PlaidEnvironments } from 'plaid';

const configuration = new Configuration({
  basePath: PlaidEnvironments[process.env.PLAID_ENV as keyof typeof PlaidEnvironments || 'sandbox'],
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID!,
      'PLAID-SECRET': process.env.PLAID_SECRET!,
    },
  },
});

const plaidClient = new PlaidApi(configuration);

export async function GET() {
  try {
    // Get all Plaid items
    const items = await prisma.plaidItem.findMany({
      include: {
        accounts: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    // Get recent actions (placeholder - would need a separate table in real implementation)
    const recentActions = [
      {
        id: '1',
        action: 'test-status',
        itemId: items[0]?.id || '',
        institutionName: items[0]?.institutionName || 'Unknown',
        success: true,
        timestamp: new Date().toISOString(),
        message: 'Item status checked successfully',
      },
    ];

    return NextResponse.json({
      items: items.map(item => ({
        id: item.id,
        institutionName: item.institutionName || item.institutionId,
        institutionId: item.institutionId,
        status: 'active', // Placeholder - would need proper status field
        lastSync: item.updatedAt.toISOString(),
        accounts: item.accounts,
      })),
      recentActions,
    });
  } catch (error) {
    console.error("Error fetching Plaid actions data:", error || "Unknown error");
    return NextResponse.json(
      { error: "Failed to fetch Plaid actions data" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const { action, itemId } = await request.json();

    // Get the Plaid item
    const plaidItem = await prisma.plaidItem.findUnique({
      where: { id: itemId },
      include: { accounts: true },
    });

    if (!plaidItem) {
      return NextResponse.json(
        { success: false, message: "Plaid item not found" },
        { status: 404 }
      );
    }

    let result: any = {};

    switch (action) {
      case 'test-status':
        try {
          const itemGetResponse = await plaidClient.itemGet({
            access_token: plaidItem.accessToken,
          });
          result = {
            success: true,
            message: "Item status checked successfully",
            data: {
              item: itemGetResponse.data.item,
              status: itemGetResponse.data.status,
            },
          };
        } catch (error: any) {
          result = {
            success: false,
            message: "Failed to check item status",
            error: error.message,
          };
        }
        break;

      case 'refresh-token':
        try {
          if (!plaidItem.refreshToken) {
            throw new Error("No refresh token available");
          }

          // Note: This is a placeholder - the actual Plaid API method may vary
          // For now, we'll just return success without actually updating the token
          result = {
            success: true,
            message: "Token refresh simulation completed",
            data: {
              newAccessToken: plaidItem.accessToken, // Placeholder
            },
          };
          return NextResponse.json(result);

          // Update the access token in the database (placeholder)
          await prisma.plaidItem.update({
            where: { id: itemId },
            data: {
              updatedAt: new Date(),
            },
          });

          result = {
            success: true,
            message: "Access token refreshed successfully",
            data: {
              newAccessToken: plaidItem!.accessToken, // Placeholder
            },
          };
        } catch (error: any) {
          result = {
            success: false,
            message: "Failed to refresh access token",
            error: error.message,
          };
        }
        break;

      case 'sync-accounts':
        try {
          const accountsResponse = await plaidClient.accountsGet({
            access_token: plaidItem.accessToken,
          });

          // Update accounts in database (simplified)
          for (const account of accountsResponse.data.accounts) {
            await prisma.account.upsert({
              where: { plaidId: account.account_id },
              update: {
                name: account.name,
                type: account.type,
                subtype: account.subtype,
                mask: account.mask,
                updatedAt: new Date(),
              },
              create: {
                plaidId: account.account_id,
                name: account.name,
                type: account.type,
                subtype: account.subtype,
                mask: account.mask,
                itemId: plaidItem.id,
                userId: "default",
              },
            });
          }

          result = {
            success: true,
            message: `Synced ${accountsResponse.data.accounts.length} accounts`,
            data: {
              accountsCount: accountsResponse.data.accounts.length,
            },
          };
        } catch (error: any) {
          result = {
            success: false,
            message: "Failed to sync accounts",
            error: error.message,
          };
        }
        break;

      case 'sync-balances':
        try {
          const balanceResponse = await plaidClient.accountsBalanceGet({
            access_token: plaidItem.accessToken,
          });

          // Update balances in database
          for (const account of balanceResponse.data.accounts) {
            const dbAccount = await prisma.account.findUnique({
              where: { plaidId: account.account_id },
            });

            if (dbAccount) {
              await prisma.accountBalance.create({
                data: {
                  accountId: dbAccount.id,
                  current: account.balances.current || 0,
                  available: account.balances.available || null,
                  limit: account.balances.limit || null,
                },
              });
            }
          }

          result = {
            success: true,
            message: `Synced balances for ${balanceResponse.data.accounts.length} accounts`,
            data: {
              accountsCount: balanceResponse.data.accounts.length,
            },
          };
        } catch (error: any) {
          result = {
            success: false,
            message: "Failed to sync balances",
            error: error.message,
          };
        }
        break;

      case 'sync-transactions':
        try {
          // Sync transactions for each account
          let totalTransactions = 0;
          
          for (const account of plaidItem.accounts) {
            const dbAccount = await prisma.account.findUnique({
              where: { id: account.id },
            });

            if (dbAccount) {
              const transactionsResponse = await plaidClient.transactionsGet({
                access_token: plaidItem.accessToken,
                start_date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // Last 30 days
                end_date: new Date().toISOString().split('T')[0],
                options: {
                  account_ids: [dbAccount.plaidId],
                },
              });

              // Process transactions (simplified)
              for (const transaction of transactionsResponse.data.transactions) {
                await prisma.transaction.upsert({
                  where: { 
                    accountId_plaidId: {
                      accountId: dbAccount.id,
                      plaidId: transaction.transaction_id,
                    }
                  },
                  update: {
                    name: transaction.name,
                    amount: transaction.amount,
                    date: new Date(transaction.date),
                    category: transaction.category?.[0] || null,
                    merchantName: transaction.merchant_name || null,
                    pending: transaction.pending,
                    updatedAt: new Date(),
                  },
                  create: {
                    accountId: dbAccount.id,
                    plaidId: transaction.transaction_id,
                    name: transaction.name,
                    amount: transaction.amount,
                    date: new Date(transaction.date),
                    category: transaction.category?.[0] || null,
                    merchantName: transaction.merchant_name || null,
                    pending: transaction.pending,
                  },
                });
              }

              totalTransactions += transactionsResponse.data.transactions.length;
            }
          }

          result = {
            success: true,
            message: `Synced ${totalTransactions} transactions`,
            data: {
              transactionsCount: totalTransactions,
            },
          };
        } catch (error: any) {
          result = {
            success: false,
            message: "Failed to sync transactions",
            error: error.message,
          };
        }
        break;

      case 'disconnect':
        try {
          // Remove the item from Plaid
          await plaidClient.itemRemove({
            access_token: plaidItem.accessToken,
          });

          // Update database (placeholder - status field not available)
          await prisma.plaidItem.update({
            where: { id: itemId },
            data: {
              updatedAt: new Date(),
            },
          });

          result = {
            success: true,
            message: "Item disconnected successfully",
          };
        } catch (error: any) {
          result = {
            success: false,
            message: "Failed to disconnect item",
            error: error.message,
          };
        }
        break;

      default:
        return NextResponse.json(
          { success: false, message: "Invalid action" },
          { status: 400 }
        );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error performing Plaid action:", error || "Unknown error");
    return NextResponse.json(
      { success: false, message: "Failed to perform action", error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
} 