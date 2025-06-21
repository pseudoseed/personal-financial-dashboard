import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { plaidClient } from "@/lib/plaid";
import type { PlaidItem } from "@prisma/client";
import { downloadTransactions } from "@/lib/transactions";

interface InstitutionChange {
  name: string;
  accounts: Array<{
    name: string;
    nickname: string | null;
    previousBalance: number;
    currentBalance: number;
    change: number;
    isPositive: boolean;
  }>;
}

async function getSpotPrice(currency: string): Promise<number | null> {
  console.log("Getting spot price for:", currency);
  try {
    const response = await fetch(
      `https://api.coinbase.com/v2/prices/${currency}-USD/spot`,
      {
        headers: {
          "CB-VERSION": "2024-02-07",
        },
      }
    );

    if (!response.ok) {
      console.warn(`No USD spot price available for ${currency}`);
      return null;
    }

    const { data } = await response.json();
    return parseFloat(data.amount);
  } catch (error) {
    console.warn(`Error fetching spot price for ${currency}:`, error);
    return null;
  }
}

async function refreshCoinbaseToken(item: PlaidItem): Promise<string> {
  if (!item.refreshToken) {
    throw new Error("No refresh token available");
  }

  const response = await fetch("https://api.coinbase.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "refresh_token",
      refresh_token: item.refreshToken,
      client_id: process.env.COINBASE_CLIENT_ID,
      client_secret: process.env.COINBASE_CLIENT_SECRET,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to refresh token: ${response.status}`);
  }

  const { access_token, refresh_token } = await response.json();

  // Update tokens in database
  await prisma.plaidItem.update({
    where: { id: item.id },
    data: {
      accessToken: access_token,
      refreshToken: refresh_token,
    },
  });

  return access_token;
}

async function refreshCoinbaseAccounts(
  item: PlaidItem,
  institutionChanges: InstitutionChange
): Promise<number> {
  console.log("Refreshing Coinbase accounts for:", item.institutionName);
  try {
    let accessToken = item.accessToken;
    let response = await fetch(
      "https://api.coinbase.com/v2/accounts?limit=100",
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "CB-VERSION": "2024-02-07",
        },
      }
    );

    // If token expired, try refreshing it
    if (response.status === 401) {
      console.log("Access token expired, refreshing...");
      accessToken = await refreshCoinbaseToken(item);
      response = await fetch("https://api.coinbase.com/v2/accounts?limit=100", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "CB-VERSION": "2024-02-07",
        },
      });
    }

    if (!response.ok) {
      throw new Error(`Coinbase API error: ${response.status}`);
    }

    const { data: accounts } = await response.json();
    let totalChange = 0;

    for (const account of accounts) {
      console.log("Processing Coinbase account:", account.name);
      const cryptoAmount = parseFloat(account.balance.amount);

      // Skip accounts with zero balance
      if (cryptoAmount <= 0) {
        console.log("Skipping account with zero balance:", account.name);
        continue;
      }

      // Get the spot price and calculate USD value
      const spotPrice = await getSpotPrice(account.balance.currency);

      // Log account details for debugging
      console.log("Processing Coinbase account:", {
        name: account.name,
        currency: account.balance.currency,
        amount: account.balance.amount,
        spotPrice: spotPrice || "Not available",
      });

      // Skip if we can't get a USD value
      if (!spotPrice) {
        console.warn(
          `Skipping ${account.name} (${account.balance.currency}) - no USD spot price available`
        );
        continue;
      }

      const usdValue = cryptoAmount * spotPrice;

      const existingAccount = await prisma.account.findFirst({
        where: { plaidId: `coinbase_${account.id}` },
        include: {
          balances: {
            orderBy: {
              date: "desc",
            },
            take: 1,
          },
        },
      });

      if (existingAccount) {
        const previousBalance = existingAccount.balances[0]?.current || 0;
        const change = usdValue - previousBalance;

        // Create new balance record
        await prisma.accountBalance.create({
          data: {
            accountId: existingAccount.id,
            current: usdValue,
            available: usdValue,
          },
        });

        // Add to institution changes if there's a significant change
        if (Math.abs(change) > 0.01) {
          if (!institutionChanges.accounts) {
            institutionChanges.accounts = [];
          }
          institutionChanges.accounts.push({
            name: existingAccount.name,
            nickname: existingAccount.nickname,
            previousBalance,
            currentBalance: usdValue,
            change,
            isPositive: change > 0,
          });
          totalChange += change;
        }
      } else {
        // Create new account if it doesn't exist
        const newAccount = await prisma.account.create({
          data: {
            plaidId: `coinbase_${account.id}`,
            name: `${account.name} (${account.balance.currency})`,
            type: "investment",
            subtype: "crypto",
            itemId: item.id,
            userId: "default",
          },
        });

        // Create initial balance
        await prisma.accountBalance.create({
          data: {
            accountId: newAccount.id,
            current: usdValue,
            available: usdValue,
          },
        });
      }
    }

    return totalChange;
  } catch (error) {
    console.error(
      `Error refreshing Coinbase accounts for item ${item.id}:`,
      error
    );
    throw error;
  }
}

export async function POST() {
  try {
    console.log("Starting full account refresh process...");

    // Get all Plaid items
    const items = await prisma.plaidItem.findMany({
      where: {
        accessToken: {
          not: "manual",
        },
      },
      include: {
        accounts: true,
      },
    });

    let totalAccountsRefreshed = 0;
    let totalLiabilityAccountsUpdated = 0;
    const results = {
      successful: [] as string[],
      failed: [] as Array<{ institution: string; error: string; errorCode?: string }>,
    };

    for (const item of items) {
      try {
        console.log(`Processing item: ${item.institutionName || item.institutionId}`);

        if (item.provider === "plaid") {
          try {
            // Get updated account balances from Plaid
            const response = await plaidClient.accountsBalanceGet({
              access_token: item.accessToken,
            });

            // Process each account
            for (const plaidAccount of response.data.accounts) {
              const existingAccount = await prisma.account.findUnique({
                where: { plaidId: plaidAccount.account_id },
                include: {
                  plaidItem: true,
                  balances: {
                    orderBy: { date: "desc" },
                    take: 1,
                  },
                },
              });

              if (existingAccount) {
                // Update account details if needed
                await prisma.account.update({
                  where: { id: existingAccount.id },
                  data: {
                    name: plaidAccount.name,
                    mask: plaidAccount.mask,
                    type: plaidAccount.type,
                    subtype: plaidAccount.subtype || null,
                  },
                });

                // Create new balance record
                await prisma.accountBalance.create({
                  data: {
                    accountId: existingAccount.id,
                    current: plaidAccount.balances.current || 0,
                    available: plaidAccount.balances.available || null,
                    limit: plaidAccount.balances.limit || null,
                  },
                });

                // Fetch liability data for credit/loan accounts
                if ((plaidAccount.type === "credit" || plaidAccount.type === "loan")) {
                  try {
                    console.log(`Fetching liability data for ${plaidAccount.name}...`);
                    const liabilityResponse = await plaidClient.liabilitiesGet({
                      access_token: item.accessToken,
                      options: {
                        account_ids: [plaidAccount.account_id],
                      },
                    });

                    const liabilities = liabilityResponse.data.liabilities;
                    if (liabilities) {
                      // Handle credit card liabilities
                      const credit = liabilities.credit?.find(c => c.account_id === plaidAccount.account_id);
                      if (credit) {
                        console.log(`Found credit liability data for ${plaidAccount.name}`);
                        await prisma.account.update({
                          where: { id: existingAccount.id },
                          data: {
                            lastStatementBalance: credit.last_statement_balance || null,
                            minimumPaymentAmount: credit.minimum_payment_amount || null,
                            nextPaymentDueDate: credit.next_payment_due_date ? new Date(credit.next_payment_due_date) : null,
                            lastPaymentDate: credit.last_payment_date ? new Date(credit.last_payment_date) : null,
                            lastPaymentAmount: credit.last_payment_amount || null,
                          },
                        });
                        totalLiabilityAccountsUpdated++;
                      }

                      // Handle mortgage liabilities
                      const mortgage = liabilities.mortgage?.find(m => m.account_id === plaidAccount.account_id);
                      if (mortgage) {
                        console.log(`Found mortgage liability data for ${plaidAccount.name}`);
                        await prisma.account.update({
                          where: { id: existingAccount.id },
                          data: {
                            lastStatementBalance: mortgage.last_payment_amount || null,
                            minimumPaymentAmount: mortgage.next_monthly_payment || null,
                            nextPaymentDueDate: mortgage.next_payment_due_date ? new Date(mortgage.next_payment_due_date) : null,
                            lastPaymentDate: mortgage.last_payment_date ? new Date(mortgage.last_payment_date) : null,
                            lastPaymentAmount: mortgage.last_payment_amount || null,
                            nextMonthlyPayment: mortgage.next_monthly_payment || null,
                            originationDate: mortgage.origination_date ? new Date(mortgage.origination_date) : null,
                            originationPrincipalAmount: mortgage.origination_principal_amount || null,
                          },
                        });
                        totalLiabilityAccountsUpdated++;
                      }

                      // Handle student loan liabilities
                      const student = liabilities.student?.find(s => s.account_id === plaidAccount.account_id);
                      if (student) {
                        console.log(`Found student loan liability data for ${plaidAccount.name}`);
                        await prisma.account.update({
                          where: { id: existingAccount.id },
                          data: {
                            lastStatementBalance: student.last_payment_amount || null,
                            minimumPaymentAmount: student.minimum_payment_amount || null,
                            nextPaymentDueDate: student.next_payment_due_date ? new Date(student.next_payment_due_date) : null,
                            lastPaymentDate: student.last_payment_date ? new Date(student.last_payment_date) : null,
                            lastPaymentAmount: student.last_payment_amount || null,
                            originationDate: student.origination_date ? new Date(student.origination_date) : null,
                            originationPrincipalAmount: student.origination_principal_amount || null,
                          },
                        });
                        totalLiabilityAccountsUpdated++;
                      }
                    }
                  } catch (error) {
                    console.error(`Error fetching liability data for ${plaidAccount.name}:`, error);
                  }
                }

                totalAccountsRefreshed++;
              }
            }

            // Mark this institution as successful
            results.successful.push(item.institutionName || item.institutionId);
          } catch (error) {
            console.error(`Error processing item ${item.institutionName || item.institutionId}:`, error);
            
            // Check if it's an authentication error
            let errorMessage = "Unknown error";
            let errorCode: string | undefined;
            
            if ((error as any).response?.data) {
              const plaidError = (error as any).response.data;
              errorCode = plaidError.error_code;
              
              // Log the full Plaid error for debugging
              console.log(`Plaid API Error for ${item.institutionName || item.institutionId}:`, plaidError);
              
              switch (plaidError.error_code) {
                case "ITEM_LOGIN_REQUIRED":
                  errorMessage = "Authentication expired - please re-authenticate";
                  break;
                case "INVALID_ACCESS_TOKEN":
                  errorMessage = "Access token is no longer valid";
                  break;
                case "INVALID_CREDENTIALS":
                  errorMessage = "Please update your credentials";
                  break;
                case "INSTITUTION_DOWN":
                  errorMessage = "Institution is temporarily unavailable";
                  break;
                default:
                  errorMessage = plaidError.error_message || "Plaid API error";
              }
            } else {
              errorMessage = error instanceof Error ? error.message : "Unknown error";
            }
            
            results.failed.push({
              institution: item.institutionName || item.institutionId,
              error: errorMessage,
              errorCode,
            });
          }
        } else if (item.provider === "coinbase") {
          // Handle Coinbase accounts
          const institutionChanges: InstitutionChange = {
            name: item.institutionName || item.institutionId,
            accounts: [],
          };
          await refreshCoinbaseAccounts(item, institutionChanges);
          totalAccountsRefreshed += item.accounts.length;
          
          // Mark this institution as successful
          results.successful.push(item.institutionName || item.institutionId);
        }
      } catch (error) {
        const institutionName = item.institutionName || item.institutionId;
        console.error(`Error processing item ${institutionName}:`, error);
        
        // Check if it's a Plaid API error
        let errorMessage = "Unknown error";
        let errorCode: string | undefined;
        
        if ((error as any).response?.data) {
          const plaidError = (error as any).response.data;
          errorCode = plaidError.error_code;
          
          // Log the full Plaid error for debugging
          console.log(`Plaid API Error for ${institutionName}:`, plaidError);
          
          switch (plaidError.error_code) {
            case "ITEM_LOGIN_REQUIRED":
              errorMessage = "Authentication expired - please re-authenticate";
              break;
            case "INVALID_ACCESS_TOKEN":
              errorMessage = "Access token is no longer valid";
              break;
            case "INVALID_CREDENTIALS":
              errorMessage = "Please update your credentials";
              break;
            case "INSTITUTION_DOWN":
              errorMessage = "Institution is temporarily unavailable";
              break;
            default:
              errorMessage = plaidError.error_message || "Plaid API error";
          }
        } else {
          errorMessage = error instanceof Error ? error.message : "Unknown error";
        }
        
        results.failed.push({
          institution: institutionName,
          error: errorMessage,
          errorCode,
        });
      }
    }

    console.log(`Refresh completed: ${totalAccountsRefreshed} accounts refreshed, ${totalLiabilityAccountsUpdated} liability accounts updated`);
    console.log(`Results: ${results.successful.length} successful, ${results.failed.length} failed`);

    return NextResponse.json({
      success: true,
      accountsRefreshed: totalAccountsRefreshed,
      liabilityAccountsUpdated: totalLiabilityAccountsUpdated,
      results,
    });
  } catch (error) {
    console.error("Error in account refresh:", error);
    return NextResponse.json(
      { error: "Failed to refresh accounts" },
      { status: 500 }
    );
  }
}
