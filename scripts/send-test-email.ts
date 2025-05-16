import { PrismaClient } from "@prisma/client";
import nodemailer from "nodemailer";
import handlebars from "handlebars";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

// Initialize Prisma client
const prisma = new PrismaClient();

// Define interfaces (copied from refresh-data.ts)
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

// Configure email
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: parseInt(process.env.EMAIL_PORT || "587"),
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
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

async function sendTestEmail(): Promise<void> {
  try {
    console.log("Gathering current account data for test email...");

    // First, calculate current portfolio totals
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

    let netWorth = totalAssets - totalLiabilities;

    // Now get data for balance changes
    const institutions = await prisma.plaidItem.findMany({
      include: {
        accounts: {
          include: {
            balances: {
              orderBy: {
                date: "desc",
              },
              take: 2, // Get the most recent 2 balances to calculate changes
            },
          },
        },
      },
    });

    const changes: InstitutionChange[] = [];
    let totalChange = 0;

    for (const institution of institutions) {
      const institutionChanges: InstitutionChange = {
        name: institution.institutionName || institution.institutionId,
        accounts: [],
      };

      for (const account of institution.accounts) {
        // Skip accounts with less than 2 balance records
        if (account.balances.length < 2) continue;

        // Get the most recent and previous balance
        const currentBalance = account.balances[0].current;
        const previousBalance = account.balances[1].current;
        const change = currentBalance - previousBalance;

        // Only include accounts with significant changes
        if (Math.abs(change) > 0.01) {
          // For loan and credit accounts, a decreasing balance is positive
          const isLoanOrCredit =
            account.type.toLowerCase() === "credit" ||
            account.type.toLowerCase() === "loan";
          const isPositive = isLoanOrCredit ? change < 0 : change > 0;

          institutionChanges.accounts.push({
            name: account.name,
            nickname: account.nickname,
            previousBalance,
            currentBalance,
            change,
            isPositive,
            type: account.type,
          });
          totalChange += change;
        }
      }

      if (institutionChanges.accounts.length > 0) {
        changes.push(institutionChanges);
      }
    }

    // If no changes, create some sample data for testing
    if (changes.length === 0) {
      console.log("No changes found. Creating sample data for test email.");

      // Add a sample institution with changes
      changes.push({
        name: "Sample Bank",
        accounts: [
          {
            name: "Checking Account",
            nickname: "Main Checking",
            previousBalance: 1500.0,
            currentBalance: 1650.0,
            change: 150.0,
            isPositive: true,
            type: "Checking",
          },
          {
            name: "Savings Account",
            nickname: null,
            previousBalance: 5000.0,
            currentBalance: 4900.0,
            change: -100.0,
            isPositive: false,
            type: "Savings",
          },
          {
            name: "2020 Car Loan",
            nickname: "Car Loan",
            previousBalance: 12500.0,
            currentBalance: 12000.0,
            change: -500.0,
            isPositive: true, // Loan balance decreasing is positive
            type: "Loan",
          },
        ],
      });

      totalChange = 50.0;

      // If no real data, also provide sample portfolio data
      if (allAccounts.length === 0) {
        totalAssets = 250000.0;
        totalLiabilities = 75000.0;
        const sampleNetWorth = totalAssets - totalLiabilities;
        netWorth = sampleNetWorth;
      }
    }

    await sendEmail(
      changes,
      totalChange,
      netWorth,
      totalAssets,
      totalLiabilities
    );
    console.log("Test email sent successfully!");
  } catch (error) {
    console.error("Error sending test email:", error);
  } finally {
    await prisma.$disconnect();
  }
}

async function sendEmail(
  changes: InstitutionChange[],
  totalChange: number,
  netWorth: number,
  totalAssets: number,
  totalLiabilities: number
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
    netWorth,
    isNetWorthPositive: netWorth >= 0,
    totalAssets,
    totalLiabilities,
  });

  // You can customize the recipient for test emails
  const recipientEmail = process.argv[2] || "eibrahim@gmail.com";

  const mailOptions = {
    from: process.env.EMAIL_FROM,
    to: recipientEmail,
    subject: "Financial Dashboard Update - TEST",
    html,
  };

  await transporter.sendMail(mailOptions);
}

// Run the script
sendTestEmail();
