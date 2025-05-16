import { PrismaClient } from "@prisma/client";
import { Configuration, PlaidApi, PlaidEnvironments, CountryCode } from "plaid";
import nodemailer from "nodemailer";
import handlebars from "handlebars";
import fs from "fs";
import path from "path";
import { PlaidItem } from "@prisma/client";
import { downloadTransactions } from "@/lib/transactions";

interface AccountChange {
  name: string;
  nickname: string | null;
  previousBalance: number;
  currentBalance: number;
  change: number;
  isPositive: boolean;
  type: string;
}

interface InstitutionChange {
  name: string;
  accounts: AccountChange[];
}

interface PlaidErrorResponse {
  error_code: string;
  error_message: string;
  display_message?: string;
  request_id?: string;
}

interface PlaidApiError extends Error {
  response?: {
    data: PlaidErrorResponse;
  };
}

const prisma = new PrismaClient();

// Initialize Plaid client
const configuration = new Configuration({
  basePath:
    PlaidEnvironments[
      (process.env.PLAID_ENV as keyof typeof PlaidEnvironments) || "sandbox"
    ],
  baseOptions: {
    headers: {
      "PLAID-CLIENT-ID": process.env.PLAID_CLIENT_ID!,
      "PLAID-SECRET": process.env.PLAID_SECRET!,
    },
  },
});

const plaidClient = new PlaidApi(configuration);

// Email configuration
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: parseInt(process.env.EMAIL_PORT || "587"),
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

// Verify email configuration
transporter.verify(function (error) {
  if (error) {
    console.error("Email configuration error:", error);
    process.exit(1);
  } else {
    console.log("Email server is ready to send messages");
  }
});

// Helper function to format money
handlebars.registerHelper("formatMoney", (amount: number) => {
  return amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
});

// Helper to check if an account is a loan or credit account
handlebars.registerHelper("isLoanOrCredit", (type: string) => {
  if (!type) return false;
  const accountType = type.toLowerCase();
  return accountType === "credit" || accountType === "loan";
});

// Helper to get absolute value
handlebars.registerHelper("absValue", (value: number) => {
  return Math.abs(value);
});

async function refreshInstitutions() {
  console.log("Refreshing institutions...");
  const items = await prisma.plaidItem.findMany({
    where: {
      accessToken: {
        not: "manual",
      },
    },
  });

  for (const item of items) {
    try {
      console.log(`Processing institution: ${item.institutionId}`);

      // Skip Coinbase items as they don't need institution refresh
      if (item.provider === "coinbase") {
        continue;
      }

      const response = await plaidClient.institutionsGetById({
        institution_id: item.institutionId,
        country_codes: [CountryCode.Us],
      });

      const institution = response.data.institution;

      await prisma.plaidItem.update({
        where: { id: item.id },
        data: {
          institutionName: institution.name,
        },
      });

      console.log(`Updated institution: ${institution.name}`);
    } catch (error) {
      if (error instanceof Error) {
        console.error(
          `Error refreshing institution ${item.institutionId}:`,
          error.message
        );
      } else {
        console.error(
          `Unknown error refreshing institution ${item.institutionId}:`,
          error
        );
      }
    }
  }
}

async function checkItemStatus(accessToken: string): Promise<boolean> {
  try {
    const response = await plaidClient.itemGet({
      access_token: accessToken,
    });

    const item = response.data.item;
    if (item.error) {
      console.log(
        `Item status check failed: ${item.error.error_code} - ${item.error.error_message}`
      );
      return false;
    }
    return true;
  } catch (error) {
    console.error("Error checking item status:", error);
    return false;
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
      const existingAccount = await prisma.account.findUnique({
        where: { plaidId: `coinbase_${account.id}` },
        select: {
          id: true,
          type: true,
          balances: {
            orderBy: { date: "desc" },
            take: 1,
          },
          nickname: true,
          name: true,
          plaidId: true,
          itemId: true,
          createdAt: true,
          updatedAt: true,
          subtype: true,
          mask: true,
          hidden: true,
          metadata: true,
          url: true,
          plaidItem: true,
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

        // Track significant changes (more than 1 cent)
        if (Math.abs(change) > 0.01) {
          // For loan and credit accounts, a decreasing balance is positive
          const isLoanOrCredit =
            existingAccount.type.toLowerCase() === "credit" ||
            existingAccount.type.toLowerCase() === "loan";
          const isPositive = isLoanOrCredit ? change < 0 : change > 0;

          institutionChanges.accounts.push({
            name: existingAccount.name,
            nickname: existingAccount.nickname,
            previousBalance,
            currentBalance: usdValue,
            change,
            isPositive,
            type: existingAccount.type,
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

async function refreshBalances(): Promise<{
  changes: InstitutionChange[];
  totalChange: number;
  portfolioSummary: {
    netWorth: number;
    totalAssets: number;
    totalLiabilities: number;
  };
}> {
  console.log("Refreshing account balances and transactions...");
  const items = await prisma.plaidItem.findMany({
    where: {
      accessToken: {
        not: "manual",
      },
    },
    include: {
      accounts: {
        where: {},
      },
    },
  });

  const changes: InstitutionChange[] = [];
  let totalChange = 0;

  for (const item of items) {
    try {
      console.log(
        `Processing accounts for institution: ${
          item.institutionName || item.institutionId
        }`
      );

      const institutionChanges: InstitutionChange = {
        name: item.institutionName || item.institutionId,
        accounts: [],
      };

      if (item.provider === "coinbase") {
        totalChange += await refreshCoinbaseAccounts(item, institutionChanges);
      } else {
        // Check item status first
        const isItemValid = await checkItemStatus(item.accessToken);
        if (!isItemValid) {
          console.error(
            `Item needs to be re-authenticated for institution: ${
              item.institutionName || item.institutionId
            }`
          );
          continue;
        }

        // Set min_last_updated_datetime to 24 hours ago
        const minLastUpdated = new Date();
        minLastUpdated.setHours(minLastUpdated.getHours() - 24);

        const response = await plaidClient.accountsBalanceGet({
          access_token: item.accessToken,
          options: {
            min_last_updated_datetime: minLastUpdated.toISOString(),
          },
        });

        const accounts = response.data.accounts;

        for (const account of accounts) {
          const existingAccount = await prisma.account.findUnique({
            where: { plaidId: account.account_id },
            select: {
              id: true,
              type: true,
              balances: {
                orderBy: { date: "desc" },
                take: 1,
              },
              nickname: true,
              name: true,
              plaidId: true,
              itemId: true,
              createdAt: true,
              updatedAt: true,
              subtype: true,
              mask: true,
              hidden: true,
              metadata: true,
              url: true,
              plaidItem: true,
            },
          });

          if (existingAccount) {
            const previousBalance = existingAccount.balances[0]?.current || 0;
            const currentBalance = account.balances.current || 0;
            const change = currentBalance - previousBalance;

            // Track changes if they are significant
            if (Math.abs(change) > 0.01) {
              // For loan and credit accounts, a decreasing balance is positive
              const isLoanOrCredit =
                existingAccount.type.toLowerCase() === "credit" ||
                existingAccount.type.toLowerCase() === "loan";
              const isPositive = isLoanOrCredit ? change < 0 : change > 0;

              institutionChanges.accounts.push({
                name: account.name,
                nickname: existingAccount.nickname,
                previousBalance,
                currentBalance,
                change,
                isPositive,
                type: existingAccount.type,
              });
              totalChange += change;
            }

            await prisma.accountBalance.create({
              data: {
                accountId: existingAccount.id,
                current: currentBalance,
                available: account.balances.available || null,
                limit: account.balances.limit || null,
              },
            });

            await prisma.account.update({
              where: { id: existingAccount.id },
              data: {
                name: account.name,
                mask: account.mask,
                type: account.type,
                subtype: account.subtype || null,
              },
            });

            // Download transactions for this account
            try {
              console.log(
                `Downloading transactions for account: ${account.name}`
              );
              const result = await downloadTransactions(
                prisma,
                existingAccount
              );
              console.log(
                `Downloaded ${result.numTransactions} transactions for ${account.name}`
              );
            } catch (error) {
              console.error(
                `Error downloading transactions for ${account.name}:`,
                error
              );
            }
          }
        }
      }

      if (institutionChanges.accounts.length > 0) {
        changes.push(institutionChanges);
      }

      console.log(
        `Refreshed balances and transactions for: ${
          item.institutionName || item.institutionId
        }`
      );
    } catch (error) {
      if (error instanceof Error) {
        let errorMessage = `Error refreshing data for ${
          item.institutionName || item.institutionId
        }: ${error.message}`;

        // Check if it's a Plaid API error
        const plaidError = error as PlaidApiError;
        if (plaidError.response?.data) {
          const errorData = plaidError.response.data;
          errorMessage += `\nPlaid Error: ${errorData.error_code} - ${errorData.error_message}`;

          // Specific handling for common errors
          switch (errorData.error_code) {
            case "ITEM_LOGIN_REQUIRED":
              errorMessage += "\nAction needed: User needs to re-authenticate";
              break;
            case "INVALID_ACCESS_TOKEN":
              errorMessage += "\nAction needed: Token needs to be refreshed";
              break;
            case "INVALID_CREDENTIALS":
              errorMessage +=
                "\nAction needed: User needs to update credentials";
              break;
            case "INSTITUTION_DOWN":
              errorMessage += "\nThe institution is currently unavailable";
              break;
          }
        }

        console.error(errorMessage);
      } else {
        console.error(
          `Unknown error refreshing data for ${
            item.institutionName || item.institutionId
          }:`,
          error
        );
      }
    }
  }

  // Calculate current portfolio totals
  const allAccounts = await prisma.account.findMany({
    include: {
      balances: {
        orderBy: {
          date: "desc",
        },
        take: 1,
      },
    },
  });

  let totalAssets = 0;
  let totalLiabilities = 0;

  // Calculate total assets and liabilities
  allAccounts.forEach((account) => {
    if (account.balances.length === 0) return;

    const currentBalance = account.balances[0].current;
    const accountType = account.type.toLowerCase();

    if (accountType === "credit" || accountType === "loan") {
      totalLiabilities += Math.abs(currentBalance);
    } else {
      totalAssets += currentBalance;
    }
  });

  const netWorth = totalAssets - totalLiabilities;

  const portfolioSummary = {
    netWorth,
    totalAssets,
    totalLiabilities,
  };

  return { changes, totalChange, portfolioSummary };
}

async function sendEmail(
  changes: InstitutionChange[],
  totalChange: number,
  portfolioSummary: {
    netWorth: number;
    totalAssets: number;
    totalLiabilities: number;
  }
): Promise<void> {
  const templatePath = path.join(__dirname, "email-template.html");
  const template = handlebars.compile(fs.readFileSync(templatePath, "utf-8"));

  // Calculate the total number of accounts with changes
  const totalAccountsChanged = changes.reduce(
    (total, institution) => total + institution.accounts.length,
    0
  );

  const html = template({
    date: new Date().toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    }),
    hasChanges: changes.length > 0,
    institutions: changes,
    totalChange,
    isTotalPositive: totalChange > 0,
    totalAccountsChanged,
    netWorth: portfolioSummary.netWorth,
    isNetWorthPositive: portfolioSummary.netWorth >= 0,
    totalAssets: portfolioSummary.totalAssets,
    totalLiabilities: portfolioSummary.totalLiabilities,
  });

  const mailOptions = {
    from: process.env.EMAIL_FROM,
    to: "eibrahim@gmail.com",
    subject: "Financial Dashboard Update",
    html,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log("Email sent successfully");
  } catch (error) {
    console.error("Error sending email:", error);
    throw error;
  }
}

async function main() {
  try {
    await refreshInstitutions();
    const { changes, totalChange, portfolioSummary } = await refreshBalances();
    await sendEmail(changes, totalChange, portfolioSummary);
  } catch (error) {
    console.error("Error in main:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
main();
