import { PrismaClient } from "@prisma/client";
import { Configuration, PlaidApi, PlaidEnvironments, CountryCode } from "plaid";
import { institutionLogos } from "../src/lib/institutionLogos";
import nodemailer from "nodemailer";
import handlebars from "handlebars";
import fs from "fs";
import path from "path";

interface AccountChange {
  name: string;
  nickname: string | null;
  previousBalance: number;
  currentBalance: number;
  change: number;
  isPositive: boolean;
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

function formatLogoUrl(
  logo: string | null | undefined,
  institutionId: string
): string | null {
  // First try the Plaid-provided logo
  if (logo) {
    // Check if it's already a data URL or regular URL
    if (logo.startsWith("data:") || logo.startsWith("http")) {
      return logo;
    }
    // Otherwise, assume it's a base64 string and format it as a data URL
    return `data:image/png;base64,${logo}`;
  }

  // If no Plaid logo, try the fallback logo
  return institutionLogos[institutionId] || null;
}

async function refreshInstitutions() {
  console.log("Refreshing institutions...");
  const items = await prisma.plaidItem.findMany();

  for (const item of items) {
    try {
      console.log(`Processing institution: ${item.institutionId}`);

      const response = await plaidClient.institutionsGetById({
        institution_id: item.institutionId,
        country_codes: [CountryCode.Us],
      });

      const institution = response.data.institution;
      const logo = formatLogoUrl(institution.logo, item.institutionId);

      await prisma.plaidItem.update({
        where: { id: item.id },
        data: {
          institutionName: institution.name,
          institutionLogo: logo,
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

async function refreshBalances(): Promise<{
  changes: InstitutionChange[];
  totalChange: number;
}> {
  console.log("Refreshing account balances...");
  const items = await prisma.plaidItem.findMany({
    include: {
      accounts: true,
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
      const institutionChanges: InstitutionChange = {
        name: item.institutionName || item.institutionId,
        accounts: [],
      };

      for (const account of accounts) {
        const existingAccount = await prisma.account.findUnique({
          where: { plaidId: account.account_id },
          select: {
            id: true,
            balances: {
              orderBy: { date: "desc" },
              take: 1,
            },
            nickname: true,
          },
        });

        if (existingAccount) {
          const previousBalance = existingAccount.balances[0]?.current || 0;
          const currentBalance = account.balances.current || 0;
          const change = currentBalance - previousBalance;

          if (Math.abs(change) > 0.01) {
            institutionChanges.accounts.push({
              name: account.name,
              nickname: existingAccount.nickname,
              previousBalance,
              currentBalance,
              change,
              isPositive: change > 0,
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
        }
      }

      if (institutionChanges.accounts.length > 0) {
        changes.push(institutionChanges);
      }

      console.log(
        `Refreshed balances for: ${item.institutionName || item.institutionId}`
      );
    } catch (error) {
      if (error instanceof Error) {
        let errorMessage = `Error refreshing balances for ${
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
          `Unknown error refreshing balances for ${
            item.institutionName || item.institutionId
          }:`,
          error
        );
      }
    }
  }

  return { changes, totalChange };
}

async function sendEmail(
  changes: InstitutionChange[],
  totalChange: number
): Promise<void> {
  const templatePath = path.join(__dirname, "email-template.html");
  const template = handlebars.compile(fs.readFileSync(templatePath, "utf-8"));

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
    const { changes, totalChange } = await refreshBalances();
    await sendEmail(changes, totalChange);
  } catch (error) {
    console.error("Error in main:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
main();
